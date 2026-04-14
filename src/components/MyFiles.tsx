import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Download, Flower2, ShoppingBag, Search, RefreshCw, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { User, Product } from '../services/storage';
import { EmbroideryConverter } from '../services/converter';
import { API_BASE_URL } from '../config';

interface MyFilesProps {
  user: User;
}

export default function MyFiles({ user }: MyFilesProps) {
  const [myFiles, setMyFiles] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const fetchMyFiles = async () => {
    try {
      setLoading(true);
      const res = await fetch(API_BASE_URL + "/api/my-files/" + user.id);
      const data = await res.json();
      setMyFiles(data.files || []);
    } catch (err) {
      console.error("Erro ao buscar meus arquivos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyFiles();
  }, [user.id]);

  const handleDownload = async (product: Product) => {
    setIsDownloading(true);
    setDownloadProgress(0);

    try {
      setDownloadProgress(20);
      let fileData: ArrayBuffer;
      
      if (product.fileUrl?.startsWith('data:')) {
        const base64 = product.fileUrl.split(',')[1];
        const binary = atob(base64);
        fileData = new ArrayBuffer(binary.length);
        const view = new Uint8Array(fileData);
        for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
      } else if (product.fileUrl) {
        const response = await fetch(product.fileUrl);
        fileData = await response.arrayBuffer();
      } else {
        fileData = new ArrayBuffer(0);
      }

      setDownloadProgress(50);
      const originalExt = product.fileName?.split('.').pop()?.toUpperCase();
      const targetFormat: 'PES' | 'JEF' = (originalExt === 'JEF' || originalExt === 'JEFF') ? 'JEF' : 'PES';
      
      const convertedData = await EmbroideryConverter.convert(fileData, targetFormat);
      setDownloadProgress(80);
      
      const blob = new Blob([convertedData], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      
      setDownloadProgress(100);
      await new Promise(resolve => setTimeout(resolve, 500));

      const link = document.createElement('a');
      link.href = url;
      const baseName = product.fileName?.split('.')[0] || 'bordado';
      link.download = `${baseName}.${targetFormat.toLowerCase()}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erro no download:', error);
      alert('Erro ao baixar o arquivo. Tente novamente.');
    } finally {
      setIsDownloading(false);
    }
  };

  const filteredFiles = myFiles.filter(f => 
    f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h1 className="text-4xl font-black text-gray-900 mb-2">Minhas Matrizes</h1>
          <p className="text-gray-500 font-medium">Você tem {myFiles.length} matrizes liberadas para download.</p>
        </div>
        
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Buscar em minhas matrizes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-2xl border border-gray-100 bg-white focus:ring-2 focus:ring-pink-500 outline-none"
            />
          </div>
          <button 
            onClick={fetchMyFiles}
            className="p-3 bg-white text-gray-600 rounded-2xl border border-gray-100 hover:bg-gray-50 transition-all shadow-sm"
          >
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white h-64 rounded-3xl animate-pulse shadow-sm" />
          ))}
        </div>
      ) : filteredFiles.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredFiles.map(product => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-[32px] overflow-hidden shadow-lg border border-gray-100 group"
            >
              <div className="relative h-48 bg-gray-50 flex items-center justify-center overflow-hidden">
                {product.imageUrl ? (
                  <img 
                    src={product.imageUrl} 
                    alt={product.name}
                    className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <Flower2 size={64} className="text-purple-200" />
                )}
                <div className="absolute top-4 right-4">
                  <Link 
                    to={`/product/${product.id}`}
                    className="p-2 bg-white/90 text-gray-600 rounded-full shadow-sm hover:bg-white transition-all"
                  >
                    <ExternalLink size={18} />
                  </Link>
                </div>
              </div>
              
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-2 truncate">{product.name}</h3>
                <p className="text-gray-500 text-sm mb-6 line-clamp-2">{product.description}</p>
                
                <button 
                  onClick={() => handleDownload(product)}
                  disabled={isDownloading}
                  className="w-full bg-green-500 text-white py-4 rounded-2xl font-bold text-lg shadow-lg hover:bg-green-600 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Download size={20} />
                  {isDownloading ? `Baixando... ${downloadProgress}%` : 'Baixar Matriz'}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-[40px] p-12 text-center shadow-xl border border-gray-100">
          <div className="bg-pink-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShoppingBag className="text-pink-500 w-12 h-12" />
          </div>
          <h2 className="text-2xl font-black text-gray-800 mb-4">Nenhuma matriz encontrada</h2>
          <p className="text-gray-500 mb-8 max-w-md mx-auto">
            Você ainda não adquiriu nenhuma matriz ou sua busca não retornou resultados.
          </p>
          <Link 
            to="/"
            className="inline-flex items-center gap-2 bg-pink-500 text-white px-8 py-4 rounded-2xl font-bold text-xl shadow-lg hover:bg-pink-600 transition-all"
          >
            Explorar Catálogo
          </Link>
        </div>
      )}
    </div>
  );
}
