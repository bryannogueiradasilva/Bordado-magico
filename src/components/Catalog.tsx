import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Filter, ShoppingCart, Check, X, Shield, Flower2, Heart, CheckCircle2, AlertTriangle, TrendingUp, Star, Download, RefreshCw } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { storage, User, Product, AppConfig } from '../services/storage';
import { EmbroideryConverter } from '../services/converter';
import { usePresence } from '../services/presence';
import { GlobalPresenceBadge } from './PresenceBadge';
import { cn } from '../lib/utils';

interface CatalogProps {
  user: User | null;
}

const EmbroideryAnimation = () => {
  const [paths, setPaths] = useState<{ path: string; points: { x: number; y: number }[] }[]>([]);

  useEffect(() => {
    const generateArtisticPath = () => {
      const pathPoints: { x: number; y: number }[] = [];
      let x = -100;
      let y = 100 + Math.random() * 200;
      pathPoints.push({ x, y });
      
      const segments = [];
      segments.push(`M ${x} ${y}`);
      
      // Create elegant, sweeping curves that look like a professional embroidery pattern
      for (let i = 0; i < 8; i++) {
        const nextX = x + 150 + Math.random() * 50;
        const nextY = 50 + Math.random() * 300;
        
        // Control points for smooth, modern Bezier curves
        const cp1x = x + 80;
        const cp1y = y - 150 + Math.random() * 300;
        const cp2x = nextX - 80;
        const cp2y = nextY - 150 + Math.random() * 300;
        
        segments.push(`C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${nextX} ${nextY}`);
        
        // Strategic points for stitch holes
        pathPoints.push({ x: (x + nextX) / 2, y: (y + nextY) / 2 });
        pathPoints.push({ x: nextX, y: nextY });
        
        x = nextX;
        y = nextY;
      }
      return { path: segments.join(" "), points: pathPoints };
    };

    setPaths([generateArtisticPath(), generateArtisticPath()]);
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Premium Fabric Texture Overlay */}
      <div className="absolute inset-0 opacity-[0.08] mix-blend-overlay" style={{ 
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        backgroundSize: '150px 150px'
      }}></div>

      <svg width="100%" height="100%" viewBox="0 0 1000 400" preserveAspectRatio="none" className="opacity-70">
        <defs>
          <filter id="needleGlow">
            <feGaussianBlur stdDeviation="4" result="blur"/>
            <feComposite in="SourceGraphic" in2="blur" operator="over"/>
          </filter>
          <linearGradient id="needleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="40%" stopColor="#cbd5e1" />
            <stop offset="100%" stopColor="#64748b" />
          </linearGradient>
          <linearGradient id="threadGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f472b6" />
            <stop offset="50%" stopColor="#ec4899" />
            <stop offset="100%" stopColor="#db2777" />
          </linearGradient>
          <filter id="stitchShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="1.5" />
            <feOffset dx="1" dy="2" result="offsetblur" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.4" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        
        {paths.map((item, i) => (
          <g key={i}>
            {/* Highly Visible Stitch Holes */}
            {item.points.map((pt, idx) => (
              <motion.g
                key={idx}
                initial={{ opacity: 0 }}
                animate={{ 
                  opacity: [0, 1, 1, 0],
                  scale: [0.8, 1, 1, 0.8]
                }}
                transition={{ 
                  duration: 20,
                  repeat: Infinity,
                  delay: (i * 10) + (idx * 1.25),
                  times: [0, 0.1, 0.85, 1]
                }}
              >
                {/* Deep Hole in Fabric */}
                <circle cx={pt.x} cy={pt.y} r="4" fill="#1e0a1e" opacity="0.4" />
                {/* Bright Stitch Knot - Essential for visibility */}
                <circle cx={pt.x} cy={pt.y} r="2" fill="white" />
                {/* Fabric Tension Highlight */}
                <path d={`M ${pt.x-3} ${pt.y-1} A 3 3 0 0 1 ${pt.x+3} ${pt.y-1}`} fill="none" stroke="white" strokeWidth="0.8" opacity="0.4" />
              </motion.g>
            ))}

            {/* Thick, Premium Thread */}
            <motion.path
              d={item.path}
              fill="transparent"
              stroke="url(#threadGradient)"
              strokeWidth="6"
              strokeDasharray="12 6"
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ 
                pathLength: [0, 1, 1], 
                opacity: [0, 1, 1, 0] 
              }}
              transition={{ 
                duration: 20, 
                repeat: Infinity, 
                delay: i * 10,
                ease: "linear",
                times: [0, 0.85, 0.95, 1]
              }}
              style={{ filter: 'url(#stitchShadow)' }}
            />
            
            {/* Prominent 3D Needle */}
            <motion.g
              initial={{ opacity: 0 }}
              animate={{ 
                opacity: [0, 1, 1, 0],
                offsetDistance: ["0%", "100%", "100%", "100%"]
              }}
              transition={{ 
                duration: 20, 
                repeat: Infinity, 
                delay: i * 10,
                ease: "linear",
                times: [0, 0.02, 0.85, 1]
              }}
              style={{ 
                offsetPath: `path("${item.path}")`,
                offsetRotate: "auto 90deg"
              }}
            >
              {/* Rhythmic Stitching Motion */}
              <motion.g
                animate={{ 
                  y: [0, -25, 0],
                  scale: [1, 1.25, 1]
                }}
                transition={{ 
                  duration: 0.8, 
                  repeat: Infinity, 
                  ease: "easeInOut" 
                }}
              >
                {/* Needle Body - Large and Shiny */}
                <path 
                  d="M 0 0 L 0 -65 L -2 -62 L 2 -62 Z" 
                  fill="url(#needleGrad)" 
                  stroke="#0f172a" 
                  strokeWidth="0.6"
                />
                
                {/* Large Needle Eye */}
                <ellipse cx="0" cy="-55" rx="1.5" ry="5" fill="#020617" />
                
                {/* Thread passing through Eye */}
                <motion.circle 
                  cx="0" cy="-55" r="2.5" 
                  fill="#f472b6" 
                  animate={{ scale: [1, 1.5, 1] }}
                  transition={{ duration: 0.4, repeat: Infinity }}
                />

                {/* Intense Tip Sparkle for visibility */}
                <motion.circle 
                  r="7" 
                  fill="white" 
                  filter="url(#needleGlow)"
                  animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.8, 1] }}
                  transition={{ duration: 0.6, repeat: Infinity }}
                />
              </motion.g>
            </motion.g>
          </g>
        ))}
      </svg>
    </div>
  );
};

