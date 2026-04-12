import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Edit, Save, X, Image as ImageIcon, Tag, DollarSign, FileText, UploadCloud, Loader2, Sparkles, CheckCircle2, AlertTriangle, Flower2, MessageSquare, Star, User, TrendingUp, Search, Filter, Users, Settings, Key, Mail, Eye, EyeOff, RefreshCw, Cloud } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { storage, Product, fileToBase64, compressImage, Review } from '../services/storage';
import { analyzeEmbroideryImage, analyzeEmbroideryFilename, generateEmbroideryPreview } from '../services/gemini';
import { cn } from '../lib/utils';

export default function ManagerDashboard() {
  const generateId = () => {
    return 'prod_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  };

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'products' | 'users'>('products');
  const [users, setUsers] = useState<any[]>([]);
  const [apiWarning, setApiWarning] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [userFormData, setUserFormData] = useState<{
    name: string;
    email: string;
    whatsapp: string;
    password?: string;
    active: boolean;
    status: 'active' | 'pending' | 'inactive';
  }>({
    name: '',
    email: '',
    whatsapp: '',
    password: '',
    active: true,
    status: 'active'
  });
  const [isAdding, setIsAdding] = useState(false);
  const [isBulkAdding, setIsBulkAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [managingReviewsId, setManagingReviewsId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [processingFiles, setProcessingFiles] = useState<{ name: string; status: 'pending' | 'processing' | 'done' | 'error' }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [reviewFormData, setReviewFormData] = useState({
    userName: '',
    rating: 5,
    comment: ''
  });

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    soldCount: '0',
    imageUrl: '',
    fileUrl: '',
    fileName: '',
    category: ''
  });

  useEffect(() => {
    // Subscribe to real-time products from RTDB
    const unsubscribeProducts = storage.subscribeToProducts((rtdbProducts) => {
      if (rtdbProducts && rtdbProducts.length > 0) {
        setProducts(rtdbProducts);
        storage.saveProducts(rtdbProducts);
      } else {
        const localProducts = storage.getProducts();
        setProducts(localProducts);
      }
      setLoading(false);
    });

    let unsubscribeUsers: (() => void) | undefined;

    if (activeTab === 'users') {
      setLoading(true);
      
      // Subscribe to RTDB users for real-time updates
      unsubscribeUsers = storage.subscribeToUsers((rtdbUsers) => {
        setUsers(rtdbUsers);
        setLoading(false);
      });

      // Also fetch from Auth to ensure RTDB is up to date
      fetchUsers();
    }

    return () => {
      unsubscribeProducts();
      if (unsubscribeUsers) unsubscribeUsers();
    };
  }, [activeTab]);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users');
      const data = await response.json();
      
      if (data.users && data.users.length > 0) {
        setApiWarning(null);
        const authUids = new Set(data.users.map((u: any) => u.uid));
        
        // 1. Sync missing Auth users to RTDB
        for (const fbUser of data.users) {
          const existing = await storage.getUserFromRTDB(fbUser.uid);
          if (!existing) {
            const newUser: any = {
              id: fbUser.uid,
              name: fbUser.displayName || 'Sem Nome',
              email: fbUser.email,
              whatsapp: '',
              role: fbUser.email === 'bryannogueira07@gmail.com' ? 'manager' : 'client',
              active: true,
              status: 'active',
              createdAt: fbUser.metadata?.creationTime || new Date().toISOString()
            };
            await storage.syncUserToRTDB(newUser);
          }
        }

        // 2. Remove users from RTDB that are no longer in Auth
        // (Only if we successfully got a full list from Auth)
        const currentRtdbUsers = storage.getUsers(); // This might be stale, better use the 'users' state
        for (const rUser of users) {
          if (!authUids.has(rUser.id) && rUser.role !== 'manager') {
            console.log(`User ${rUser.email} not found in Auth, removing from RTDB...`);
            await storage.deleteUserFromRTDB(rUser.id);
          }
        }
      } else if (data.warning) {
        setApiWarning(data.warning);
      }
    } catch (error) {
      console.error("Error fetching users from Auth:", error);
    }
  };

  const handleUpdateUser = async (uid: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/users/${uid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userFormData.email,
          password: userFormData.password || undefined,
          displayName: userFormData.name
        })
      });

      if (!response.ok) throw new Error('Failed to update user in Firebase');

      // Update Realtime Database
      const updatedUser: any = {
        id: uid,
        name: userFormData.name,
        email: userFormData.email,
        whatsapp: userFormData.whatsapp,
        active: userFormData.active,
        status: (userFormData.active ? 'active' : 'inactive') as 'active' | 'inactive'
      };
      await storage.syncUserToRTDB(updatedUser);

      // Update local storage
      const localUsers = storage.getUsers();
      const updatedLocalUsers = localUsers.map(u => {
        if (u.id === uid || u.email.toLowerCase() === userFormData.email.toLowerCase()) {
          return {
            ...u,
            name: userFormData.name,
            email: userFormData.email,
            whatsapp: userFormData.whatsapp,
            active: userFormData.active,
            status: (userFormData.active ? 'active' : 'inactive') as 'active' | 'inactive'
          };
        }
        return u;
      });
      storage.saveUsers(updatedLocalUsers);
      
      setEditingUser(null);
      fetchUsers();
    } catch (error) {
      console.error("Error updating user:", error);
      alert("Erro ao atualizar usuário.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (uid: string) => {
    const userToDelete = users.find(u => u.id === uid);
    if (userToDelete?.email === 'bryannogueira07@gmail.com') {
      alert("O administrador principal não pode ser excluído.");
      return;
    }
    setDeletingId(uid);
  };

  const [isDeletingAll, setIsDeletingAll] = useState(false);

  const handleDeleteAllClients = async () => {
    const clientsToDelete = users.filter(u => u.role !== 'manager' && u.email !== 'bryannogueira07@gmail.com');
    
    if (clientsToDelete.length === 0) {
      alert("Não há clientes para excluir.");
      return;
    }

    if (!confirm(`Deseja excluir TODOS os ${clientsToDelete.length} clientes? Esta ação não pode ser desfeita.`)) {
      return;
    }

    setIsDeletingAll(true);
    setLoading(true);

    try {
      let successCount = 0;
      let failCount = 0;

      for (const client of clientsToDelete) {
        try {
          // 1. Auth Delete
          const response = await fetch(`/api/admin/users/${client.id}`, { method: 'DELETE' });
          const data = await response.json();
          
          if (response.ok) {
            // 2. RTDB Delete
            await storage.deleteUserFromRTDB(client.id);
            successCount++;
          } else {
            console.error(`Failed to delete ${client.email}:`, data.error);
            failCount++;
          }
        } catch (err) {
          console.error(`Error deleting ${client.email}:`, err);
          failCount++;
        }
      }

      // 3. Update local storage
      const remainingUsers = storage.getUsers().filter(u => 
        u.role === 'manager' || u.email === 'bryannogueira07@gmail.com'
      );
      storage.saveUsers(remainingUsers);
      
      alert(`Limpeza concluída!\nSucesso: ${successCount}\nFalhas: ${failCount}`);
      fetchUsers();
    } catch (error) {
      console.error("Bulk delete error:", error);
      alert("Erro durante a exclusão em massa.");
    } finally {
      setIsDeletingAll(false);
      setLoading(false);
    }
  };

  const confirmDeleteUser = async (uid: string) => {
    const userToDelete = users.find(u => u.id === uid);
    if (userToDelete?.email === 'bryannogueira07@gmail.com') {
      alert("O administrador principal não pode ser excluído.");
      setDeletingId(null);
      return;
    }

    try {
      setLoading(true);
      
      // 1. Delete from Firebase Auth via API
      const response = await fetch(`/api/admin/users/${uid}`, {
        method: 'DELETE'
      });
      const data = await response.json();

      if (!response.ok && data.warning) {
        alert(data.warning);
        setDeletingId(null);
        return;
      }

      // 2. Delete from Realtime Database
      await storage.deleteUserFromRTDB(uid);

      // 3. Update local storage
      const localUsers = storage.getUsers();
      const updatedLocalUsers = localUsers.filter(u => u.id !== uid);
      storage.saveUsers(updatedLocalUsers);
      
      setDeletingId(null);
      fetchUsers();
    } catch (error) {
      console.error("Error deleting user:", error);
      alert("Erro ao excluir usuário.");
    } finally {
      setLoading(false);
    }
  };

  const [showUserPassword, setShowUserPassword] = useState(false);
  const [gcsStatus, setGcsStatus] = useState<any>(null);

  useEffect(() => {
    fetch('/api/gcs-status')
      .then(res => res.json())
      .then(data => {
        console.log('STATUS API:', data);
        setGcsStatus(data);
        if (data.configured) {
          syncWithGCS();
        }
      })
      .catch((err) => {
        console.error('ERRO API:', err);
        setGcsStatus({ configured: false });
      });
  }, []);

  const [isTransforming, setIsTransforming] = useState(false);

  const [isGcsSyncing, setIsGcsSyncing] = useState(false);

  const syncWithGCS = async () => {
    setIsGcsSyncing(true);
    try {
      const res = await fetch('/api/list-embroidery');
      const { files } = await res.json();
      
      if (!files) {
        setIsGcsSyncing(false);
        return;
      }

      const allProducts = storage.getProducts();
      const gcsStatusRes = await fetch('/api/gcs-status');
      const gcsStatusData = await gcsStatusRes.json();
      const bucket = gcsStatusData.bucket || 'appbordados';

      // 1. Filter out products that have a gcsPath but the file is no longer in GCS
      let updatedProducts = allProducts.filter(p => {
        if (!p.gcsPath) return true;
        return files.includes(p.gcsPath);
      });

      // 2. Add products that are in GCS but not in the database
      const existingGcsPaths = new Set(updatedProducts.map(p => p.gcsPath).filter(Boolean));
      const missingFiles = files.filter((f: string) => !existingGcsPaths.has(f));

      if (missingFiles.length > 0) {
        console.log(`Sync: Found ${missingFiles.length} new files in GCS. Adding to catalog...`);
        
        for (const file of missingFiles) {
          const fileName = file.split('/').pop() || file;
          const baseName = fileName.split('.').shift() || fileName;
          
          // AI Analysis of filename for better metadata
          let analysis = null;
          try {
            analysis = await analyzeEmbroideryFilename(fileName) as any;
          } catch (e) {
            console.warn("AI analysis failed for synced file:", fileName);
          }

          const newProduct: Product = {
            id: generateId(),
            name: analysis?.name || baseName,
            description: analysis?.description || `Matriz de bordado sincronizada: ${fileName}`,
            price: 19.90,
            imageUrl: `https://storage.googleapis.com/${bucket}/imagens-vitrine/${baseName}.png`,
            fileUrl: `https://storage.googleapis.com/${bucket}/${file}`,
            fileName: fileName,
            gcsPath: file,
            category: analysis?.category || 'Sincronizado',
            createdAt: new Date().toISOString(),
            soldCount: 0,
            reviews: []
          };
          updatedProducts.push(newProduct);
        }
      }

      if (updatedProducts.length !== allProducts.length || missingFiles.length > 0) {
        console.log(`Sync complete: ${updatedProducts.length} products total.`);
        storage.saveProducts(updatedProducts);
        setProducts(updatedProducts);
        
        // Sync to RTDB if possible
        try {
          await storage.syncProductsToRTDB(updatedProducts);
        } catch (e) {
          console.warn("Could not sync updated list to RTDB during auto-sync:", e);
        }
      }
      
      if (missingFiles.length > 0) {
        alert(`${missingFiles.length} novos arquivos encontrados no GCS e adicionados à vitrine!`);
      }
    } catch (error) {
      console.error("Sync Error:", error);
    } finally {
      setIsGcsSyncing(false);
    }
  };

  const uploadToGCS = async (file: File) => {
    console.log('DEBUG FILE:', file);
    const formData = new FormData();
    formData.append('file', file);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 seconds timeout

    console.log(`📤 Iniciando upload para: /api/upload-embroidery`);
    try {
      const response = await fetch('/api/upload-embroidery', {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || result.details || 'Falha no upload para o Google Cloud');
        }
        return result;
      } else {
        const text = await response.text();
        console.error('Non-JSON response received:', text.substring(0, 200));
        throw new Error(`Erro no Servidor (${response.status}): O servidor retornou uma resposta inesperada. Verifique se o arquivo não é muito grande.`);
      }
    } catch (error: any) {
      console.error('GCS Upload Error:', error);
      if (error.name === 'SyntaxError') {
        throw new Error('Erro de Resposta: O servidor retornou um formato inválido. Tente um arquivo menor ou verifique a conexão.');
      }
      if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
        throw new Error('Erro de Conexão: O servidor não respondeu. O arquivo pode ser muito grande ou o servidor está offline.');
      }
      throw error;
    }
  };

  const [isSyncing, setIsSyncing] = useState(false);

  const handleFullSync = async () => {
    setIsSyncing(true);
    try {
      const localProducts = storage.getProducts();
      await storage.syncProductsToRTDB(localProducts);
      alert('Sincronização completa! Todos os dados do Studio foram enviados para a produção.');
    } catch (err: any) {
      console.error('Erro na sincronização total:', err);
      if (err.message?.includes('Tentativa de sincronização sem usuário autenticado')) {
        alert('Erro: Tentativa de sincronização sem usuário autenticado pelo Firebase. Por favor, faça login com sua conta oficial ou registre-se para habilitar a sincronização.');
      } else if (err.message?.includes('PERMISSION_DENIED') || err.code === 'PERMISSION_DENIED') {
        alert('Erro de Permissão: O banco de dados recusou a sincronização. Verifique se você está logado com a conta correta e se o e-mail está verificado (E-mail verificado é obrigatório para sincronizar).');
      } else {
        alert('Erro ao sincronizar. Verifique sua conexão e permissões (E-mail verificado e login oficial são necessários).');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAIUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Concurrency guard
    if (isBulkAdding) {
      console.warn("Já existe um processamento em lote em andamento.");
      return;
    }

    const fileList = Array.from(files) as File[];
    
    // Clear input immediately to prevent re-triggering
    if (e.target) e.target.value = '';

    setProcessingFiles(fileList.map(f => ({ name: f.name, status: 'pending' })));
    setIsBulkAdding(true);

    const newProducts: Product[] = [];

    // Group files by base name
    const groupedFiles: { [key: string]: { image?: File; embroidery?: File } } = {};
    fileList.forEach(file => {
      const lastDotIndex = file.name.lastIndexOf('.');
      const baseName = lastDotIndex !== -1 ? file.name.substring(0, lastDotIndex) : file.name;
      const ext = file.name.substring(lastDotIndex + 1).toLowerCase();

      if (!groupedFiles[baseName]) groupedFiles[baseName] = {};

      if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
        groupedFiles[baseName].image = file;
      } else if (['pes', 'jeff', 'jef', 'dst', 'exp', 'xxx'].includes(ext)) {
        groupedFiles[baseName].embroidery = file;
      }
    });

    const baseNames = Object.keys(groupedFiles);

    try {
      // Process in chunks of 2 to avoid overwhelming the server/API
      const chunkSize = 2;
      for (let i = 0; i < baseNames.length; i += chunkSize) {
        const chunk = baseNames.slice(i, i + chunkSize);
        
        await Promise.all(chunk.map(async (baseName) => {
          const group = groupedFiles[baseName];
          if (!group.embroidery && !group.image) return;

          setProcessingFiles(prev => prev.map(p => 
            (p.name === group.image?.name || p.name === group.embroidery?.name) 
              ? { ...p, status: 'processing' } 
              : p
          ));

          try {
            let imageUrl = '';
            let fileUrl = '';
            let fileName = '';
            let gcsPath = '';
            let analysis = null;

            if (group.embroidery) {
              // 1. Upload to GCS
              const uploadResult = await uploadToGCS(group.embroidery);
              fileUrl = uploadResult.publicUrl;
              fileName = group.embroidery.name;
              gcsPath = uploadResult.gcsPath;

              // 2. Wait for Cloud Function processing (3-5 seconds as requested)
              // We do this in parallel with AI analysis to save time
              const waitPromise = new Promise(resolve => setTimeout(resolve, 4000));
              
              // 3. AI Analysis of filename
              const analysisPromise = analyzeEmbroideryFilename(group.embroidery.name);
              
              const [_, analysisResult] = await Promise.all([waitPromise, analysisPromise]);
              analysis = analysisResult as any;

              // 4. Set the preview URL
              imageUrl = uploadResult.previewUrl;
            } else if (group.image) {
              const base64 = await fileToBase64(group.image);
              imageUrl = await compressImage(base64);
              analysis = await analyzeEmbroideryImage(imageUrl.split(',')[1], group.image.type) as any;
            }

            const newProduct: Product = {
              id: generateId(),
              name: analysis?.name || baseName,
              description: analysis?.description || `Matriz de bordado ${fileName || baseName}.`,
              price: 19.90,
              imageUrl: imageUrl || 'https://picsum.photos/seed/embroidery/800/600',
              fileUrl: fileUrl,
              fileName: fileName,
              gcsPath: gcsPath,
              category: analysis?.category || 'Geral',
              createdAt: new Date().toISOString(),
              soldCount: 0,
              reviews: []
            };

            newProducts.push(newProduct);
            
            setProcessingFiles(prev => prev.map(p => 
              (p.name === group.image?.name || p.name === group.embroidery?.name) 
                ? { ...p, status: 'done' } 
                : p
            ));
          } catch (err) {
            console.error(`Erro ao processar ${baseName}:`, err);
            setProcessingFiles(prev => prev.map(p => 
              (p.name === group.image?.name || p.name === group.embroidery?.name) 
                ? { ...p, status: 'error' } 
                : p
            ));
          }
        }));
      }

      if (newProducts.length > 0) {
        // Fetch FRESH products from storage to avoid overwriting background updates
        const currentAllProducts = storage.getProducts();
        const updatedProducts = [...currentAllProducts, ...newProducts];
        
        storage.saveProducts(updatedProducts);
        try {
          await storage.syncProductsToRTDB(updatedProducts);
        } catch (syncErr: any) {
          console.error('Erro ao sincronizar com RTDB:', syncErr);
          if (syncErr.message?.includes('Tentativa de sincronização sem usuário autenticado')) {
            alert('Aviso: Os produtos foram salvos localmente, mas não puderam ser sincronizados com o banco de dados (Sem Usuário Firebase).');
          } else if (syncErr.message?.includes('PERMISSION_DENIED')) {
            alert('Aviso: Os produtos foram salvos localmente, mas não puderam ser sincronizados com o banco de dados (Erro de Permissão). Verifique as Regras do Realtime Database.');
          }
        }
        setProducts(storage.getProducts());
      }
    } finally {
      setIsBulkAdding(false);
    }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files ? e.target.files[0] : null;

    console.log("FILE REAL:", file); // 🔥 ESSENCIAL

    if (!file) {
      console.error("Nenhum arquivo selecionado");
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);

    fetch('https://remix-bordado-m-gico-matrizes-de-bordado-267339025814.us-west1.run.app/api/upload-embroidery', {
      method: 'POST',
      body: formData
    })
      .then(res => res.json())
      .then(async (data) => {
        console.log("UPLOAD OK:", data);
        
        if (data.error) {
          throw new Error(data.error);
        }

        const baseName = file.name.split('.').shift() || file.name;
        const newProduct: Product = {
          id: generateId(),
          name: baseName,
          description: `Matriz carregada via upload simples: ${file.name}`,
          price: 19.90,
          imageUrl: data.previewUrl,
          fileUrl: data.publicUrl,
          fileName: file.name,
          gcsPath: data.gcsPath,
          category: 'Upload Simples',
          createdAt: new Date().toISOString(),
          soldCount: 0,
          reviews: []
        };
        
        const currentProducts = storage.getProducts();
        const updatedProducts = [...currentProducts, newProduct];
        storage.saveProducts(updatedProducts);
        await storage.syncProductsToRTDB(updatedProducts);
        setProducts(updatedProducts);
        
        alert(`✅ Arquivo "${file.name}" enviado e cadastrado!`);
      })
      .catch(err => {
        console.error("ERRO UPLOAD:", err);
        alert(`❌ Erro: ${err.message}`);
      })
      .finally(() => {
        setLoading(false);
        if (e.target) e.target.value = '';
      });
  };

  const handleAddReview = (productId: string) => {
    if (!reviewFormData.userName || !reviewFormData.comment) {
      alert('Por favor, preencha todos os campos da avaliação.');
      return;
    }

    const allProducts = storage.getProducts();
    const updatedProducts = allProducts.map(p => {
      if (p.id === productId) {
        const newReview: Review = {
          id: Math.random().toString(36).substr(2, 9),
          userName: reviewFormData.userName,
          rating: reviewFormData.rating,
          comment: reviewFormData.comment,
          date: new Date().toISOString()
        };
        return { ...p, reviews: [...p.reviews, newReview] };
      }
      return p;
    });

    storage.saveProducts(updatedProducts);
    storage.syncProductsToRTDB(updatedProducts); // Sync to RTDB
    setProducts(updatedProducts);
    setReviewFormData({ userName: '', rating: 5, comment: '' });
  };

  const handleDeleteReview = (productId: string, reviewId: string) => {
    const allProducts = storage.getProducts();
    const updatedProducts = allProducts.map(p => {
      if (p.id === productId) {
        return { ...p, reviews: p.reviews.filter(r => r.id !== reviewId) };
      }
      return p;
    });
    storage.saveProducts(updatedProducts);
    storage.syncProductsToRTDB(updatedProducts); // Sync to RTDB
    setProducts(updatedProducts);
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.fileName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredUsers = users.filter(u => 
    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.whatsapp?.includes(searchTerm)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.name || !formData.price || !formData.category) {
      alert('Por favor, preencha todos os campos obrigatórios (Nome, Preço e Categoria).');
      return;
    }

    const price = parseFloat(formData.price.toString().replace(',', '.'));
    if (isNaN(price)) {
      alert('Por favor, insira um preço válido.');
      return;
    }

    const allProducts = storage.getProducts();
    const productData = {
      name: formData.name,
      description: formData.description || 'Sem descrição',
      price: price,
      soldCount: parseInt(formData.soldCount.toString()) || 0,
      imageUrl: formData.imageUrl || `https://picsum.photos/seed/${encodeURIComponent(formData.name)}/800/600`,
      fileUrl: formData.fileUrl,
      fileName: formData.fileName,
      category: formData.category
    };

    try {
      let updatedProducts: Product[];
      if (editingId) {
        updatedProducts = allProducts.map(p => 
          p.id === editingId ? { ...p, ...productData } : p
        );
        setEditingId(null);
      } else {
        const newProduct: Product = {
          id: generateId(),
          reviews: [],
          createdAt: new Date().toISOString(),
          ...productData
        };
        updatedProducts = [...allProducts, newProduct];
        setIsAdding(false);
      }
      
      storage.saveProducts(updatedProducts);
      setProducts(updatedProducts);
      setIsAdding(false);
      setEditingId(null);
      setFormData({ name: '', description: '', price: '', soldCount: '0', imageUrl: '', fileUrl: '', fileName: '', category: '' });

      try {
        await storage.syncProductsToRTDB(updatedProducts); // Sync to RTDB
      } catch (syncErr: any) {
        console.error('Erro ao sincronizar com RTDB:', syncErr);
        if (syncErr.message?.includes('Tentativa de sincronização sem usuário autenticado')) {
          alert('Erro: Tentativa de sincronização sem usuário autenticado pelo Firebase. Por favor, faça login com sua conta oficial ou registre-se para habilitar a sincronização.');
        } else if (syncErr.message?.includes('PERMISSION_DENIED')) {
          alert('Aviso: O produto foi salvo localmente, mas a sincronização com o banco de dados falhou (Erro de Permissão). Verifique se você está logado com a conta correta e se o e-mail está verificado.');
        }
      }
      
      // Force a small delay then refresh to ensure UI sync
      setTimeout(() => {
        setProducts(storage.getProducts());
      }, 100);
    } catch (err) {
      console.error('Erro ao salvar produto:', err);
      alert('Erro ao salvar produto. Verifique o console para mais detalhes.');
    }
  };

  const handleDelete = async (id: string) => {
    const allProducts = storage.getProducts();
    const productToDelete = allProducts.find(p => p.id === id);
    
    // 1. Delete from GCS if it has a gcsPath
    if (productToDelete?.gcsPath) {
      try {
        await fetch('/api/delete-embroidery', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gcsPath: productToDelete.gcsPath })
        });
        console.log(`GCS: Files for ${productToDelete.name} deleted.`);
      } catch (error) {
        console.error("Error deleting from GCS:", error);
      }
    }

    // 2. Delete from local storage
    const updatedProducts = allProducts.filter(p => p.id !== id);
    storage.saveProducts(updatedProducts);
    storage.syncProductsToRTDB(updatedProducts); // Sync to RTDB
    setProducts(updatedProducts);
    setDeletingId(null);
  };

  const startEdit = (product: Product) => {
    setEditingId(product.id);
    setFormData({
      name: product.name,
      description: product.description,
      price: product.price.toString(),
      soldCount: (product.soldCount || 0).toString(),
      imageUrl: product.imageUrl,
      fileUrl: product.fileUrl || '',
      fileName: product.fileName || '',
      category: product.category
    });
    setIsAdding(true);
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const base64 = await fileToBase64(file);
      const compressed = await compressImage(base64);
      setFormData({
        ...formData,
        imageUrl: compressed
      });
    }
  };

  const handleManualFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Concurrency guard
    if (isBulkAdding || isTransforming) {
      console.warn("Já existe um processamento em andamento.");
      return;
    }

    setLoading(true);
    try {
      const fileList = Array.from(files) as File[];
      
      // Clear input immediately to prevent re-triggering
      if (e.target) e.target.value = '';
      
      let matrixFile: File | null = null;
      let imageFile: File | null = null;

      fileList.forEach((file: File) => {
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (['pes', 'jeff', 'jef', 'dst', 'exp', 'xxx'].includes(ext || '')) {
          matrixFile = file;
        } else if (['jpg', 'jpeg', 'png', 'webp'].includes(ext || '')) {
          imageFile = file;
        }
      });

      const updates: any = {};

      if (matrixFile) {
        setIsTransforming(true);
        try {
          // 1. Upload to GCS
          const uploadResult = await uploadToGCS(matrixFile);
          updates.fileUrl = uploadResult.publicUrl;
          updates.fileName = matrixFile.name;
          
          if (!formData.name) {
            updates.name = matrixFile.name.split('.')[0];
          }

          // 2. Wait for Cloud Function processing
          // The user requested 3-5 seconds
          await new Promise(resolve => setTimeout(resolve, 4000));

          // 3. Set the preview URL
          updates.imageUrl = uploadResult.previewUrl;

          // AI Analysis
          const analysis = await analyzeEmbroideryFilename(matrixFile.name) as any;
          if (analysis) {
            updates.name = updates.name || analysis.name;
            updates.category = analysis.category;
            updates.description = analysis.description;
          }

          // If it's a new product, auto-save it as requested
          if (!editingId) {
            // Fetch FRESH products to avoid overwriting background updates
            const currentAllProducts = storage.getProducts();
            const newProduct: Product = {
              id: generateId(),
              name: updates.name || matrixFile.name.split('.')[0],
              description: updates.description || 'Nova matriz adicionada via arquivo',
              price: 19.90,
              imageUrl: updates.imageUrl || 'https://picsum.photos/seed/embroidery/800/600',
              fileUrl: updates.fileUrl || '',
              fileName: updates.fileName || '',
              gcsPath: uploadResult.gcsPath, // Store the GCS path for sync/delete
              category: updates.category || 'Outros',
              createdAt: new Date().toISOString(),
              soldCount: 0,
              reviews: []
            };
            
            const updatedProducts = [...currentAllProducts, newProduct];
            storage.saveProducts(updatedProducts);
            storage.syncProductsToRTDB(updatedProducts); // Sync to RTDB
            setProducts(storage.getProducts());
            setIsAdding(false);
            setFormData({ name: '', description: '', price: '', soldCount: '0', imageUrl: '', fileUrl: '', fileName: '', category: '' });
            alert(`Matriz "${matrixFile.name}" processada e cadastrada automaticamente!`);
          }
        } catch (err) {
          console.error("Erro ao processar arquivo manual com GCS:", err);
          const base64 = await fileToBase64(matrixFile);
          updates.fileUrl = base64;
          updates.fileName = matrixFile.name;
        } finally {
          setIsTransforming(false);
        }
      }

      if (imageFile) {
        const base64 = await fileToBase64(imageFile);
        updates.imageUrl = await compressImage(base64);
      }

      setFormData(prev => ({
        ...prev,
        ...updates
      }));
    } catch (err) {
      console.error("Erro no processamento manual:", err);
      alert("Erro ao processar arquivo. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  if (gcsStatus === null) return null;

  if (!gcsStatus.configured) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pink-50 p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl border-2 border-pink-100 text-center max-w-md">
          <div className="bg-pink-100 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 text-pink-600">
            <AlertTriangle size={32} />
          </div>
          <h2 className="text-2xl font-black text-gray-800 mb-2">Google Cloud não configurado</h2>
          <div className="text-gray-600 font-bold mb-6 space-y-2">
            <p>O sistema de armazenamento de arquivos não foi detectado ou as credenciais são inválidas.</p>
            {gcsStatus.details && (
              <div className="text-xs bg-gray-50 p-3 rounded-xl border border-gray-100 text-left font-mono">
                <div>• Variável de Ambiente: {gcsStatus.details.hasEnvVar ? '✅' : '❌'}</div>
                <div>• JSON Válido: {gcsStatus.details.isJsonValid ? '✅' : '❌'}</div>
                <div>• Chave Privada: {gcsStatus.details.hasPrivateKey ? '✅' : '❌'}</div>
                <div>• Formato PEM: {gcsStatus.details.isPemFormat ? '✅' : '❌'}</div>
                <div>• Linhas na Chave: {gcsStatus.details.lineCount} {gcsStatus.details.lineCount > 10 ? '✅' : '⚠️ (Mínimo 10)'}</div>
                <div className="mt-2 text-[10px] text-gray-400">Projeto: {gcsStatus.details.projectId}</div>
                <div className="text-[10px] text-gray-400 truncate">Email: {gcsStatus.details.clientEmail}</div>
              </div>
            )}
            <p className="text-xs text-pink-600 mt-4">
              <strong>Dica Importante:</strong> Copie o conteúdo <strong>INTEIRO</strong> do arquivo JSON baixado do Google Cloud. 
              A chave privada deve ter várias linhas. Se o checklist acima mostrar menos de 10 linhas, a chave está incompleta ou mal formatada.
            </p>
            <button
              onClick={async () => {
                try {
                  const res = await fetch('/api/gcs-status');
                  const contentType = res.headers.get("content-type");
                  const text = await res.text();
                  alert(`Status: ${res.status}\nContent-Type: ${contentType}\n\nResponse: ${text.substring(0, 100)}...`);
                } catch (e) {
                  alert("Erro ao chamar API de status: " + e);
                }
              }}
              className="mt-2 w-full bg-blue-50 text-blue-700 py-3 rounded-xl font-bold hover:bg-blue-100 transition-all text-xs"
            >
              Verificar Saúde da API
            </button>
            <button
              onClick={async () => {
                try {
                  const res = await fetch('/api/gcs-test-sign');
                  const data = await res.json();
                  if (data.success) {
                    alert("✅ Conexão GCS OK!\nBuckets encontrados: " + data.buckets.join(', '));
                  } else {
                    alert("❌ Erro na Conexão GCS:\n" + data.error + (data.details ? "\n\nDetalhes: " + data.details : ""));
                  }
                } catch (e) {
                  alert("Erro ao testar conexão. Verifique o console.");
                }
              }}
              className="mt-4 w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200 transition-all text-xs"
            >
              Testar Conexão com GCS
            </button>
          </div>
          <button 
            onClick={() => window.open('https://console.cloud.google.com/iam-admin/serviceaccounts', '_blank')}
            className="w-full bg-pink-600 text-white py-4 rounded-2xl font-black hover:bg-pink-700 transition-all shadow-lg shadow-pink-100"
          >
            Configurar Agora
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 space-y-8 pb-20">

      {/* API Configuration Warning */}
      {apiWarning && activeTab === 'users' && (
        <div className="bg-red-50 border-2 border-red-200 p-8 rounded-[40px] shadow-xl mb-8">
          <div className="flex flex-col md:flex-row items-start gap-6">
            <div className="bg-red-100 p-4 rounded-3xl text-red-600 shrink-0">
              <AlertTriangle size={40} />
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <h3 className="text-2xl font-black text-red-800 mb-2">Acesso Negado ao Firebase Auth</h3>
                <p className="text-red-700 font-bold leading-relaxed whitespace-pre-wrap">
                  {apiWarning}
                </p>
              </div>
              
              <div className="bg-white/50 p-6 rounded-3xl border border-red-100 space-y-3">
                <h4 className="font-black text-red-900 uppercase tracking-wider text-sm">Passo a Passo para Corrigir:</h4>
                <ol className="list-decimal list-inside text-red-800 text-sm font-bold space-y-2">
                  <li>Clique no botão <span className="text-red-600">"Abrir Console IAM"</span> abaixo.</li>
                  <li>Procure a conta de serviço mencionada no erro acima.</li>
                  <li>Clique no ícone de <span className="text-red-600">Lápis (Editar)</span>.</li>
                  <li>Clique em <span className="text-red-600">"Adicionar outro papel"</span>.</li>
                  <li>Busque por <span className="font-black">"Administrador de Autenticação do Firebase"</span> e selecione.</li>
                  <li>Clique em <span className="text-red-600">Salvar</span> e aguarde 1 minuto.</li>
                </ol>
              </div>

              <div className="flex flex-wrap gap-4">
                <button 
                  onClick={() => window.open(`https://console.cloud.google.com/iam-admin/iam?project=bordado-aff87`, '_blank')}
                  className="bg-red-600 text-white px-8 py-4 rounded-2xl font-black hover:bg-red-700 transition-all shadow-lg shadow-red-200 active:scale-95 flex items-center gap-2"
                >
                  <Users size={20} />
                  Abrir Console IAM
                </button>
                <button 
                  onClick={async () => {
                    setLoading(true);
                    try {
                      const res = await fetch('/api/admin/check-permissions');
                      const data = await res.json();
                      if (data.success) {
                        alert("Sucesso! As permissões foram configuradas corretamente.");
                        setApiWarning(null);
                        fetchUsers();
                      } else {
                        alert("Ainda sem permissão. Verifique se você salvou as alterações no Google Cloud.");
                      }
                    } catch (e) {
                      alert("Erro ao verificar. Tente novamente.");
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="bg-white text-red-600 border-2 border-red-200 px-8 py-4 rounded-2xl font-black hover:bg-red-50 transition-all active:scale-95 flex items-center gap-2"
                >
                  <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                  Verificar Agora
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col items-center text-center bg-white p-10 rounded-3xl shadow-xl border border-gray-100">
        <h1 className="text-4xl font-black text-gray-800 mb-2">Painel do Gerente</h1>
        <p className="text-gray-500 mb-8 font-bold">Gerencie seu catálogo de matrizes</p>
        
        <div className="flex flex-wrap justify-center gap-4 mb-8">
          <div className="flex flex-col items-center gap-2">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Upload Direto</span>
            <input 
              type="file" 
              onChange={handleUpload} 
              className="text-xs font-bold text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-black file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 transition-all"
            />
          </div>

          <input
            type="file"
            multiple
            accept="image/*,.pes,.jeff,.dst,.exp,.xxx"
            className="hidden"
            ref={fileInputRef}
            onChange={handleAIUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-pink-600 text-white px-8 py-4 rounded-2xl font-black hover:bg-pink-700 transition-all shadow-lg shadow-pink-100 flex items-center gap-2"
          >
            <Sparkles size={24} /> Upload Automático
          </button>
          <button
            onClick={handleFullSync}
            disabled={isSyncing}
            className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={cn(isSyncing && "animate-spin")} size={24} />
            {isSyncing ? 'Sincronizando...' : 'Sincronizar Produção'}
          </button>
          <button
            onClick={syncWithGCS}
            disabled={isGcsSyncing}
            className="bg-orange-500 text-white px-8 py-4 rounded-2xl font-black hover:bg-orange-600 transition-all shadow-lg shadow-orange-100 flex items-center gap-2 disabled:opacity-50"
          >
            <Cloud className={cn(isGcsSyncing && "animate-spin")} size={24} />
            {isGcsSyncing ? 'Sincronizando GCS...' : 'Sincronizar GCS'}
          </button>
          <button
            onClick={() => { setIsAdding(!isAdding); setEditingId(null); setFormData({ name: '', description: '', price: '', soldCount: '0', imageUrl: '', fileUrl: '', fileName: '', category: '' }); }}
            className="bg-purple-600 text-white px-8 py-4 rounded-2xl font-black hover:bg-purple-700 transition-all shadow-lg shadow-purple-100 flex items-center gap-2"
          >
            {isAdding ? <X size={24} /> : <Plus size={24} />}
            {isAdding ? 'Cancelar' : 'Nova Matriz'}
          </button>
        </div>

        <div className="w-full max-w-xl relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text"
            placeholder={activeTab === 'products' ? "Buscar matrizes..." : "Buscar clientes..."}
            className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-transparent focus:border-purple-500 focus:bg-white rounded-2xl outline-none font-bold transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-gray-100 p-1 rounded-2xl mt-8">
          <button
            onClick={() => setActiveTab('products')}
            className={cn(
              "flex items-center gap-2 px-8 py-3 rounded-xl font-bold transition-all",
              activeTab === 'products' ? "bg-white text-purple-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            <Flower2 size={20} />
            Matrizes
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={cn(
              "flex items-center gap-2 px-8 py-3 rounded-xl font-bold transition-all",
              activeTab === 'users' ? "bg-white text-purple-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            <Users size={20} />
            Clientes
          </button>
        </div>
      </div>

      {/* Main Content Sections */}
      {activeTab === 'products' ? (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center text-center">
              <span className="text-2xl font-black text-gray-800">{products.length}</span>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Matrizes</span>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center text-center">
              <span className="text-2xl font-black text-gray-800">
                {(products || []).reduce((acc, p) => acc + (p.soldCount || 0), 0)}
              </span>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Vendas</span>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center text-center">
              <span className="text-2xl font-black text-gray-800">
                {(products || []).reduce((acc, p) => acc + (p.reviews?.length || 0), 0)}
              </span>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Avaliações</span>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center text-center">
              <span className="text-2xl font-black text-gray-800">
                {new Set(products.map(p => p.category)).size}
              </span>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Categorias</span>
            </div>
          </div>

          {/* Products List Section */}
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tight">Suas Matrizes</h2>
            <div className="flex items-center gap-2 text-sm font-bold text-gray-400">
              <Filter size={16} />
              <span>{filteredProducts.length} itens encontrados</span>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Users List Section */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex flex-col">
              <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tight">Seus Clientes</h2>
              <div className="flex items-center gap-2 text-sm font-bold text-gray-400">
                <Users size={16} />
                <span>{filteredUsers.length} clientes encontrados</span>
              </div>
            </div>
            
            <button
              onClick={handleDeleteAllClients}
              disabled={loading || isDeletingAll}
              className="w-full md:w-auto bg-red-50 text-red-600 px-6 py-3 rounded-2xl font-black text-sm hover:bg-red-100 transition-all flex items-center justify-center gap-2 shadow-sm border border-red-100 disabled:opacity-50"
            >
              <Trash2 size={18} />
              Apagar Todos os Clientes
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredUsers.map((user) => (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 hover:shadow-xl transition-all"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-purple-100 p-3 rounded-2xl">
                      <User className="text-purple-600" size={24} />
                    </div>
                    <div>
                      <h3 className="font-black text-gray-800">{user.name || 'Sem Nome'}</h3>
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">{user.role === 'manager' ? 'Administrador' : 'Cliente'}</p>
                    </div>
                  </div>
                  <div className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                    user.active ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                  )}>
                    {user.active ? 'Ativo' : 'Inativo'}
                  </div>
                </div>

                <div className="space-y-2 mb-6">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Mail size={16} className="text-gray-400" />
                    <span className="text-sm font-medium">{user.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <MessageSquare size={16} className="text-gray-400" />
                    <span className="text-sm font-medium">{user.whatsapp || 'Não informado'}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingUser(user);
                      setUserFormData({
                        name: user.name || '',
                        email: user.email,
                        whatsapp: user.whatsapp || '',
                        password: '',
                        active: user.active ?? true,
                        status: user.status || 'active'
                      });
                    }}
                    className="flex-1 bg-gray-50 text-gray-600 py-3 rounded-xl font-bold hover:bg-gray-100 transition-all flex items-center justify-center gap-2"
                  >
                    <Edit size={18} /> Editar
                  </button>
                  <button
                    onClick={() => handleDeleteUser(user.id)}
                    className="p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </>
      )}

      {activeTab === 'products' && (
        <>
          <AnimatePresence>
            {isBulkAdding && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
              >
                <div className="bg-white p-8 rounded-3xl w-full max-w-xl shadow-2xl border border-gray-100">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
                      <Sparkles className="text-pink-600" />
                      <span>Processando Arquivos</span>
                    </h2>
                    <button onClick={() => setIsBulkAdding(false)} className="p-2 hover:bg-gray-100 rounded-full">
                      <X size={24} />
                    </button>
                  </div>
                  
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {processingFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <div className="flex items-center gap-3 min-w-0">
                          {file.status === 'processing' ? (
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <Loader2 className="text-pink-500 animate-spin" size={20} />
                                <span className="text-xs font-black text-pink-600 uppercase">Google Cloud Gerando Vitrine...</span>
                              </div>
                              <div className="w-full bg-gray-200 h-1 rounded-full overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: '100%' }}
                                  transition={{ duration: 4 }}
                                  className="bg-pink-500 h-full"
                                />
                              </div>
                            </div>
                          ) : file.status === 'done' ? (
                            <CheckCircle2 className="text-green-500" size={20} />
                          ) : file.status === 'error' ? (
                            <X className="text-red-500" size={20} />
                          ) : (
                            <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                          )}
                          <span className="font-bold text-gray-700 truncate">{file.name}</span>
                        </div>
                        <span className={cn(
                          "text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest",
                          file.status === 'processing' ? 'bg-pink-100 text-pink-600' :
                          file.status === 'done' ? 'bg-green-100 text-green-600' :
                          file.status === 'error' ? 'bg-red-100 text-red-600' :
                          'bg-gray-200 text-gray-500'
                        )}>
                          {file.status === 'processing' ? 'Extraindo...' :
                           file.status === 'done' ? 'Pronto' :
                           file.status === 'error' ? 'Erro' : 'Fila'}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8">
                    <button
                      onClick={() => setIsBulkAdding(false)}
                      className="w-full bg-gray-900 text-white px-8 py-4 rounded-2xl font-black hover:bg-black transition-all shadow-lg"
                    >
                      Fechar
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {activeTab === 'products' && (
        <AnimatePresence>
          {isAdding && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white p-8 md:p-12 rounded-3xl shadow-2xl border border-gray-100"
          >
            <div className="flex justify-between items-center mb-10">
              <h2 className="text-3xl font-black text-gray-800">
                {editingId ? 'Editar Matriz' : 'Nova Matriz'}
              </h2>
              <button onClick={() => setIsAdding(false)} className="p-2 hover:bg-gray-100 rounded-full">
                <X size={28} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-black text-gray-400 uppercase tracking-widest mb-2">Nome da Matriz</label>
                    <input
                      required
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      className="w-full px-6 py-4 rounded-2xl border-2 border-gray-100 focus:border-purple-500 outline-none text-lg font-bold transition-all"
                      placeholder="Ex: Floral Delicado"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-black text-gray-400 uppercase tracking-widest mb-2">Preço (R$)</label>
                      <input
                        required
                        type="number"
                        step="0.01"
                        value={formData.price}
                        onChange={e => setFormData({...formData, price: e.target.value})}
                        className="w-full px-6 py-4 rounded-2xl border-2 border-gray-100 focus:border-purple-500 outline-none text-lg font-bold transition-all"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-black text-gray-400 uppercase tracking-widest mb-2">Vendidos</label>
                      <input
                        required
                        type="number"
                        value={formData.soldCount}
                        onChange={e => setFormData({...formData, soldCount: e.target.value})}
                        className="w-full px-6 py-4 rounded-2xl border-2 border-gray-100 focus:border-purple-500 outline-none text-lg font-bold transition-all"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-black text-gray-400 uppercase tracking-widest mb-2">Categoria</label>
                    <input
                      required
                      value={formData.category}
                      onChange={e => setFormData({...formData, category: e.target.value})}
                      className="w-full px-6 py-4 rounded-2xl border-2 border-gray-100 focus:border-purple-500 outline-none text-lg font-bold transition-all"
                      placeholder="Ex: Flores"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-black text-gray-400 uppercase tracking-widest mb-2">Descrição</label>
                    <textarea
                      required
                      rows={4}
                      value={formData.description}
                      onChange={e => setFormData({...formData, description: e.target.value})}
                      className="w-full px-6 py-4 rounded-2xl border-2 border-gray-100 focus:border-purple-500 outline-none text-lg font-bold transition-all resize-none"
                      placeholder="Detalhes da matriz..."
                    />
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-black text-gray-400 uppercase tracking-widest mb-2">
                      Imagem da Matriz
                      <span className="ml-2 text-[10px] text-purple-400 normal-case font-bold">
                        (Arquivos são transformados em JPEG automaticamente)
                      </span>
                    </label>
                    <div className="flex gap-2 mb-4">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageFileChange}
                        className="hidden"
                        id="image-upload"
                      />
                      <label
                        htmlFor="image-upload"
                        className="flex-1 bg-gray-100 text-gray-600 px-4 py-3 rounded-xl cursor-pointer hover:bg-gray-200 transition-all text-center font-bold flex items-center justify-center gap-2"
                      >
                        <ImageIcon size={20} /> Anexar Foto
                      </label>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!formData.name && !formData.fileName) {
                            alert('Por favor, insira um nome ou anexe um arquivo primeiro.');
                            return;
                          }
                          setIsTransforming(true);
                          try {
                            const analysis = await analyzeEmbroideryFilename(formData.name || formData.fileName);
                            if (analysis) {
                              const generatedImage = await generateEmbroideryPreview(analysis.imagePrompt);
                              if (generatedImage) {
                                const compressed = await compressImage(generatedImage);
                                setFormData(prev => ({ ...prev, imageUrl: compressed }));
                              }
                            }
                          } catch (err) {
                            console.error("Erro ao gerar imagem manual:", err);
                          }
                          setIsTransforming(false);
                        }}
                        className="bg-pink-100 text-pink-600 px-4 py-3 rounded-xl font-bold hover:bg-pink-200 transition-all flex items-center justify-center gap-2"
                      >
                        <Sparkles size={20} /> Gerar com IA
                      </button>
                    </div>
                    <div className="aspect-video rounded-2xl overflow-hidden bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center relative group">
                      {formData.imageUrl ? (
                        <>
                          <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-contain p-2" referrerPolicy="no-referrer" />
                          <button 
                            type="button"
                            onClick={() => setFormData({...formData, imageUrl: ''})}
                            className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      ) : isTransforming ? (
                        <div className="flex flex-col items-center gap-3 text-purple-600">
                          <div className="relative">
                            <Loader2 size={48} className="animate-spin opacity-20" />
                            <Sparkles size={24} className="absolute inset-0 m-auto animate-pulse text-pink-500" />
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="text-xs font-black uppercase tracking-tighter animate-pulse text-center">Google Cloud Gerando Vitrine...</span>
                            <span className="text-[10px] font-bold text-gray-400">Aguardando processamento (4s)</span>
                          </div>
                        </div>
                      ) : (
                        <ImageIcon size={48} className="text-gray-200" />
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-black text-gray-400 uppercase tracking-widest mb-2">Arquivo da Matriz</label>
                    <div className="flex gap-2">
                      <input
                        type="file"
                        accept=".pes,.jeff,.dst,.exp,.xxx"
                        onChange={handleManualFileChange}
                        className="hidden"
                        id="file-upload"
                      />
                      <label
                        htmlFor="file-upload"
                        className="flex-1 bg-purple-100 text-purple-600 px-4 py-4 rounded-xl cursor-pointer hover:bg-purple-200 transition-all text-center font-bold flex items-center justify-center gap-2"
                      >
                        <UploadCloud size={20} /> 
                        {formData.fileName ? formData.fileName : 'Anexar Arquivo (.pes, .jeff, etc)'}
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-gray-100 flex flex-col sm:flex-row gap-4">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="flex-1 px-8 py-4 rounded-2xl font-black text-gray-400 hover:bg-gray-100 transition-all uppercase tracking-widest"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-purple-600 text-white px-8 py-4 rounded-2xl font-black hover:bg-purple-700 transition-all shadow-lg shadow-purple-100 uppercase tracking-widest"
                >
                  {editingId ? 'Salvar Alterações' : 'Confirmar Cadastro'}
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {managingReviewsId && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
          >
            <div className="bg-white p-6 md:p-10 rounded-[40px] w-full max-w-4xl shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar border border-white/20">
              <div className="flex justify-between items-center mb-10">
                <h2 className="text-2xl md:text-3xl font-black text-gray-800 flex items-center gap-4">
                  <div className="bg-pink-100 p-3 rounded-2xl">
                    <MessageSquare className="text-pink-600" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-pink-500 uppercase tracking-widest">Gerenciar Feedback</span>
                    <span>{products.find(p => p.id === managingReviewsId)?.name}</span>
                  </div>
                </h2>
                <button onClick={() => setManagingReviewsId(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <X size={28} />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
                {/* Add Review Form */}
                <div className="lg:col-span-2 space-y-6 bg-gray-50/50 p-6 rounded-3xl border border-gray-100">
                  <h3 className="text-lg font-black text-gray-800 uppercase tracking-tight">Nova Avaliação</h3>
                  <div className="space-y-4">
                    <div className="group">
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Nome do Cliente</label>
                      <input 
                        value={reviewFormData.userName}
                        onChange={e => setReviewFormData({...reviewFormData, userName: e.target.value})}
                        className="w-full px-4 py-3 rounded-xl border-2 border-white focus:border-pink-500 focus:ring-4 focus:ring-pink-50 outline-none font-bold transition-all shadow-sm"
                        placeholder="Ex: Maria Oliveira"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Nota</label>
                      <div className="flex gap-1 bg-white p-2 rounded-xl shadow-sm border border-white">
                        {[1, 2, 3, 4, 5].map(s => (
                          <button 
                            key={s}
                            onClick={() => setReviewFormData({...reviewFormData, rating: s})}
                            className={cn(
                              "p-2 rounded-lg transition-all hover:scale-110",
                              reviewFormData.rating >= s ? "text-yellow-400" : "text-gray-200"
                            )}
                          >
                            <Star size={24} fill={reviewFormData.rating >= s ? "currentColor" : "none"} />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="group">
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Comentário</label>
                      <textarea 
                        value={reviewFormData.comment}
                        onChange={e => setReviewFormData({...reviewFormData, comment: e.target.value})}
                        rows={4}
                        className="w-full px-4 py-3 rounded-xl border-2 border-white focus:border-pink-500 focus:ring-4 focus:ring-pink-50 outline-none font-bold transition-all shadow-sm resize-none"
                        placeholder="O que o cliente disse..."
                      />
                    </div>
                    <button 
                      onClick={() => handleAddReview(managingReviewsId)}
                      className="w-full bg-pink-600 text-white py-4 rounded-2xl font-black hover:bg-pink-700 transition-all shadow-lg shadow-pink-100 flex items-center justify-center gap-2 active:scale-95 uppercase tracking-widest text-sm"
                    >
                      <Plus size={20} /> Salvar Avaliação
                    </button>
                  </div>
                </div>

                {/* Reviews List */}
                <div className="lg:col-span-3 space-y-6">
                  <h3 className="text-lg font-black text-gray-800 uppercase tracking-tight">Avaliações ({products.find(p => p.id === managingReviewsId)?.reviews.length})</h3>
                  <div className="space-y-4">
                    {products.find(p => p.id === managingReviewsId)?.reviews.map(review => (
                      <div key={review.id} className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex justify-between items-start group hover:shadow-md transition-shadow">
                        <div className="flex gap-4">
                          <div className="w-12 h-12 bg-pink-50 rounded-2xl flex items-center justify-center text-pink-500 shrink-0 shadow-inner">
                            <User size={24} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-black text-gray-800">{review.userName}</p>
                              <div className="flex items-center bg-yellow-50 px-2 py-0.5 rounded-lg">
                                {[1, 2, 3, 4, 5].map(s => (
                                  <Star key={s} size={10} className={cn("fill-current", s <= review.rating ? "text-yellow-400" : "text-gray-200")} />
                                ))}
                              </div>
                            </div>
                            <p className="text-gray-500 font-bold text-sm italic mt-2 leading-relaxed">"{review.comment}"</p>
                            <div className="flex items-center gap-2 mt-3">
                              <div className="w-1 h-1 bg-gray-200 rounded-full"></div>
                              <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">{new Date(review.date).toLocaleDateString('pt-BR')}</p>
                            </div>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleDeleteReview(managingReviewsId, review.id)}
                          className="text-gray-300 hover:text-red-500 p-2 hover:bg-red-50 rounded-xl transition-all"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    ))}
                    {products.find(p => p.id === managingReviewsId)?.reviews.length === 0 && (
                      <div className="text-center py-20 bg-gray-50/50 rounded-[40px] border-2 border-dashed border-gray-100">
                        <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                          <MessageSquare size={40} className="text-gray-200" />
                        </div>
                        <p className="font-black text-gray-300 uppercase tracking-widest text-sm">Nenhuma avaliação ainda</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {deletingId && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <div className="bg-white p-8 md:p-12 rounded-[40px] w-full max-w-md shadow-2xl text-center border border-gray-100">
              <div className="w-24 h-24 bg-red-50 rounded-[32px] flex items-center justify-center mx-auto mb-8 shadow-inner">
                <Trash2 size={48} className="text-red-500" />
              </div>
              <h2 className="text-3xl font-black text-gray-800 mb-3 tracking-tight">
                {activeTab === 'products' ? 'Excluir Matriz?' : 'Excluir Cliente?'}
              </h2>
              <p className="text-gray-500 font-bold leading-relaxed mb-10 px-4">
                {activeTab === 'products' 
                  ? 'Esta ação removerá permanentemente a matriz do catálogo e do Firebase. Deseja continuar?'
                  : 'Esta ação removerá permanentemente o cliente do sistema e do Firebase. Deseja continuar?'}
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => setDeletingId(null)}
                  className="flex-1 px-8 py-4 rounded-2xl font-black text-gray-400 hover:bg-gray-100 transition-all uppercase tracking-widest text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => activeTab === 'products' ? handleDelete(deletingId) : confirmDeleteUser(deletingId)}
                  className="flex-1 px-8 py-4 rounded-2xl font-black bg-red-600 text-white hover:bg-red-700 transition-all shadow-lg shadow-red-100 active:scale-95 uppercase tracking-widest text-sm"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    )}

      {activeTab === 'products' && (
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
          <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
            <h2 className="text-3xl font-black text-gray-800">Suas Matrizes</h2>
            <span className="bg-white px-6 py-2 rounded-full text-sm font-black text-gray-400 shadow-sm border border-gray-100 uppercase tracking-widest">
              {products.length} itens
            </span>
          </div>
          <div className="hidden md:block">
          <table className="w-full text-left">
            <thead className="bg-gray-50/50 border-b">
              <tr>
                <th className="px-8 py-6 text-sm font-black text-gray-400 uppercase tracking-widest">Matriz</th>
                <th className="px-8 py-6 text-sm font-black text-gray-400 uppercase tracking-widest">Categoria</th>
                <th className="px-8 py-6 text-sm font-black text-gray-400 uppercase tracking-widest">Preço</th>
                <th className="px-8 py-6 text-sm font-black text-gray-400 uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredProducts.map(product => (
                <tr key={product.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-20 rounded-2xl overflow-hidden bg-white border border-gray-100 flex items-center justify-center p-1 shadow-sm">
                        {product.imageUrl ? (
                          <img src={product.imageUrl} alt={product.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                        ) : (
                          <ImageIcon size={32} className="text-gray-200" />
                        )}
                      </div>
                      <div>
                        <p className="text-xl font-black text-gray-800">{product.name}</p>
                        <p className="text-gray-400 font-bold text-sm line-clamp-1">{product.description}</p>
                        {product.fileName && (
                          <p className="text-xs font-black text-purple-500 mt-1 flex items-center gap-1">
                            <FileText size={12} /> {product.fileName}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className="bg-purple-50 text-purple-600 px-4 py-1 rounded-full font-black text-xs uppercase tracking-widest">
                      {product.category}
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <span className="text-xl font-black text-gray-800">R$ {product.price.toFixed(2)}</span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setManagingReviewsId(product.id)}
                        className="p-3 text-pink-500 hover:bg-pink-50 rounded-xl transition-all"
                        title="Avaliações"
                      >
                        <MessageSquare size={24} />
                      </button>
                      <button
                        onClick={() => startEdit(product)}
                        className="p-3 text-blue-500 hover:bg-blue-50 rounded-xl transition-all"
                        title="Editar"
                      >
                        <Edit size={24} />
                      </button>
                      <button
                        onClick={() => setDeletingId(product.id)}
                        className="p-3 text-red-500 hover:bg-red-50 rounded-xl transition-all"
                        title="Excluir"
                      >
                        <Trash2 size={24} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="md:hidden divide-y divide-gray-50">
          {filteredProducts.map(product => (
            <div key={product.id} className="p-6 space-y-4">
              <div className="flex gap-4">
                <div className="w-24 h-24 rounded-2xl overflow-hidden bg-white border border-gray-100 flex items-center justify-center p-1 shadow-sm">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                  ) : (
                    <ImageIcon size={32} className="text-gray-200" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xl font-black text-gray-800 truncate">{product.name}</p>
                  <p className="text-purple-600 font-black text-sm uppercase tracking-widest">{product.category}</p>
                  <p className="text-lg font-black text-gray-800 mt-1">R$ {product.price.toFixed(2)}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setManagingReviewsId(product.id)}
                  className="flex-1 bg-pink-50 text-pink-600 py-3 rounded-xl font-black flex items-center justify-center gap-2"
                >
                  <MessageSquare size={20} /> Feedback
                </button>
                <button
                  onClick={() => startEdit(product)}
                  className="flex-1 bg-blue-50 text-blue-600 py-3 rounded-xl font-black flex items-center justify-center gap-2"
                >
                  <Edit size={20} /> Editar
                </button>
                <button
                  onClick={() => setDeletingId(product.id)}
                  className="w-12 bg-red-50 text-red-600 py-3 rounded-xl font-black flex items-center justify-center"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    )}
      {/* User Edit Modal */}
      <AnimatePresence>
        {editingUser && (
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
              className="bg-white p-8 rounded-3xl w-full max-w-lg shadow-2xl border border-gray-100"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
                  <User className="text-purple-600" />
                  <span>Editar Cliente</span>
                </h2>
                <button onClick={() => setEditingUser(null)} className="p-2 hover:bg-gray-100 rounded-full">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1 uppercase tracking-widest">Nome</label>
                  <input
                    type="text"
                    value={userFormData.name}
                    onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent focus:border-purple-500 focus:bg-white rounded-xl outline-none font-bold transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1 uppercase tracking-widest">E-mail</label>
                  <input
                    type="email"
                    value={userFormData.email}
                    onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent focus:border-purple-500 focus:bg-white rounded-xl outline-none font-bold transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1 uppercase tracking-widest">WhatsApp</label>
                  <input
                    type="text"
                    value={userFormData.whatsapp}
                    onChange={(e) => setUserFormData({ ...userFormData, whatsapp: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent focus:border-purple-500 focus:bg-white rounded-xl outline-none font-bold transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1 uppercase tracking-widest">Nova Senha (opcional)</label>
                  <div className="relative">
                    <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type={showUserPassword ? "text" : "password"}
                      placeholder="Deixe em branco para manter"
                      value={userFormData.password}
                      onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                      className="w-full pl-12 pr-12 py-3 bg-gray-50 border-2 border-transparent focus:border-purple-500 focus:bg-white rounded-xl outline-none font-bold transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowUserPassword(!showUserPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-purple-500 transition-colors cursor-pointer"
                    >
                      {showUserPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl">
                  <input
                    type="checkbox"
                    id="user-active"
                    checked={userFormData.active}
                    onChange={(e) => setUserFormData({ ...userFormData, active: e.target.checked })}
                    className="w-5 h-5 accent-purple-600"
                  />
                  <label htmlFor="user-active" className="font-bold text-gray-700 cursor-pointer">
                    Cliente Ativo (Pode acessar o app)
                  </label>
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => setEditingUser(null)}
                  className="flex-1 px-6 py-4 rounded-2xl font-black text-gray-500 hover:bg-gray-100 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleUpdateUser(editingUser.id)}
                  disabled={loading}
                  className="flex-1 bg-purple-600 text-white px-6 py-4 rounded-2xl font-black hover:bg-purple-700 transition-all shadow-lg shadow-purple-100 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="animate-spin" /> : <Save />}
                  Salvar Alterações
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
