import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion, AnimatePresence } from 'motion/react';
import { UserPlus, AlertCircle, CheckCircle, ArrowLeft, Mail, Lock, User as UserIcon, Phone, Calendar, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { createUserWithEmailAndPassword, sendEmailVerification, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../firebase';
import { storage, User } from '../services/storage';
import { cn } from '../lib/utils';

const schema = z.object({
  name: z.string().min(3, 'Nome muito curto'),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
  whatsapp: z.string().regex(/^\d{10,11}$/, 'Número inválido (use apenas números com DDD)'),
  age: z.number().min(18, 'Você deve ter pelo menos 18 anos'),
});

type FormData = z.infer<typeof schema>;

export default function Register() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resending, setResending] = useState(false);
  const navigate = useNavigate();

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

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

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const firebaseUser = userCredential.user;

      // Check if user already exists
      const users = storage.getUsers();
      let user = users.find(u => u.email.toLowerCase().trim() === firebaseUser.email?.toLowerCase().trim());

      if (!user) {
        user = await storage.getUserFromRTDB(firebaseUser.uid);
      }

      const isOwner = firebaseUser.email === 'bryannogueira07@gmail.com';

      if (!user) {
        // Create new user profile for Google user
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
        await storage.syncUserToRTDB(user);
      }

      storage.setCurrentUser(user);
      // We need to trigger the login in App.tsx, which happens via onAuthStateChanged
      // But we can also navigate immediately
      navigate('/');
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

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setError('');
    const email = data.email.toLowerCase().trim();
    try {
      // 1. Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, data.password);
      const firebaseUser = userCredential.user;

      // 2. Send Email Verification
      await sendEmailVerification(firebaseUser);

      // 3. Save user profile in local storage
      const users = storage.getUsers();
      
      const newUser: User = {
        id: firebaseUser.uid,
        name: data.name,
        email: email,
        whatsapp: data.whatsapp,
        age: data.age,
        role: email === 'bryannogueira07@gmail.com' ? 'manager' : 'client',
        active: true,
        status: 'active',
        accessToken: email === 'bryannogueira07@gmail.com' ? 'OWNER' : 'ACTIVE',
        createdAt: new Date().toISOString(),
      };

      storage.saveUsers([...users, newUser]);
      await storage.syncUserToRTDB(newUser);
      setSuccess(true);
    } catch (err: any) {
      console.error("Erro cadastro:", err);
      if (err.code === 'auth/email-already-in-use') {
        setError('Este e-mail já está em uso.');
      } else if (err.code === 'auth/weak-password') {
        setError('A senha é muito fraca.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('O cadastro com E-mail/Senha está desativado no Firebase Console. Ative-o em Authentication > Sign-in method.');
      } else if (err.code === 'PERMISSION_DENIED' || err.message?.includes('PERMISSION_DENIED')) {
        setError('Erro de Permissão: O banco de dados recusou a gravação. Verifique se as "Rules" do Realtime Database no Console do Firebase estão configuradas para permitir leitura/escrita.');
      } else {
        setError(`Erro (${err.code || 'desconhecido'}): Ocorreu um erro ao criar sua conta. Tente novamente.`);
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
          {!success ? (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="text-center mb-8">
                <div className="bg-pink-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <UserPlus className="text-pink-600 w-8 h-8" />
                </div>
                <h1 className="text-3xl font-bold text-gray-800">Criar Conta</h1>
                <p className="text-gray-500 mt-2">Junte-se ao nosso mundo de bordados</p>
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 flex items-center space-x-2">
                  <AlertCircle size={20} />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                    <UserIcon size={16} className="text-pink-500" />
                    Nome Completo
                  </label>
                  <input
                    {...register('name')}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-pink-500 outline-none transition-all"
                    placeholder="Seu nome"
                  />
                  {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                    <Mail size={16} className="text-pink-500" />
                    E-mail
                  </label>
                  <input
                    {...register('email')}
                    type="email"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-pink-500 outline-none transition-all"
                    placeholder="seu@email.com"
                  />
                  {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                    <Lock size={16} className="text-pink-500" />
                    Senha
                  </label>
                  <div className="relative">
                    <input
                      {...register('password')}
                      type={showPassword ? "text" : "password"}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-pink-500 outline-none transition-all pr-12"
                      placeholder="Mínimo 6 caracteres"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-pink-500 transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                      <Phone size={16} className="text-pink-500" />
                      WhatsApp
                    </label>
                    <input
                      {...register('whatsapp')}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-pink-500 outline-none transition-all"
                      placeholder="11999999999"
                    />
                    {errors.whatsapp && <p className="text-red-500 text-xs mt-1">{errors.whatsapp.message}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                      <Calendar size={16} className="text-pink-500" />
                      Idade
                    </label>
                    <input
                      {...register('age', { valueAsNumber: true })}
                      type="number"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-pink-500 outline-none transition-all"
                      placeholder="Sua idade"
                    />
                    {errors.age && <p className="text-red-500 text-xs mt-1">{errors.age.message}</p>}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={cn(
                    "w-full text-white py-3.5 rounded-2xl text-lg font-bold transition-all shadow-lg active:scale-95 disabled:opacity-50 mt-4",
                    loading ? "bg-gray-400 cursor-not-allowed" : "bg-pink-500 hover:bg-pink-600 cursor-pointer"
                  )}
                >
                  {loading ? 'Criando...' : 'Cadastrar Agora'}
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
                  className="w-full bg-white border-2 border-gray-100 text-gray-700 py-3.5 rounded-2xl text-lg font-bold transition-all shadow-sm hover:bg-gray-50 flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                >
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
                  Entrar com Google
                </button>
              </form>

              <p className="text-center mt-6 text-gray-600">
                Já tem uma conta?{' '}
                <button 
                  onClick={() => navigate('/login')}
                  className="text-pink-600 font-bold hover:underline cursor-pointer"
                >
                  Entre aqui
                </button>
              </p>
              <button 
                onClick={() => navigate(-1)}
                className="w-full mt-4 text-center text-gray-500 font-medium hover:text-pink-500 transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <ArrowLeft size={18} />
                Voltar
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <div className="bg-blue-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Mail className="text-blue-600 w-12 h-12" />
              </div>
              <h2 className="text-3xl font-bold text-gray-800 mb-2">Verifique seu E-mail</h2>
              <p className="text-gray-600 mb-8">
                Enviamos um link de confirmação para o seu e-mail. 
                <strong> Verifique sua caixa de entrada para ativar sua conta.</strong>
              </p>
              
              <div className="space-y-4">
                <button 
                  onClick={() => navigate('/login')}
                  className="block w-full bg-pink-500 text-white py-4 rounded-2xl text-xl font-bold hover:bg-pink-600 transition-all shadow-lg text-center cursor-pointer"
                >
                  Ir para o Login
                </button>
                
                <button 
                  onClick={handleResendEmail}
                  disabled={resending}
                  className="flex items-center justify-center gap-2 w-full text-pink-600 font-bold hover:underline py-2 cursor-pointer disabled:opacity-50"
                >
                  {resending ? <RefreshCw size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                  Reenviar e-mail de verificação
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
