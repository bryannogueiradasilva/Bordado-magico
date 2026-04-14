import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, LayoutDashboard, Shield, Flower2, ShoppingBag, Menu, X, User as UserIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User as UserType } from '../../services/storage';
import { cn } from '../../lib/utils';

interface NavbarProps {
  user: UserType | null;
  onLogout: () => void;
}

export default function Navbar({ user, onLogout }: NavbarProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const navigate = useNavigate();
  const isOwner = user?.email === 'bryannogueira07@gmail.com';

  const handleLoginClick = () => {
    const currentPath = window.location.pathname;
    if (currentPath !== '/login' && currentPath !== '/register') {
      sessionStorage.setItem('redirectAfterLogin', currentPath);
    }
    setIsOpen(false);
    navigate('/login');
  };

  const handleRegisterClick = () => {
    const currentPath = window.location.pathname;
    if (currentPath !== '/login' && currentPath !== '/register') {
      sessionStorage.setItem('redirectAfterLogin', currentPath);
    }
    setIsOpen(false);
    navigate('/register');
  };

  return (
    <nav className="bg-white shadow-md sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-20">
          <Link to="/" className="flex items-center space-x-2">
            <div className="bg-pink-500 p-2 rounded-lg">
              <Flower2 className="text-white w-8 h-8" />
            </div>
            <span className="text-2xl font-bold text-pink-600 tracking-tight">Comunidade Bordado Mágico</span>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-6">
            {user && (
              <Link to="/my-files" className="text-lg font-medium hover:text-pink-500 transition-colors">Minhas Matrizes</Link>
            )}
            {(user?.role === 'manager' || isOwner) && (
              <Link to="/manager" className="flex items-center space-x-1 text-lg font-medium text-purple-600 hover:text-purple-700">
                <LayoutDashboard size={20} />
                <span>Gerente</span>
              </Link>
            )}
            {isOwner && (
              <Link to="/owner" className="flex items-center space-x-1 text-lg font-medium text-pink-600 hover:text-pink-700">
                <Shield size={20} />
                <span>Dono</span>
              </Link>
            )}
            {user ? (
              <div className="flex items-center space-x-4">
                <div className="flex flex-col items-end">
                  <span className="text-gray-800 font-bold">Olá, {user.name.split(' ')[0]}</span>
                  <span className="text-xs text-pink-500 font-medium uppercase tracking-wider">{user.role === 'manager' ? 'Gerente' : 'Bordadeira'}</span>
                </div>
                <button 
                  onClick={onLogout}
                  className="flex items-center space-x-1 bg-gray-100 px-4 py-2 rounded-full hover:bg-gray-200 transition-colors text-lg font-medium cursor-pointer"
                >
                  <LogOut size={20} />
                  <span>Sair</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                <button 
                  onClick={handleLoginClick}
                  className="text-lg font-medium hover:text-pink-500 cursor-pointer"
                >
                  Entrar
                </button>
                <button 
                  onClick={handleRegisterClick}
                  className="bg-pink-500 text-white px-6 py-2 rounded-full hover:bg-pink-600 transition-colors text-lg font-bold shadow-lg cursor-pointer"
                >
                  Criar Conta
                </button>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button className="md:hidden p-2 cursor-pointer text-pink-600" onClick={() => setIsOpen(!isOpen)}>
            {isOpen ? <X size={32} /> : <Menu size={32} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="md:hidden bg-white border-t border-pink-50 overflow-hidden shadow-xl"
          >
            <div className="flex flex-col p-6 space-y-6">
              {user && (
                <Link to="/my-files" onClick={() => setIsOpen(false)} className="text-2xl font-bold text-gray-800 py-2 border-b border-gray-50 flex items-center gap-2">
                  <Flower2 size={24} className="text-pink-500" />
                  Minhas Matrizes
                </Link>
              )}
              {(user?.role === 'manager' || isOwner) && (
                <Link to="/manager" onClick={() => setIsOpen(false)} className="text-2xl font-bold text-purple-600 py-2 border-b border-gray-50 flex items-center gap-2">
                  <LayoutDashboard size={24} />
                  Painel do Gerente
                </Link>
              )}
              {isOwner && (
                <Link to="/owner" onClick={() => setIsOpen(false)} className="text-2xl font-bold text-pink-600 py-2 border-b border-gray-50 flex items-center gap-2">
                  <Shield size={24} />
                  Painel do Dono
                </Link>
              )}
              {user ? (
                <div className="pt-4 space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-pink-50 rounded-2xl">
                    <div className="bg-pink-500 p-2 rounded-full">
                      <UserIcon size={24} className="text-white" />
                    </div>
                    <div>
                      <p className="text-gray-800 font-black text-lg leading-none">{user.name}</p>
                      <p className="text-pink-500 text-xs font-bold uppercase tracking-widest mt-1">{user.role === 'manager' ? 'Gerente' : 'Bordadeira'}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => { onLogout(); setIsOpen(false); }}
                    className="w-full flex items-center justify-center gap-2 bg-gray-100 text-gray-600 py-4 rounded-2xl text-xl font-bold cursor-pointer"
                  >
                    <LogOut size={24} />
                    Sair da Conta
                  </button>
                </div>
              ) : (
                <div className="pt-4 flex flex-col gap-4">
                  <button onClick={handleLoginClick} className="w-full py-4 text-center text-2xl font-bold text-pink-600 bg-pink-50 rounded-2xl cursor-pointer">Entrar</button>
                  <button onClick={handleRegisterClick} className="w-full bg-pink-500 text-white py-4 rounded-2xl text-center text-2xl font-black shadow-lg shadow-pink-200 cursor-pointer">Criar Minha Conta</button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