import { API_BASE_URL } from '../config';

export default function Catalog({ user }: CatalogProps) {
  const { setCurrentPageId } = usePresence();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  
  useEffect(() => {
    setCurrentPageId('home');
    return () => setCurrentPageId(null);
  }, [setCurrentPageId]);
  const [config, setConfig] = useState<AppConfig>({ buttonsEnabled: true });
  const [searchTerm, setSearchTerm] = useState('');
  const [category, setCategory] = useState('Todas');
  const [currentTab, setCurrentTab] = useState<'catalog' | 'my-matrices'>('catalog');
  const [loading, setLoading] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastPurchased, setLastPurchased] = useState<Product | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [zoomProduct, setZoomProduct] = useState<Product | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: 'buy' | 'download', product: Product } | null>(null);

  useEffect(() => {
    // If user logs in and there's a pending action, execute it
    if (user && pendingAction) {
      if (pendingAction.type === 'buy') handleBuy(pendingAction.product);
      else if (pendingAction.type === 'download') handleDownload(pendingAction.product);
      setPendingAction(null);
    }
  }, [user, pendingAction]);

  useEffect(() => {
    // Load config and favorites locally
    setConfig(storage.getConfig());
    setFavorites(storage.getFavorites());
    
    // Subscribe to real-time products from RTDB
    const unsubscribe = storage.subscribeToProducts((rtdbProducts) => {
      if (rtdbProducts && rtdbProducts.length > 0) {
        setProducts(rtdbProducts);
        // Only save to local storage if we actually got data from RTDB
        storage.saveProducts(rtdbProducts);
      } else {
        // If RTDB is empty, load from local storage
        const localProducts = storage.getProducts();
        setProducts(localProducts);
      }
      setLoading(false);
    });

    // Poll for config and favorites (still local for now)
    const interval = setInterval(() => {
      setConfig(storage.getConfig());
      setFavorites(storage.getFavorites());
    }, 5000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const orders = storage.getOrders();
  const userPurchasedIds = user ? orders.filter(o => o.userId === user.id).map(o => o.productId) : [];

  const categories = ['Todas', ...Array.from(new Set(products.map(p => p.category)))];

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (currentTab === 'my-matrices') {
      return matchesSearch && userPurchasedIds.includes(product.id);
    }

    const matchesCategory = category === 'Todas' || product.category === category;
    return matchesSearch && matchesCategory;
  });

  const handleBuy = async (product: Product) => {
    if (!config.buttonsEnabled) return;
    if (!user) {
      setPendingAction({ type: 'buy', product });
      setShowLoginModal(true);
      return;
    }
    
    try {
      // 1. Registrar na API (vínculo permanente)
      await fetch(API_BASE_URL + "/api/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, fileId: product.id })
      });

      // 2. Lógica local existente (orders)
      const orders = storage.getOrders();
      const newOrder = {
        id: Math.random().toString(36).substr(2, 9),
        userId: user.id,
        productId: product.id,
        status: 'completed',
        amount: product.price,
        createdAt: new Date().toISOString(),
      };
      
      storage.saveOrders([...orders, newOrder]);
      
      // Increment sold count
      const allProducts = storage.getProducts();
      const updatedProducts = allProducts.map(p => 
        p.id === product.id ? { ...p, soldCount: (p.soldCount || 0) + 1 } : p
      );
      storage.saveProducts(updatedProducts);
      await storage.syncProductsToRTDB(updatedProducts); // Sync to RTDB
      
      setProducts(updatedProducts);
      setLastPurchased(product);
      setShowSuccess(true);
    } catch (err) {
      console.error("Erro ao processar compra:", err);
      alert("Erro ao processar compra. Tente novamente.");
    }
  };

  const handleToggleFavorite = (productId: string) => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    storage.toggleFavorite(productId);
    setFavorites(storage.getFavorites());
  };

  const handleDownload = async (product: Product) => {
    if (!user) {
      setPendingAction({ type: 'download', product });
      setShowLoginModal(true);
      return;
    }
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
      // Use original format if possible, otherwise default to PES
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

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white h-[450px] rounded-3xl animate-pulse shadow-md" />
        ))}
      </div>
    );
  }

  const isOwner = user?.email === 'bryannogueira07@gmail.com';

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="relative h-[300px] md:h-[400px] rounded-[32px] md:rounded-[40px] overflow-hidden shadow-2xl bg-pink-600">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
        
        <EmbroideryAnimation />

        <div className="absolute inset-0 bg-gradient-to-r from-pink-600/60 to-transparent flex items-center px-6 md:px-12">
          <div className="max-w-xl text-white relative z-10">
            <div className="mb-4">
              <GlobalPresenceBadge />
            </div>
            <motion.h1 
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-3xl md:text-5xl font-black mb-2 md:mb-4 leading-tight drop-shadow-lg"
            >
              Bem-vinda ao Mundo do Bordado!
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="text-lg md:text-2xl font-medium mb-6 md:mb-8 opacity-95 drop-shadow-md"
            >
              As matrizes mais lindas e exclusivas para seus projetos.
            </motion.p>
            <div className="flex flex-wrap gap-3 md:gap-4">
              <motion.button 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 }}
                onClick={() => document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' })}
                className="bg-white text-pink-600 px-6 md:px-10 py-3 md:py-4 rounded-full text-lg md:text-2xl font-bold shadow-xl hover:bg-pink-50 transition-all active:scale-95 cursor-pointer"
              >
                Ver Catálogo
              </motion.button>
              {isOwner && (
                <motion.button 
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6 }}
                  onClick={() => navigate('/owner')}
                  className="bg-pink-700 text-white px-6 md:px-10 py-3 md:py-4 rounded-full text-lg md:text-2xl font-bold shadow-xl hover:bg-pink-800 transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
                >
                  <Shield size={20} className="md:w-7 md:h-7" />
                  Painel
                </motion.button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Filters & Tabs */}
      <div id="catalog" className="space-y-6">
        <div className="flex items-center justify-center gap-4 bg-gray-100 p-2 rounded-2xl w-fit mx-auto">
          <button
            onClick={() => setCurrentTab('catalog')}
            className={cn(
              "px-8 py-3 rounded-xl font-bold transition-all cursor-pointer",
              currentTab === 'catalog' ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            )}
          >
            Catálogo
          </button>
          <button
            onClick={() => {
              if (!user) navigate('/login');
              else setCurrentTab('my-matrices');
            }}
            className={cn(
              "px-8 py-3 rounded-xl font-bold transition-all cursor-pointer",
              currentTab === 'my-matrices' ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            )}
          >
            Minhas Matrizes
          </button>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-lg flex flex-col md:flex-row gap-6 items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder={currentTab === 'catalog' ? "Buscar matriz..." : "Buscar em minhas matrizes..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 rounded-2xl border border-gray-100 bg-gray-50 focus:ring-2 focus:ring-pink-500 outline-none text-xl"
            />
          </div>
          
          {currentTab === 'catalog' && (
            <div className="flex items-center gap-4 overflow-x-auto pb-2 w-full md:w-auto">
              <button 
                onClick={() => setProducts(storage.getProducts())}
                className="p-3 bg-pink-50 text-pink-600 rounded-full hover:bg-pink-100 transition-all cursor-pointer"
                title="Atualizar Matrizes"
              >
                <RefreshCw size={20} />
              </button>
              <Filter className="text-pink-500 shrink-0" />
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={cn(
                    "px-6 py-3 rounded-full text-lg font-bold whitespace-nowrap transition-all cursor-pointer",
                    category === cat ? 'bg-pink-500 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredProducts.map(product => (
          <motion.div
            key={product.id}
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[40px] overflow-hidden shadow-xl border border-pink-50 group hover:shadow-2xl transition-all"
          >
            <Link 
              to={`/product/${product.id}`} 
              className="relative h-64 bg-gray-50 flex items-center justify-center overflow-hidden cursor-pointer block group"
            >
              <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
              {product.imageUrl ? (
                <img 
                  src={product.imageUrl} 
                  alt={product.name}
                  className="w-full h-full object-contain p-4 group-hover:scale-110 transition-transform duration-500 relative z-10"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-purple-300 group-hover:scale-110 transition-transform duration-500 relative z-10">
                  <Flower2 size={80} strokeWidth={1} />
                  <p className="mt-4 font-mono text-xs uppercase tracking-widest text-purple-400">Matriz Técnica</p>
                  <p className="text-[10px] font-mono text-purple-300 mt-1">{product.fileName || 'Arquivo de Bordado'}</p>
                </div>
              )}
              <div className="absolute top-4 left-4 z-20">
                <button 
                  onClick={(e) => { 
                    e.preventDefault(); 
                    e.stopPropagation(); 
                    setZoomProduct(product);
                  }}
                  className="p-3 bg-white/90 text-gray-700 rounded-full shadow-md hover:bg-white transition-all cursor-pointer flex items-center gap-2"
                  title="Zoom nos pontos"
                >
                  <Search size={20} />
                  <span className="text-sm font-bold">Zoom</span>
                </button>
              </div>
              <div className="absolute top-4 right-4 z-20">
                <button 
                  onClick={(e) => { 
                    e.preventDefault(); 
                    e.stopPropagation(); 
                    handleToggleFavorite(product.id);
                  }}
                  className={cn(
                    "p-3 rounded-full shadow-md transition-all cursor-pointer",
                    favorites.includes(product.id)
                      ? "bg-pink-500 text-white"
                      : "bg-white/90 text-pink-500 hover:bg-pink-500 hover:text-white"
                  )}
                >
                  <Heart size={24} fill={favorites.includes(product.id) ? "currentColor" : "none"} />
                </button>
              </div>
              <div className="absolute bottom-4 left-4 z-20 flex flex-col gap-2">
                <span className="bg-pink-500 text-white px-4 py-1 rounded-full font-bold text-sm">
                  {product.category}
                </span>
                <span className="bg-white/90 text-pink-600 px-3 py-1 rounded-full font-black text-[10px] uppercase tracking-tighter shadow-sm flex items-center gap-1">
                  <CheckCircle2 size={10} />
                  Fidelidade Técnica
                </span>
              </div>
            </Link>
            <div className="p-6 md:p-8">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl md:text-2xl font-bold text-gray-800 truncate">{product.name}</h3>
                <div className="flex items-center gap-1 bg-green-50 text-green-700 px-2 md:px-3 py-1 rounded-full text-[10px] md:text-xs font-black border border-green-100 shrink-0">
                  <TrendingUp size={10} className="md:w-3 md:h-3" />
                  {product.soldCount || 0}
                </div>
              </div>
              
              <div className="flex items-center gap-1 mb-4">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star 
                    key={s} 
                    size={12} 
                    className={cn(
                      "fill-current",
                      s <= ((product.reviews || []).reduce((acc, r) => acc + r.rating, 0) / (product.reviews?.length || 1))
                        ? "text-yellow-400" 
                        : "text-gray-200"
                    )} 
                  />
                ))}
                <span className="text-[10px] text-gray-400 font-bold ml-1">({product.reviews?.length || 0})</span>
              </div>

              <p className="text-gray-500 text-sm md:text-lg mb-6 line-clamp-2 h-10 md:h-14">{product.description}</p>
              <div className="flex items-center justify-between gap-2">
                <span className="text-2xl md:text-3xl font-black text-pink-600 whitespace-nowrap">
                  R$ {product.price.toFixed(2)}
                </span>
                {userPurchasedIds.includes(product.id) ? (
                  <button 
                    onClick={() => handleDownload(product)}
                    disabled={isDownloading}
                    className="px-4 md:px-8 py-3 md:py-4 bg-green-500 text-white rounded-xl md:rounded-2xl text-base md:text-xl font-bold shadow-lg hover:bg-green-600 active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Download size={20} className="md:w-6 md:h-6" />
                    <span className="hidden sm:inline">{isDownloading ? `Baixando... ${downloadProgress}%` : 'Baixar'}</span>
                    <span className="sm:hidden">{isDownloading ? `${downloadProgress}%` : 'Baixar'}</span>
                  </button>
                ) : (
                  <button 
                    onClick={() => handleBuy(product)}
                    disabled={!config.buttonsEnabled}
                    className={cn(
                      "px-4 md:px-8 py-3 md:py-4 rounded-xl md:rounded-2xl text-base md:text-xl font-bold shadow-lg active:scale-95 transition-all flex items-center gap-2",
                      config.buttonsEnabled 
                        ? 'bg-pink-500 text-white hover:bg-pink-600 cursor-pointer' 
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    )}
                  >
                    {config.buttonsEnabled ? <ShoppingCart size={20} className="md:w-6 md:h-6" /> : <AlertTriangle size={20} className="md:w-6 md:h-6" />}
                    <span className="hidden sm:inline">{config.buttonsEnabled ? 'Comprar' : 'Indisponível'}</span>
                    <span className="sm:hidden">{config.buttonsEnabled ? 'Comprar' : 'Off'}</span>
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Zoom Modal */}
      <AnimatePresence>
        {zoomProduct && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-black/90 backdrop-blur-sm"
            onClick={() => setZoomProduct(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-5xl w-full bg-white rounded-[40px] overflow-hidden shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <button 
                onClick={() => setZoomProduct(null)}
                className="absolute top-6 right-6 z-10 p-3 bg-black/10 hover:bg-black/20 rounded-full transition-all cursor-pointer"
              >
                <X size={24} />
              </button>
              
              <div className="flex flex-col md:flex-row h-full max-h-[90vh]">
                <div className="md:w-2/3 bg-gray-50 flex items-center justify-center p-8 overflow-hidden relative group">
                  <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '10px 10px' }}></div>
                  <motion.img 
                    src={zoomProduct.imageUrl} 
                    alt={zoomProduct.name}
                    className="w-full h-full object-contain relative z-10 cursor-zoom-in"
                    drag
                    dragConstraints={{ left: -500, right: 500, top: -500, bottom: 500 }}
                    whileTap={{ scale: 1.5 }}
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/50 text-white px-4 py-2 rounded-full text-sm backdrop-blur-md z-20">
                    Clique e arraste para ver os detalhes dos pontos
                  </div>
                </div>
                
                <div className="md:w-1/3 p-8 space-y-6 flex flex-col justify-center">
                  <div>
                    <h2 className="text-3xl font-black text-gray-900 mb-2">{zoomProduct.name}</h2>
                    <p className="text-pink-600 font-bold text-xl">{zoomProduct.category}</p>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-gray-600">
                      <CheckCircle2 className="text-green-500" size={20} />
                      <span className="font-medium">Preview Real do Bordado</span>
                    </div>
                    <div className="flex items-center gap-3 text-gray-600">
                      <CheckCircle2 className="text-green-500" size={20} />
                      <span className="font-medium">Alta Resolução de Pontos</span>
                    </div>
                    <div className="flex items-center gap-3 text-gray-600">
                      <CheckCircle2 className="text-green-500" size={20} />
                      <span className="font-medium">Fundo Transparente</span>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-gray-100">
                    <p className="text-gray-500 text-sm mb-4">
                      Este preview simula exatamente como a máquina irá bordar os pontos, garantindo fidelidade total ao projeto original.
                    </p>
                    {userPurchasedIds.includes(zoomProduct.id) ? (
                      <button 
                        onClick={() => handleDownload(zoomProduct)}
                        className="w-full bg-green-500 text-white py-4 rounded-2xl font-bold text-xl shadow-lg hover:bg-green-600 transition-all flex items-center justify-center gap-3"
                      >
                        <Download size={24} />
                        Baixar Agora
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleBuy(zoomProduct)}
                        className="w-full bg-pink-600 text-white py-4 rounded-2xl font-bold text-xl shadow-lg hover:bg-pink-700 transition-all flex items-center justify-center gap-3"
                      >
                        <ShoppingCart size={24} />
                        Comprar Matriz
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Modal */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <div className="bg-white p-12 rounded-[50px] text-center max-w-md shadow-2xl">
              <div className="bg-green-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="text-green-600 w-16 h-16" />
              </div>
              <h2 className="text-4xl font-black text-gray-800 mb-4">Sucesso!</h2>
              
              {lastPurchased && (
                <div className="mb-6 flex flex-col items-center">
                  <div className="w-32 h-32 rounded-2xl overflow-hidden bg-gray-50 border border-gray-100 flex items-center justify-center relative mb-4">
                    <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '10px 10px' }}></div>
                    {lastPurchased.imageUrl ? (
                      <img src={lastPurchased.imageUrl} alt={lastPurchased.name} className="w-full h-full object-contain p-2 relative z-10" />
                    ) : (
                      <div className="text-purple-300 relative z-10">
                        <Flower2 size={64} strokeWidth={1} />
                      </div>
                    )}
                  </div>
                  <p className="text-xl text-gray-600">
                    Sua matriz <strong>{lastPurchased.name}</strong> foi enviada para seu e-mail e WhatsApp.
                  </p>
                </div>
              )}
              
              {lastPurchased?.fileUrl && (
                <div className="mb-8 p-6 bg-purple-50 rounded-3xl border-2 border-purple-100">
                  <p className="text-purple-700 font-bold mb-4">Sua matriz está pronta para baixar em PES:</p>
                  <button
                    onClick={() => handleDownload(lastPurchased)}
                    disabled={isDownloading}
                    className="inline-flex items-center gap-2 bg-purple-600 text-white px-8 py-4 rounded-2xl text-xl font-bold hover:bg-purple-700 transition-all shadow-lg disabled:bg-gray-400 cursor-pointer"
                  >
                    {isDownloading ? (
                      <>
                        <RefreshCw className="animate-spin" size={24} />
                        Processando {downloadProgress}%
                      </>
                    ) : (
                      <>
                        <Download size={24} />
                        Baixar Arquivo PES
                      </>
                    )}
                  </button>
                </div>
              )}

              <button 
                onClick={() => setShowSuccess(false)}
                className="text-gray-500 font-bold hover:text-gray-700 transition-all cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Login Modal */}
      <AnimatePresence>
        {showLoginModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white p-8 md:p-12 rounded-[40px] max-w-md w-full text-center shadow-2xl border border-pink-100"
            >
              <div className="bg-pink-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Shield className="text-pink-600 w-10 h-10" />
              </div>
              <h2 className="text-3xl font-black text-gray-800 mb-4">Acesso Restrito</h2>
              <p className="text-gray-500 mb-8 font-medium">
                Para baixar ou comprar matrizes, você precisa estar logada em sua conta.
              </p>
              
              <div className="space-y-4">
                <button
                  onClick={() => navigate('/login')}
                  className="w-full bg-pink-500 text-white py-4 rounded-2xl font-bold text-xl shadow-lg hover:bg-pink-600 transition-all active:scale-95 cursor-pointer"
                >
                  Fazer Login
                </button>
                <button
                  onClick={() => navigate('/register')}
                  className="w-full bg-gray-100 text-gray-600 py-4 rounded-2xl font-bold text-xl hover:bg-gray-200 transition-all active:scale-95 cursor-pointer"
                >
                  Criar Conta Grátis
                </button>
                <button
                  onClick={() => setShowLoginModal(false)}
                  className="text-gray-400 font-bold hover:text-gray-600 transition-all cursor-pointer pt-2"
                >
                  Continuar Navegando
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
