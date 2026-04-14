import { useState, useEffect, ChangeEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  Download, 
  Settings, 
  CheckCircle2, 
  FileCode, 
  Info, 
  Cpu, 
  Layers, 
  Maximize2,
  RefreshCw,
  AlertCircle,
  ShoppingCart,
  Shield,
  Star,
  User,
  MessageSquare,
  TrendingUp,
  LogIn,
  UserPlus,
  Camera,
  Plus,
  Trash2,
  Loader2,
  Image as ImageIcon
} from 'lucide-react';
import { storage, Product, User as UserType, fileToBase64, compressImage } from '../services/storage';
import { EmbroideryConverter } from '../services/converter';
import { usePresence } from '../services/presence';
import { PagePresenceBadge } from './PresenceBadge';
import { cn } from '../lib/utils';

interface ProductDetailProps {
  user: UserType | null;
}

import { API_BASE_URL } from '../config';

export default function ProductDetail({ user }: ProductDetailProps) {
  const { setCurrentPageId } = usePresence();
  const { id } = useParams<{ id: string }>();
  
  useEffect(() => {
    if (id) {
      setCurrentPageId(id);
    }
    return () => setCurrentPageId(null);
  }, [id, setCurrentPageId]);
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<'PES' | 'JEF'>('PES');
  const [isConverting, setIsConverting] = useState(false);
  const [conversionProgress, setConversionProgress] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isPurchased, setIsPurchased] = useState(false);
  const [reviewForm, setReviewForm] = useState({
    rating: 5,
    comment: '',
    imageUrl: ''
  });
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<'buy' | 'download' | null>(null);

  useEffect(() => {
    if (user && pendingAction) {
      if (pendingAction === 'buy') handlePurchase();
      else if (pendingAction === 'download') handleConvertAndDownload();
      setPendingAction(null);
    }
  }, [user, pendingAction]);

  const displayFormat = selectedFormat === 'JEF' ? 'JEFF' : selectedFormat;

  const handleReviewImageChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const base64 = await fileToBase64(file);
      const compressed = await compressImage(base64, 800, 0.6);
      setReviewForm(prev => ({ ...prev, imageUrl: compressed }));
    } catch (err) {
      console.error("Erro ao carregar imagem da avaliação:", err);
    }
  };

  const handleSubmitReview = async () => {
    if (!user) return;
    if (!reviewForm.comment.trim()) {
      alert("Por favor, escreva um comentário.");
      return;
    }

    setIsSubmittingReview(true);
    
    const newReview = {
      id: Math.random().toString(36).substr(2, 9),
      userName: user.name,
      rating: reviewForm.rating,
      comment: reviewForm.comment,
      date: new Date().toISOString(),
      imageUrl: reviewForm.imageUrl
    };

    const allProducts = storage.getProducts();
    const updatedProducts = allProducts.map(p => {
      if (p.id === product?.id) {
        return {
          ...p,
          reviews: [newReview, ...(p.reviews || [])]
        };
      }
      return p;
    });

    storage.saveProducts(updatedProducts);
    try {
      await storage.syncProductsToRTDB(updatedProducts); // Sync to RTDB
    } catch (err: any) {
      console.error("Erro ao sincronizar avaliação:", err);
      if (err.message?.includes('PERMISSION_DENIED') || err.code === 'PERMISSION_DENIED') {
        console.warn("Avaliação salva localmente, mas falhou ao sincronizar (Permissão Negada).");
      }
    }
    setProduct(prev => prev ? { ...prev, reviews: [newReview, ...(prev.reviews || [])] } : null);
    
    // Reset form
    setReviewForm({ rating: 5, comment: '', imageUrl: '' });
    setIsSubmittingReview(false);
    alert("Avaliação enviada com sucesso!");
  };

  useEffect(() => {
    if (!id) return;

    // Subscribe to real-time products from RTDB
    const unsubscribe = storage.subscribeToProducts((rtdbProducts) => {
      const found = rtdbProducts.find(p => String(p.id) === String(id));
      if (found) {
        setProduct(found);
        
        // Detect original format from filename ONLY if not already set
        if (!product) {
          if (found.fileName?.toLowerCase().endsWith('.jef')) {
            setSelectedFormat('JEF');
          } else {
            setSelectedFormat('PES');
          }
        }

        // Check if already purchased
        const currentUser = storage.getCurrentUser();
        if (currentUser) {
          const orders = storage.getOrders();
          const hasPurchased = orders.some(o => o.userId === currentUser.id && o.productId === found.id);
          setIsPurchased(hasPurchased);
        }
      } else {
        // If not found in RTDB, try local storage as fallback
        const localProducts = storage.getProducts();
        const localFound = localProducts.find(p => String(p.id) === String(id));
        if (localFound) {
          setProduct(localFound);
        }
      }
    });

    return () => unsubscribe();
  }, [id]);

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pink-50">
        <div className="text-center">
          <AlertCircle size={48} className="mx-auto text-pink-500 mb-4" />
          <h2 className="text-2xl font-bold text-gray-800">Produto não encontrado</h2>
          <div className="flex flex-col gap-2 mt-4">
            <button 
              onClick={() => window.location.reload()}
              className="bg-pink-500 text-white px-6 py-2 rounded-xl font-bold hover:bg-pink-600 transition-all"
            >
              Tentar novamente
            </button>
            <button 
              onClick={() => navigate('/')}
              className="text-pink-600 font-bold hover:underline"
            >
              Voltar para o catálogo
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handlePurchase = async () => {
    if (!user) {
      setPendingAction('buy');
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

      // 2. Lógica local existente
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
      
      setProduct(prev => prev ? { ...prev, soldCount: (prev.soldCount || 0) + 1 } : null);
      setIsPurchased(true);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      console.error("Erro ao processar compra:", err);
      alert("Erro ao processar compra. Tente novamente.");
    }
  };

  const handleConvertAndDownload = async () => {
    if (!user) {
      setPendingAction('download');
      setShowLoginModal(true);
      return;
    }
    if (!isPurchased) {
      handlePurchase();
      return;
    }

    setIsConverting(true);
    setConversionProgress(0);

    try {
      // 1. Fetch original file data
      setConversionProgress(10);
      let fileData: ArrayBuffer;
      
      if (product.fileUrl?.startsWith('data:')) {
        try {
          // Convert base64 to ArrayBuffer
          const base64 = product.fileUrl.split(',')[1];
          if (!base64) throw new Error("Base64 data is empty");
          
          const binary = atob(base64);
          fileData = new ArrayBuffer(binary.length);
          const view = new Uint8Array(fileData);
          for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
        } catch (e) {
          console.warn("Falha ao decodificar base64, usando buffer vazio:", e);
          fileData = new ArrayBuffer(0);
        }
      } else if (product.fileUrl && product.fileUrl.startsWith('http')) {
        try {
          // Fetch from URL
          const response = await fetch(product.fileUrl);
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          fileData = await response.arrayBuffer();
        } catch (e) {
          console.warn("Falha ao buscar arquivo remoto, usando buffer vazio:", e);
          fileData = new ArrayBuffer(0);
        }
      } else {
        // Fallback to empty buffer if no file or invalid URL
        fileData = new ArrayBuffer(0);
      }

      setConversionProgress(30);
      
      // 2. Perform real conversion
      // The converter now handles empty buffers by returning a mock file
      const convertedData = await EmbroideryConverter.convert(fileData, selectedFormat);
      setConversionProgress(70);
      
      // 3. Create blob and download
      const blob = new Blob([convertedData], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      
      setConversionProgress(100);
      await new Promise(resolve => setTimeout(resolve, 500));

      const link = document.createElement('a');
      link.href = url;
      const baseName = product.fileName?.split('.')[0] || 'bordado';
      link.download = `${baseName}.${selectedFormat.toLowerCase()}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erro na conversão:', error);
      alert('Ocorreu um erro ao converter o arquivo. Por favor, tente novamente.');
    } finally {
      setIsConverting(false);
    }
  };

  const originalFormat = product.fileName?.split('.').pop()?.toUpperCase() || 'PES';

  return (
    <div className="max-w-6xl mx-auto py-6 md:py-12 px-4">
      <button 
        onClick={() => navigate('/')}
        className="flex items-center gap-2 text-pink-600 font-bold mb-6 md:mb-8 hover:gap-3 transition-all cursor-pointer"
      >
        <ArrowLeft size={20} />
        Voltar para o Catálogo
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 bg-white p-4 md:p-8 rounded-[32px] md:rounded-[40px] shadow-2xl border border-pink-100">
        {/* Left: Image and Technical Details */}
        <div className="space-y-6 md:space-y-8">
          <div className="relative aspect-square rounded-[24px] md:rounded-[32px] overflow-hidden bg-gray-50 border-4 border-pink-50 group">
            <img 
              src={product.imageUrl} 
              alt={product.name}
              className="w-full h-full object-contain p-4"
              referrerPolicy="no-referrer"
            />
            <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 md:px-4 py-1.5 md:py-2 rounded-xl md:rounded-2xl shadow-sm flex items-center gap-2 border border-pink-100">
              <CheckCircle2 size={14} className="text-pink-500 md:w-4 md:h-4" />
              <span className="text-[10px] md:text-xs font-black text-pink-600 uppercase tracking-tighter">Fidelidade Técnica</span>
            </div>
          </div>

          <div className="bg-gray-50 p-6 md:p-8 rounded-[24px] md:rounded-[32px] border border-gray-100">
            <h3 className="text-lg md:text-xl font-black text-gray-800 mb-4 md:mb-6 flex items-center gap-2">
              <Info className="text-pink-500 md:w-6 md:h-6" /> Especificações
            </h3>
            <div className="space-y-3 md:space-y-4">
              <div className="flex justify-between py-2 md:py-3 border-b border-gray-200">
                <span className="text-gray-500 font-bold text-sm md:text-base">Formato</span>
                <span className="text-gray-800 font-black text-sm md:text-base">{displayFormat}</span>
              </div>
              <div className="flex justify-between py-2 md:py-3 border-b border-gray-200">
                <span className="text-gray-500 font-bold text-sm md:text-base">Compatibilidade</span>
                <span className="text-gray-800 font-black text-sm md:text-base">PES, JEF, DST, EXP</span>
              </div>
              <div className="flex justify-between py-2 md:py-3">
                <span className="text-gray-500 font-bold text-sm md:text-base">Qualidade</span>
                <span className="text-pink-600 font-black text-sm md:text-base">Premium</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Info and Conversion */}
        <div className="flex flex-col">
          <div className="mb-6 md:mb-8">
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <span className="inline-block bg-pink-100 text-pink-600 px-4 py-1 rounded-full font-bold text-xs md:text-sm">
                {product.category}
              </span>
              <PagePresenceBadge />
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-gray-900 mb-3 md:mb-4 leading-tight">{product.name}</h1>
            <p className="text-lg md:text-xl text-gray-600 leading-relaxed">{product.description}</p>
          </div>

            <div className="flex flex-wrap items-center gap-4 md:gap-6 mb-6 md:mb-8">
              <div className="flex items-center gap-2 bg-green-50 text-green-700 px-3 md:px-4 py-1.5 md:py-2 rounded-xl md:rounded-2xl border border-green-100">
                <TrendingUp size={18} className="md:w-5 md:h-5" />
                <span className="font-black text-base md:text-lg">{product.soldCount} vendidos</span>
              </div>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star 
                    key={star} 
                    size={16} 
                    className={cn(
                      "fill-current md:w-5 md:h-5",
                      star <= ((product.reviews || []).reduce((acc, r) => acc + r.rating, 0) / (product.reviews?.length || 1))
                        ? "text-yellow-400" 
                        : "text-gray-200"
                    )} 
                  />
                ))}
                <span className="ml-2 text-gray-500 font-bold text-sm md:text-base">({product.reviews?.length || 0})</span>
              </div>
            </div>

            <div className="bg-gray-50 rounded-[24px] md:rounded-[32px] p-6 md:p-8 border border-gray-100 mb-6 md:mb-8">
            <div className="flex items-center justify-between mb-4 md:mb-6">
              <div className="flex items-center gap-3">
                <Settings className="text-pink-500 md:w-6 md:h-6" />
                <h3 className="text-lg md:text-xl font-bold text-gray-800">Selecione o Formato</h3>
              </div>
            </div>

            <div className="space-y-4 md:space-y-6">
              <div>
                <label className="block text-[10px] md:text-sm font-bold text-gray-500 uppercase tracking-widest mb-2 md:mb-3">
                  Escolha o modelo do arquivo
                </label>
                <div className="grid grid-cols-2 gap-3 md:gap-4">
                  {['PES', 'JEF'].map((format) => (
                    <button
                      key={format}
                      onClick={() => setSelectedFormat(format as 'PES' | 'JEF')}
                      className={cn(
                        "py-3 md:py-4 px-4 md:px-6 rounded-xl md:rounded-2xl font-black text-lg md:text-xl transition-all border-2 flex items-center justify-center gap-2 md:gap-3 cursor-pointer",
                        selectedFormat === format 
                          ? "bg-pink-500 border-pink-500 text-white shadow-lg shadow-pink-200 scale-[1.02]" 
                          : "bg-white border-gray-200 text-gray-400 hover:border-pink-200 hover:text-pink-400"
                      )}
                    >
                      <FileCode size={20} className="md:w-6 md:h-6" />
                      {format}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-2xl flex items-start gap-3 border border-blue-100">
                <Cpu size={20} className="text-blue-500 shrink-0 mt-1" />
                <p className="text-sm text-blue-700 leading-snug">
                  <strong>Conversão Garantida:</strong> Ao baixar em <strong>{displayFormat}</strong>, garantimos que o arquivo 
                  seja gerado com precisão absoluta para sua máquina de bordar.
                </p>
              </div>

              {!user && (
                <div className="bg-pink-50 p-6 rounded-2xl border border-pink-100 text-center">
                  <p className="text-pink-700 font-bold mb-4">Você precisa estar logado para comprar.</p>
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={() => {
                        sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
                        navigate('/login');
                      }}
                      className="w-full bg-pink-500 text-white py-3 rounded-xl font-bold hover:bg-pink-600 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <LogIn size={20} />
                      Entrar agora
                    </button>
                    <button
                      onClick={() => {
                        sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
                        navigate('/register');
                      }}
                      className="w-full bg-white text-pink-500 border-2 border-pink-500 py-3 rounded-xl font-bold hover:bg-pink-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <UserPlus size={20} />
                      Criar minha conta
                    </button>
                    <button
                      onClick={() => navigate('/')}
                      className="w-full text-gray-500 font-medium hover:text-pink-500 transition-colors flex items-center justify-center gap-2 mt-2 cursor-pointer"
                    >
                      <ArrowLeft size={18} />
                      Voltar para o Início
                    </button>
                  </div>
                </div>
              )}

              {user && (
                <button
                  onClick={handleConvertAndDownload}
                  disabled={isConverting}
                  className={cn(
                    "w-full py-4 md:py-6 rounded-2xl md:rounded-3xl font-black text-xl md:text-2xl shadow-xl transition-all flex items-center justify-center gap-3 md:gap-4 relative overflow-hidden active:scale-[0.98] cursor-pointer",
                    isConverting 
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed" 
                      : isPurchased 
                        ? "bg-green-500 text-white hover:bg-green-600 cursor-pointer"
                        : "bg-pink-500 text-white hover:bg-pink-600 cursor-pointer"
                  )}
                >
                  {isConverting ? (
                    <>
                      <RefreshCw className="animate-spin" size={24} />
                      <span>Convertendo... {conversionProgress}%</span>
                    </>
                  ) : isPurchased ? (
                    <>
                      <Download size={24} className="md:w-7 md:h-7" />
                      <span>Baixar em {displayFormat}</span>
                    </>
                  ) : (
                    <>
                      <ShoppingCart size={24} className="md:w-7 md:h-7" />
                      <span>Comprar em {displayFormat}</span>
                    </>
                  )}
                </button>
              )}

              {showSuccess && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center text-green-600 font-bold flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={20} />
                  Compra realizada com sucesso!
                </motion.div>
              )}
            </div>
          </div>

          <div className="mt-auto pt-8 border-t border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm uppercase tracking-widest font-bold mb-1">Valor</p>
              <p className="text-4xl font-black text-pink-600">R$ {product.price.toFixed(2)}</p>
            </div>
            <div className="text-right">
              <p className="text-gray-400 text-sm uppercase tracking-widest font-bold mb-1">Garantia</p>
              <p className="text-lg font-bold text-green-600 flex items-center gap-1">
                <Shield size={18} /> 100% Seguro
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Reviews Section */}
      <div className="mt-12 bg-white p-8 rounded-[40px] shadow-xl border border-pink-50">
        <div className="flex items-center gap-3 mb-8">
          <MessageSquare className="text-pink-500" size={32} />
          <h2 className="text-3xl font-black text-gray-900">Avaliações dos Clientes</h2>
        </div>

        {/* Review Form - Only for logged in users */}
        {user ? (
          <div className="mb-12 bg-pink-50/50 p-6 md:p-8 rounded-3xl border border-pink-100">
            <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <Plus className="text-pink-500" /> Deixe sua Avaliação
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-500 uppercase mb-2">Sua Nota</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map(s => (
                      <button 
                        key={s}
                        onClick={() => setReviewForm({...reviewForm, rating: s})}
                        className={cn(
                          "p-2 rounded-xl transition-all hover:scale-110",
                          reviewForm.rating >= s ? "text-yellow-400" : "text-gray-300"
                        )}
                      >
                        <Star size={32} fill={reviewForm.rating >= s ? "currentColor" : "none"} />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-500 uppercase mb-2">Seu Comentário</label>
                  <textarea 
                    value={reviewForm.comment}
                    onChange={e => setReviewForm({...reviewForm, comment: e.target.value})}
                    rows={4}
                    className="w-full px-4 py-3 rounded-2xl border border-pink-100 focus:ring-2 focus:ring-pink-500 outline-none resize-none bg-white"
                    placeholder="Conte sua experiência com esta matriz..."
                  />
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-500 uppercase mb-2">Foto do Bordado Pronto (Opcional)</label>
                  <div className="flex flex-col gap-4">
                    {!reviewForm.imageUrl ? (
                      <label className="w-full aspect-video rounded-2xl border-2 border-dashed border-pink-200 bg-white flex flex-col items-center justify-center text-pink-400 cursor-pointer hover:bg-pink-50 transition-all">
                        <Camera size={48} strokeWidth={1} />
                        <span className="mt-2 font-bold">Anexar Foto</span>
                        <input type="file" accept="image/*" className="hidden" onChange={handleReviewImageChange} />
                      </label>
                    ) : (
                      <div className="relative w-full aspect-video rounded-2xl overflow-hidden border-2 border-pink-200 group">
                        <img src={reviewForm.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                        <button 
                          onClick={() => setReviewForm({...reviewForm, imageUrl: ''})}
                          className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <button 
                  onClick={handleSubmitReview}
                  disabled={isSubmittingReview}
                  className="w-full bg-pink-500 text-white py-4 rounded-2xl font-black text-xl shadow-lg hover:bg-pink-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmittingReview ? <Loader2 className="animate-spin" /> : <MessageSquare size={24} />}
                  Enviar Avaliação
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-12 p-6 bg-gray-50 rounded-3xl border border-dashed border-gray-200 text-center">
            <p className="text-gray-500 font-bold mb-4">Faça login para avaliar este produto e enviar fotos.</p>
            <button 
              onClick={() => navigate('/login')}
              className="bg-pink-500 text-white px-8 py-3 rounded-xl font-bold hover:bg-pink-600 transition-all"
            >
              Entrar agora
            </button>
          </div>
        )}

        {product.reviews.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {product.reviews.map((review) => (
              <div key={review.id} className="bg-gray-50 p-6 rounded-3xl border border-gray-100 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center text-pink-600">
                      <User size={20} />
                    </div>
                    <div>
                      <p className="font-black text-gray-800">{review.userName}</p>
                      <p className="text-xs text-gray-400">{new Date(review.date).toLocaleDateString('pt-BR')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star 
                        key={s} 
                        size={14} 
                        className={cn(
                          "fill-current",
                          s <= review.rating ? "text-yellow-400" : "text-gray-200"
                        )} 
                      />
                    ))}
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="flex-1">
                    <p className="text-gray-600 leading-relaxed italic">"{review.comment}"</p>
                  </div>
                  {review.imageUrl && (
                    <div className="w-24 h-24 rounded-xl overflow-hidden border border-pink-100 shrink-0">
                      <img src={review.imageUrl} alt="Bordado pronto" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
            <MessageSquare size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 font-bold">Ainda não há avaliações para este produto.</p>
          </div>
        )}
      </div>

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
