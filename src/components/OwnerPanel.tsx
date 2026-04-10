import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Users, Power, Shield, CheckCircle, XCircle, Search } from 'lucide-react';
import { storage, User, AppConfig } from '../services/storage';

export default function OwnerPanel() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [config, setConfig] = useState<AppConfig>({ buttonsEnabled: true });

  useEffect(() => {
    // Initial load
    setUsers(storage.getUsers());
    setConfig(storage.getConfig());
    setLoading(false);

    // Poll for changes
    const interval = setInterval(() => {
      setUsers(storage.getUsers());
      setConfig(storage.getConfig());
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const toggleUserActive = (userId: string, currentStatus: boolean) => {
    const allUsers = storage.getUsers();
    const updatedUsers = allUsers.map(u => 
      u.id === userId ? { ...u, active: !currentStatus } : u
    );
    storage.saveUsers(updatedUsers);
    setUsers(updatedUsers);
  };

  const toggleButtons = () => {
    const newConfig = { ...config, buttonsEnabled: !config.buttonsEnabled };
    storage.saveConfig(newConfig);
    setConfig(newConfig);
  };

  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.accessToken.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pink-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-4xl font-bold text-gray-800 flex items-center gap-3">
            <Shield className="text-pink-600" size={40} />
            Painel do Proprietário
          </h1>
          <p className="text-gray-600 mt-2">Gerencie acessos e funcionalidades do sistema</p>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-md border border-pink-100 flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">Botões de Compra</span>
            <span className={`font-bold ${config.buttonsEnabled ? 'text-green-600' : 'text-red-600'}`}>
              {config.buttonsEnabled ? 'ATIVADOS' : 'DESATIVADOS'}
            </span>
          </div>
          <button
            onClick={toggleButtons}
            className={`p-3 rounded-xl transition-all ${
              config.buttonsEnabled 
                ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                : 'bg-green-100 text-green-600 hover:bg-green-200'
            }`}
          >
            <Power size={24} />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-xl border border-pink-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-pink-50/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Users className="text-pink-600" />
            <h2 className="text-xl font-bold text-gray-800">Usuários Cadastrados ({users.length})</h2>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar por nome, e-mail ou token..."
              className="pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-pink-500 outline-none w-full md:w-80"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-6 py-4 text-sm font-bold text-gray-600 uppercase tracking-wider">Usuário</th>
                <th className="px-6 py-4 text-sm font-bold text-gray-600 uppercase tracking-wider">Token</th>
                <th className="px-6 py-4 text-sm font-bold text-gray-600 uppercase tracking-wider">WhatsApp</th>
                <th className="px-6 py-4 text-sm font-bold text-gray-600 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-sm font-bold text-gray-600 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredUsers.map((user) => (
                <motion.tr 
                  key={user.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="hover:bg-pink-50/10 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-800">{user.name}</span>
                      <span className="text-sm text-gray-500">{user.email}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-mono bg-gray-100 px-3 py-1 rounded-lg text-pink-600 font-bold">
                      {user.accessToken}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {user.whatsapp}
                  </td>
                  <td className="px-6 py-4">
                    {user.active ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-bold">
                        <CheckCircle size={14} /> Ativo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-100 text-red-700 text-sm font-bold">
                        <XCircle size={14} /> Inativo
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {user.role !== 'manager' && (
                      <button
                        onClick={() => toggleUserActive(user.id, user.active)}
                        className={`px-4 py-2 rounded-xl font-bold transition-all active:scale-95 ${
                          user.active 
                            ? 'bg-red-500 text-white hover:bg-red-600' 
                            : 'bg-green-500 text-white hover:bg-green-600'
                        }`}
                      >
                        {user.active ? 'Desativar' : 'Ativar'}
                      </button>
                    )}
                    {user.role === 'manager' && (
                      <span className="text-gray-400 italic">Administrador</span>
                    )}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="md:hidden divide-y divide-gray-100">
          {filteredUsers.map((user) => (
            <motion.div 
              key={user.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-6 space-y-4"
            >
              <div className="flex justify-between items-start">
                <div className="flex flex-col">
                  <span className="font-bold text-xl text-gray-800">{user.name}</span>
                  <span className="text-sm text-gray-500">{user.email}</span>
                </div>
                {user.active ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold">
                    <CheckCircle size={12} /> Ativo
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-bold">
                    <XCircle size={12} /> Inativo
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-gray-400 uppercase">Token</span>
                  <span className="font-mono text-pink-600 font-black">{user.accessToken}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-gray-400 uppercase">WhatsApp</span>
                  <span className="text-gray-700 font-medium">{user.whatsapp}</span>
                </div>
              </div>

              <div className="pt-2">
                {user.role !== 'manager' ? (
                  <button
                    onClick={() => toggleUserActive(user.id, user.active)}
                    className={`w-full py-4 rounded-2xl font-black text-lg transition-all active:scale-95 shadow-lg ${
                      user.active 
                        ? 'bg-red-500 text-white shadow-red-100' 
                        : 'bg-green-500 text-white shadow-green-100'
                    }`}
                  >
                    {user.active ? 'Desativar Acesso' : 'Ativar Acesso'}
                  </button>
                ) : (
                  <div className="w-full py-3 bg-gray-100 rounded-xl text-center text-gray-400 font-bold italic">
                    Administrador
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
          
        {filteredUsers.length === 0 && (
          <div className="p-12 text-center text-gray-500">
            Nenhum usuário encontrado com os critérios de busca.
          </div>
        )}
      </div>
    </div>
  );
}
