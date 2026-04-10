import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, AlertCircle, Shield, Mail, Lock, ArrowLeft, Eye, EyeOff, RefreshCw, CheckCircle } from 'lucide-react';
import { signInWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../firebase';
import { storage, User } from '../services/storage';
import { cn } from '../lib/utils';

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
});

type LoginFormData = z.infer<typeof loginSchema>;

interface LoginProps {
  onLogin: (user: User) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resending, setResending] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const navigate = useNavigate();
  const isAdminMode = new URLSearchParams(window.location.search).get('admin') === 'true';

  const { register, handleSubmit, formState: { errors }, getValues } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: isAdminMode ? 'bryannogueira07@gmail.com' : '',
      password: ''
    }
  });

  const handleForgotPassword = async () => {
    const email = getValues('email');
    if (!email || !z.string().email().safeParse(email).success) {
      setError('Por favor, insira um e-mail válido para redefinir a senha.');
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
      setError('');
      alert(`Um e-mail de redefinição de senha foi enviado para ${email}. Verifique sua caixa de entrada.`);
    } catch (err: any) {
      console.error("Erro ao resetar senha:", err);
      if (err.code === 'auth/user-not-found') {
        setError('E-mail não encontrado. Verifique se você já se cadastrou.');
      } else {
        setError('Erro ao enviar e-mail de redefinição. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check if user is already logged in but needs verification
    if (auth.currentUser && !auth.currentUser.emailVerified) {
      setNeedsVerification(true);
    }
  }, []);

  const handleResendEmail = async () => {
    if (!auth.currentUser) return;
    setResending(true);
    try {
      await sendEmailVerification(auth.currentUser);
      alert("E-mail de verificação reenviado com sucesso!");
    } catch (err: any) {
      console.error("Erro ao reenviar e-mail:", err);
      alert("Erro ao reenviar e-mail. Tente novamente mais tarde.");
    } finally {
      setResending(false);
    }
  };

  const handleReload = async () => {
    if (!auth.currentUser) return;
    setReloading(true);
    try {
      await auth.currentUser.reload();
      if (auth.currentUser.emailVerified) {
        // Proceed with login logic
        const users = storage.getUsers();
        const user = users.find(u => u.email.toLowerCase().trim() === auth.currentUser?.email?.toLowerCase().trim());
        if (user) {
          storage.setCurrentUser(user);
          onLogin(user);
          navigate(isAdminMode ? '/manager' : '/');
        } else {
          setError('Usuário não encontrado no sistema após verificação.');
          setNeedsVerification(false);
        }
      } else {
        alert("O e-mail ainda não foi verificado. Verifique sua caixa de entrada.");
      }
    } catch (err) {
      console.error("Erro ao recarregar usuário:", err);
    } finally {
      setReloading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const firebaseUser = userCredential.user;

      // 1. Try to find user in local storage first
      const users = storage.getUsers();
      let user = users.find(u => u.email.toLowerCase().trim() === firebaseUser.email?.toLowerCase().trim());

      // 2. If not in local storage, try to fetch from Realtime Database
      if (!user) {
        user = await storage.getUserFromRTDB(firebaseUser.uid);
        if (user) {
          storage.saveUsers([...users, user]);
        }
      }

      const isOwner = firebaseUser.email === 'bryannogueira07@gmail.com';

      // 3. If still not found, create a default profile (first time Google login)
      if (!user) {
        user = {
          id: firebaseUser.uid,
          name: firebaseUser.displayName || 'Usuário Google',
          email: firebaseUser.email!,
          whatsapp: '00000000000',
          age: 18,
          role: isOwner ? 'manager' : 'client',
          active: true,
          status: 'active',
          accessToken: isOwner ? 'OWNER' : 'ACTIVE',
          createdAt: new Date().toISOString(),
        };
        storage.saveUsers([...storage.getUsers(), user]);
      }

      if (user.id !== firebaseUser.uid) {
        user.id = firebaseUser.uid;
        storage.saveUsers(storage.getUsers().map(u => u.email === user!.email ? user! : u));
      }

      await storage.syncUserToRTDB(user);
      storage.setCurrentUser(user);
      onLogin(user);
      
      const redirectUrl = sessionStorage.getItem('redirectAfterLogin');
      if (redirectUrl) {
        sessionStorage.removeItem('redirectAfterLogin');
        navigate(redirectUrl);
      } else {
        navigate(isAdminMode ? '/manager' : '/');
      }
    } catch (err: any) {
      console.error("Erro Google Login:", err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError('O login foi cancelado.');
      } else if (err.code === 'auth/popup-blocked') {
        setError('O popup de login foi bloqueado pelo navegador.');
      } else {
        setError('Erro ao entrar com Google. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: LoginFormData) => {
    setLoading(true);
    setError('');
    try {
      // 0. Master Bypass for Owner
      if (data.email.toLowerCase().trim() === 'bryannogueira07@gmail.com' && data.password === 'admin123') {
        console.log("Acesso Master detectado para o proprietário. Tentando autenticação Firebase...");
        
        let firebaseUser = null;
        try {
          const userCredential = await signInWithEmailAndPassword(auth, data.email, data.password);
          firebaseUser = userCredential.user;
          console.log("Autenticação Firebase bem-sucedida para o mestre.");
        } catch (fbErr: any) {
          console.warn("Autenticação Firebase falhou para o mestre:", fbErr.code);
          
          // If user doesn't exist, try to create it automatically for the master owner
          if (fbErr.code === 'auth/user-not-found') {
            try {
              console.log("Criando conta Firebase automaticamente para o proprietário...");
              const { createUserWithEmailAndPassword } = await import('firebase/auth');
              const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
              firebaseUser = userCredential.user;
              console.log("Conta Firebase criada com sucesso para o proprietário.");
            } catch (createErr: any) {
              console.error("Falha ao criar conta Firebase automática:", createErr);
            }
          }
        }

        const ownerUser: User = {
          id: firebaseUser?.uid || 'master-owner-id',
          name: 'Proprietário (Master)',
          email: 'bryannogueira07@gmail.com',
          whatsapp: '00000000000',
          age: 99,
          role: 'manager',
          active: true,
          status: 'active',
          accessToken: 'MASTER_ACCESS',
          createdAt: new Date().toISOString(),
        };

        storage.saveUsers([...storage.getUsers().filter(u => u.email !== ownerUser.email), ownerUser]);
        storage.setCurrentUser(ownerUser);
        onLogin(ownerUser);
        
        if (!firebaseUser) {
          alert("Aviso: Você entrou via Bypass Local. A sincronização com a produção (Realtime Database) não funcionará até que você crie uma conta oficial com este e-mail e senha no botão 'Cadastre-se'.");
        }
        
        navigate('/manager');
        return;
      }

      const userCredential = await signInWithEmailAndPassword(auth, data.email, data.password);
      const firebaseUser = userCredential.user;

      // 1. Check Email Verification
      if (!firebaseUser.emailVerified) {
        setNeedsVerification(true);
        setLoading(false);
        return;
      }

      // 2. Try to find user in local storage first
      const users = storage.getUsers();
      let user = users.find(u => u.email.toLowerCase().trim() === firebaseUser.email?.toLowerCase().trim());

      // 3. If not in local storage, try to fetch from Realtime Database
      if (!user) {
        user = await storage.getUserFromRTDB(firebaseUser.uid);
        if (user) {
          storage.saveUsers([...users, user]);
        }
      }

      const isOwner = firebaseUser.email === 'bryannogueira07@gmail.com';

      if (isOwner && !user) {
        user = {
          id: firebaseUser.uid,
          name: 'Proprietário',
          email: firebaseUser.email!,
          whatsapp: '00000000000',
          age: 99,
          role: 'manager',
          active: true,
          status: 'active',
          accessToken: 'OWNER',
          createdAt: new Date().toISOString(),
        };
        storage.saveUsers([...storage.getUsers(), user]);
      }

      if (!user) {
        setError('Usuário não encontrado no sistema. Por favor, realize o cadastro primeiro.');
        setLoading(false);
        return;
      }

      if (user.id !== firebaseUser.uid) {
        user.id = firebaseUser.uid;
        storage.saveUsers(users.map(u => u.email === user!.email ? user! : u));
      }

      await storage.syncUserToRTDB(user);
      storage.setCurrentUser(user);
      onLogin(user);
      
      const redirectUrl = sessionStorage.getItem('redirectAfterLogin');
      if (redirectUrl) {
        sessionStorage.removeItem('redirectAfterLogin');
        navigate(redirectUrl);
      } else {
        navigate(isAdminMode ? '/manager' : '/');
      }
    } catch (err: any) {
      console.error("Erro login:", err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        let msg = 'E-mail ou senha incorretos.';
        if (data.email.toLowerCase().trim() === 'bryannogueira07@gmail.com') {
          msg += ' Se você é o proprietário e ainda não criou sua conta oficial, por favor use a página de Cadastro.';
        } else {
          msg += ' Se você ainda não tem uma conta, por favor cadastre-se.';
        }
        setError(msg);
      } else if (err.code === 'auth/too-many-requests') {
        setError('Muitas tentativas. Tente novamente mais tarde ou redefina sua senha.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('O login com E-mail/Senha está desativado no Firebase Console. Ative-o em Authentication > Sign-in method.');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Erro de Conexão: O Firebase não conseguiu alcançar o servidor. Verifique sua internet ou se o domínio do site está autorizado no Console do Firebase (Authentication > Settings > Authorized domains).');
      } else if (err.code === 'PERMISSION_DENIED' || err.message?.includes('PERMISSION_DENIED')) {
        setError('Erro de Permissão: O banco de dados recusou a gravação. Verifique se as "Rules" do Realtime Database no Console do Firebase estão configuradas para permitir leitura/escrita.');
      } else {
        setError(`Erro (${err.code || 'desconhecido'}): Ocorreu um erro ao entrar. Tente novamente.`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-6 md:p-8 rounded-3xl shadow-xl border border-pink-100"
      >
        <AnimatePresence mode="wait">
          {!needsVerification ? (
            <motion.div
              key="login-form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="text-center mb-8">
                <div className="bg-pink-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  {isAdminMode ? <Shield className="text-pink-600 w-8 h-8" /> : <LogIn className="text-pink-600 w-8 h-8" />}
                </div>
                <h1 className="text-3xl font-bold text-gray-800">
                  {isAdminMode ? 'Entrar no Painel' : 'Entrar no App'}
                </h1>
                <p className="text-gray-500 mt-2">
                  {isAdminMode ? 'Acesso restrito para administradores' : 'Acesse suas matrizes exclusivas'}
                </p>
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 flex items-center space-x-2">
                  <AlertCircle size={20} />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div>
                  <label className="block text-lg font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Mail size={20} className="text-pink-500" />
                    E-mail
                  </label>
                  <input
                    {...register('email')}
                    type="email"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-pink-500 outline-none transition-all text-lg"
                    placeholder="seu@email.com"
                  />
                  {errors.email && (
                    <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-lg font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Lock size={20} className="text-pink-500" />
                    Senha
                  </label>
                  <div className="relative">
                    <input
                      {...register('password')}
                      type={showPassword ? "text" : "password"}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-pink-500 outline-none transition-all text-lg pr-12"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-pink-500 transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={24} /> : <Eye size={24} />}
                    </button>
                  </div>
                  <div className="flex justify-end mt-1">
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      className="text-sm text-pink-600 font-medium hover:underline"
                    >
                      Esqueceu a senha?
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={cn(
                    "w-full text-white py-4 rounded-2xl text-xl font-bold transition-all shadow-lg active:scale-95 disabled:opacity-50",
                    loading ? "bg-gray-400 cursor-not-allowed" : "bg-pink-500 hover:bg-pink-600 cursor-pointer"
                  )}
                >
                  {loading ? 'Entrando...' : 'Acessar Agora'}
                </button>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500 font-medium">Ou continue com</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="w-full bg-white border-2 border-gray-100 text-gray-700 py-4 rounded-2xl text-lg font-bold transition-all shadow-sm hover:bg-gray-50 flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                >
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
                  Entrar com Google
                </button>
              </form>

              <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col gap-4">
                <p className="text-center text-gray-600 text-lg">
                  Ainda não tem uma conta?{' '}
                  <button 
                    onClick={() => navigate('/register')}
                    className="text-pink-600 font-bold hover:underline cursor-pointer"
                  >
                    Cadastre-se aqui
                  </button>
                </p>
                <button 
                  onClick={() => navigate(-1)}
                  className="text-center text-gray-500 font-medium hover:text-pink-500 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ArrowLeft size={18} />
                  Voltar para a página anterior
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="verification-screen"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="text-center"
            >
              <div className="bg-yellow-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Mail className="text-yellow-600 w-12 h-12" />
              </div>
              <h2 className="text-3xl font-bold text-gray-800 mb-4">Verifique seu E-mail</h2>
              <p className="text-gray-600 mb-8 text-lg">
                Seu e-mail ainda não foi verificado. Verifique sua caixa de entrada para ativar sua conta.
              </p>

              <div className="space-y-4">
                <button
                  onClick={handleReload}
                  disabled={reloading}
                  className="w-full bg-pink-500 text-white py-4 rounded-2xl text-xl font-bold hover:bg-pink-600 transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {reloading ? <RefreshCw size={24} className="animate-spin" /> : <CheckCircle size={24} />}
                  Já verifiquei meu e-mail
                </button>

                <button
                  onClick={handleResendEmail}
                  disabled={resending}
                  className="flex items-center justify-center gap-2 w-full text-pink-600 font-bold hover:underline py-2 cursor-pointer disabled:opacity-50"
                >
                  {resending ? <RefreshCw size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                  Reenviar e-mail de verificação
                </button>

                <button
                  onClick={() => setNeedsVerification(false)}
                  className="w-full text-gray-500 font-medium hover:text-pink-500 transition-colors flex items-center justify-center gap-2 mt-4 cursor-pointer"
                >
                  <ArrowLeft size={18} />
                  Voltar para o Login
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
