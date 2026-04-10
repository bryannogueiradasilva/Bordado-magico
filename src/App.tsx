import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { LogOut, LayoutDashboard, ShoppingBag, User as UserIcon, Menu, X, Plus, Trash2, Edit, CheckCircle, Shield, Settings, Flower2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import { cn } from './lib/utils';
import { storage, User as UserType } from './services/storage';
import { PresenceProvider } from './services/presence';

// Components
import Login from './components/Login';
import Register from './components/Register';
import Catalog from './components/Catalog';
import ManagerDashboard from './components/ManagerDashboard';
import OwnerPanel from './components/OwnerPanel';
import ProductDetail from './components/ProductDetail';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';

export default function App() {
  const [user, setUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Check for user in storage first for immediate UI
    const currentUser = storage.getCurrentUser();
    setUser(currentUser);

    // 2. Sync with Firebase Auth state
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        // Check email verification (Owner is exempt for convenience)
        const isOwner = fbUser.email === 'bryannogueira07@gmail.com';
        if (!fbUser.emailVerified && !isOwner) {
          console.log("Usuário autenticado mas e-mail não verificado.");
          storage.setCurrentUser(null);
          setUser(null);
          setLoading(false);
          return;
        }

        // If we have a firebase user but no local user, try to sync
        if (!currentUser || currentUser.id !== fbUser.uid) {
          try {
            const syncedUser = await storage.getUserFromRTDB(fbUser.uid);
            if (syncedUser) {
              storage.setCurrentUser(syncedUser);
              setUser(syncedUser);
            } else {
              // User exists in Auth but not in RTDB (maybe deleted or first time)
              console.warn("Usuário autenticado mas não encontrado no banco de dados.");
            }
          } catch (err) {
            console.error("Erro ao sincronizar usuário:", err);
          }
        }
      } else {
        // If Firebase says no user, clear local user
        // BUT keep it if it's the master bypass user
        if (currentUser && currentUser.accessToken !== 'MASTER_ACCESS') {
          storage.setCurrentUser(null);
          setUser(null);
        }
      }
      setLoading(false);
    });

    // Listen for storage changes (for multi-tab support)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'bordado_magico_current_user_id' || e.key === null) {
        const currentUser = storage.getCurrentUser();
        setUser(currentUser);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      unsubscribe();
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const handleLogout = async () => {
    try {
      const { signOut } = await import('firebase/auth');
      await signOut(auth);
    } catch (err) {
      console.error("Erro ao sair:", err);
    }
    storage.setCurrentUser(null);
    setUser(null);
    window.location.href = '/login';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pink-50">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-16 h-16 border-4 border-pink-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  const isOwner = user?.email === 'bryannogueira07@gmail.com';

  return (
    <BrowserRouter>
      <PresenceProvider user={user}>
        <div className="min-h-screen bg-pink-50 text-gray-900 font-sans">
          <Navbar user={user} onLogout={handleLogout} />
          <main className="container mx-auto px-4 py-6 md:py-8">
            <Routes>
              <Route path="/" element={user ? <Catalog user={user} /> : <Navigate to="/login" />} />
              <Route path="/login" element={!user ? <Login onLogin={setUser} /> : <Navigate to="/" />} />
              <Route path="/register" element={!user ? <Register /> : <Navigate to="/" />} />
              <Route 
                path="/manager" 
                element={(user?.role === 'manager' || isOwner) ? <ManagerDashboard /> : <Navigate to="/login" />} 
              />
              <Route 
                path="/owner" 
                element={isOwner ? <OwnerPanel /> : <Navigate to="/login" />} 
              />
              <Route path="/product/:id" element={user ? <ProductDetail user={user} /> : <Navigate to="/login" />} />
            </Routes>
          </main>
          <Footer user={user} />
        </div>
      </PresenceProvider>
    </BrowserRouter>
  );
}
