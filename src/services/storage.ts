import { ref, get, set, child, onValue } from 'firebase/database';
import { db, auth } from '../firebase';

const USERS_KEY = 'bordado_magico_users';
const PRODUCTS_KEY = 'bordado_magico_products';
const ORDERS_KEY = 'bordado_magico_orders';
const CONFIG_KEY = 'bordado_magico_config';
const FAVORITES_KEY = 'bordado_magico_favorites';

export interface User {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
  age: number;
  role: 'client' | 'manager';
  active: boolean;
  status: 'active' | 'pending' | 'inactive';
  accessToken: string;
  createdAt: string;
}

export interface Review {
  id: string;
  userName: string;
  rating: number;
  comment: string;
  date: string;
  imageUrl?: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  fileUrl?: string;
  fileName?: string;
  gcsPath?: string;
  category: string;
  createdAt: string;
  soldCount: number;
  reviews: Review[];
}

export interface Order {
  id: string;
  userId: string;
  productId: string;
  status: string;
  amount: number;
  createdAt: string;
}

export interface AppConfig {
  buttonsEnabled: boolean;
}

export const fileToBase64 = (file: File | Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

export const compressImage = (base64: string, maxWidth = 800, quality = 0.7): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = (maxWidth / width) * height;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
  });
};

const getInitialProducts = (): Product[] => [
  {
    id: '1',
    name: 'Matriz Floral Delicada',
    description: 'Um lindo arranjo de flores para toalhas e enxovais.',
    price: 25.90,
    imageUrl: 'https://picsum.photos/seed/floral/800/600',
    category: 'Flores',
    createdAt: new Date().toISOString(),
    soldCount: 145,
    reviews: [
      { id: 'r1', userName: 'Maria Silva', rating: 5, comment: 'Bordado perfeito, sem falhas!', date: new Date().toISOString() },
      { id: 'r2', userName: 'Ana Paula', rating: 4, comment: 'Muito bonito, recomendo.', date: new Date().toISOString() }
    ]
  },
  {
    id: '2',
    name: 'Ursinho de Pelúcia',
    description: 'Ideal para enxoval de bebê e mantas infantis.',
    price: 19.90,
    imageUrl: 'https://picsum.photos/seed/bear/800/600',
    category: 'Infantil',
    createdAt: new Date().toISOString(),
    soldCount: 89,
    reviews: [
      { id: 'r3', userName: 'Carla Souza', rating: 5, comment: 'Ficou lindo no enxoval do meu neto.', date: new Date().toISOString() }
    ]
  },
  {
    id: '3',
    name: 'Brasão Clássico',
    description: 'Elegância para uniformes e itens personalizados.',
    price: 35.00,
    imageUrl: 'https://picsum.photos/seed/crest/800/600',
    category: 'Brasões',
    createdAt: new Date().toISOString(),
    soldCount: 56,
    reviews: []
  }
];

