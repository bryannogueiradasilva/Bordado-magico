import React from 'react';
import { useNavigate } from 'react-router-dom';
import { User as UserType } from '../../services/storage';

interface FooterProps {
  user: UserType | null;
}

export default function Footer({ user }: FooterProps) {
  const navigate = useNavigate();
  const isOwner = user?.email === 'bryannogueira07@gmail.com';
  const isAdmin = user?.role === 'manager' || isOwner;

  const handleAdminClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isAdmin) {
      navigate('/manager');
    } else {
      navigate('/login?admin=true');
    }
  };

  return (
    <footer className="bg-white border-t border-pink-100 py-8 mt-auto">
      <div className="container mx-auto px-4 text-center text-gray-500">
        <p className="text-lg font-medium text-pink-600">
          Comunidade Bordado Mágico 2026 <span onClick={handleAdminClick} className="cursor-pointer select-none hover:opacity-70 transition-opacity">©</span> 2026
        </p>
        <p>Transformando fios em arte e sonhos.</p>
      </div>
    </footer>
  );
}
