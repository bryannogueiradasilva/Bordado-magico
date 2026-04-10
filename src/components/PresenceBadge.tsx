import React from 'react';
import { motion } from 'motion/react';
import { usePresence } from '../services/presence';
import { Flame, Eye, AlertCircle } from 'lucide-react';

export const GlobalPresenceBadge: React.FC = () => {
  const { globalOnlineCount, authError } = usePresence();

  if (authError) {
    return (
      <div className="inline-flex items-center gap-2 bg-gray-50 text-gray-500 px-4 py-2 rounded-full font-medium text-xs border border-gray-200">
        <AlertCircle size={14} />
        <span>{authError}</span>
      </div>
    );
  }

  if (globalOnlineCount === 0) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="inline-flex items-center gap-2 bg-pink-100 text-pink-600 px-4 py-2 rounded-full font-bold text-sm shadow-sm border border-pink-200"
    >
      <Flame size={18} className="animate-pulse" />
      <span>{globalOnlineCount} {globalOnlineCount === 1 ? 'pessoa' : 'pessoas'} online</span>
    </motion.div>
  );
};

export const PagePresenceBadge: React.FC = () => {
  const { pageOnlineCount } = usePresence();

  if (pageOnlineCount === 0) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="inline-flex items-center gap-2 bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg font-bold text-xs border border-blue-100"
    >
      <Eye size={14} className="animate-pulse" />
      <span>{pageOnlineCount} {pageOnlineCount === 1 ? 'vendo' : 'vendo'} agora</span>
    </motion.div>
  );
};