export const storage = {
  getUsers: (): User[] => JSON.parse(localStorage.getItem(USERS_KEY) || '[]'),
  saveUsers: (users: User[]) => localStorage.setItem(USERS_KEY, JSON.stringify(users)),
  
  getProducts: (): Product[] => {
    const stored = localStorage.getItem(PRODUCTS_KEY);
    if (!stored) {
      const initial = getInitialProducts();
      localStorage.setItem(PRODUCTS_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(stored);
    return parsed.map((p: any) => ({
      ...p,
      price: typeof p.price === 'number' && !isNaN(p.price) ? p.price : 0,
      category: p.category || 'Outros',
      soldCount: p.soldCount || 0,
      reviews: p.reviews || []
    }));
  },
  saveProducts: (products: Product[]) => {
    try {
      const sanitized = products.map(p => ({ ...p, id: String(p.id) }));
      localStorage.setItem(PRODUCTS_KEY, JSON.stringify(sanitized));
    } catch (e) {
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        console.error('Storage quota exceeded! Try deleting some products.');
        alert('O limite de armazenamento foi atingido. Por favor, remova alguns produtos antigos para continuar.');
      }
      throw e;
    }
  },
  
  getOrders: (): Order[] => JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]'),
  saveOrders: (orders: Order[]) => localStorage.setItem(ORDERS_KEY, JSON.stringify(orders)),
  
  getConfig: (): AppConfig => {
    const stored = localStorage.getItem(CONFIG_KEY);
    if (!stored) {
      const initial = { buttonsEnabled: true };
      localStorage.setItem(CONFIG_KEY, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(stored);
  },
  saveConfig: (config: AppConfig) => localStorage.setItem(CONFIG_KEY, JSON.stringify(config)),

  getFavorites: (): string[] => JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]'),
  toggleFavorite: (productId: string) => {
    const favorites = storage.getFavorites();
    const index = favorites.indexOf(productId);
    if (index === -1) {
      favorites.push(productId);
    } else {
      favorites.splice(index, 1);
    }
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  },

  getCurrentUser: (): User | null => {
    const userId = localStorage.getItem('bordado_magico_current_user_id');
    if (!userId) return null;
    return storage.getUsers().find(u => u.id === userId) || null;
  },
  setCurrentUser: (user: User | null) => {
    if (user) {
      localStorage.setItem('bordado_magico_current_user_id', user.id);
    } else {
      localStorage.removeItem('bordado_magico_current_user_id');
    }
  },

  // Realtime Database Methods
  async syncUserToRTDB(user: User) {
    try {
      await set(ref(db, `users/${user.id}`), user);
    } catch (error) {
      console.error('Error syncing user to RTDB:', error);
      throw error;
    }
  },

  async getUserFromRTDB(userId: string): Promise<User | null> {
    try {
      const snapshot = await get(child(ref(db), `users/${userId}`));
      return snapshot.exists() ? (snapshot.val() as User) : null;
    } catch (error) {
      console.error('Error getting user from RTDB:', error);
      return null;
    }
  },

  // Products RTDB Methods
  async syncProductsToRTDB(products: Product[]) {
    // Try automatic login for master user if not authenticated
    if (!auth.currentUser) {
      const currentUser = storage.getCurrentUser();
      if (currentUser?.accessToken === 'MASTER_ACCESS' && currentUser.email === 'bryannogueira07@gmail.com') {
        try {
          const { signInWithEmailAndPassword, createUserWithEmailAndPassword } = await import('firebase/auth');
          try {
            await signInWithEmailAndPassword(auth, 'bryannogueira07@gmail.com', 'admin123');
            console.log('Automatic master login successful for sync.');
          } catch (loginErr: any) {
            if (loginErr.code === 'auth/user-not-found') {
              console.log('Master account not found in Firebase. Creating it automatically...');
              await createUserWithEmailAndPassword(auth, 'bryannogueira07@gmail.com', 'admin123');
              console.log('Automatic master registration successful for sync.');
            } else {
              throw loginErr;
            }
          }
        } catch (e) {
          console.warn('Automatic master login/registration failed for sync:', e);
        }
      }
    }

    if (!auth.currentUser) {
      const error = new Error('Tentativa de sincronização sem usuário autenticado pelo Firebase.');
      console.error(error.message);
      throw error;
    }

    try {
      console.log('Syncing products for user:', auth.currentUser.email, 'Verified:', auth.currentUser.emailVerified);
      await set(ref(db, 'products'), products);
      console.log('Products synced successfully to RTDB.');
    } catch (error: any) {
      console.error('Error syncing products to RTDB:', error);
      if (error.message?.includes('PERMISSION_DENIED')) {
        console.error('Auth State:', {
          uid: auth.currentUser.uid,
          email: auth.currentUser.email,
          verified: auth.currentUser.emailVerified
        });
      }
      throw error;
    }
  },

  async getProductsFromRTDB(): Promise<Product[]> {
    // Try automatic login for master user if not authenticated
    if (!auth.currentUser) {
      const currentUser = storage.getCurrentUser();
      if (currentUser?.accessToken === 'MASTER_ACCESS' && currentUser.email === 'bryannogueira07@gmail.com') {
        try {
          const { signInWithEmailAndPassword, createUserWithEmailAndPassword } = await import('firebase/auth');
          try {
            await signInWithEmailAndPassword(auth, 'bryannogueira07@gmail.com', 'admin123');
          } catch (loginErr: any) {
            if (loginErr.code === 'auth/user-not-found') {
              await createUserWithEmailAndPassword(auth, 'bryannogueira07@gmail.com', 'admin123');
            }
          }
        } catch (e) {
          // Ignore
        }
      }
    }

    try {
      const snapshot = await get(child(ref(db), 'products'));
      if (snapshot.exists()) {
        const data = snapshot.val();
        return Array.isArray(data) ? data : Object.values(data);
      }
      return [];
    } catch (error) {
      console.error('Error getting products from RTDB:', error);
      return [];
    }
  },

  subscribeToProducts(callback: (products: Product[]) => void) {
    // Try automatic login for master user in background if not authenticated
    if (!auth.currentUser) {
      const currentUser = storage.getCurrentUser();
      if (currentUser?.accessToken === 'MASTER_ACCESS' && currentUser.email === 'bryannogueira07@gmail.com') {
        import('firebase/auth').then(({ signInWithEmailAndPassword }) => {
          signInWithEmailAndPassword(auth, 'bryannogueira07@gmail.com', 'admin123')
            .then(() => console.log('Background master login successful for subscription.'))
            .catch(e => console.warn('Background master login failed for subscription:', e));
        });
      }
    }

    const productsRef = ref(db, 'products');
    return onValue(productsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const products = Array.isArray(data) ? data : Object.values(data);
        callback(products as Product[]);
      } else {
        // If RTDB is empty, don't clear local state immediately, 
        // let the component decide or use local storage
        console.log('RTDB products path is empty.');
        const local = storage.getProducts();
        if (local.length > 0) {
          callback(local);
        } else {
          callback([]);
        }
      }
    }, (error) => {
      console.error('Error subscribing to products:', error);
      // Fallback to local storage on error
      callback(storage.getProducts());
    });
  }
};
