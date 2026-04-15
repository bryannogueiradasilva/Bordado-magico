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

export const storage = {
  getUsers: (): User[] => JSON.parse(localStorage.getItem(USERS_KEY) || '[]'),
  saveUsers: (users: User[]) => localStorage.setItem(USERS_KEY, JSON.stringify(users)),
  
  getProducts: (): Product[] => {
    const stored = localStorage.getItem(PRODUCTS_KEY);
    if (!stored) return [];
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

  async deleteUserFromRTDB(userId: string) {
    try {
      await set(ref(db, `users/${userId}`), null);
    } catch (error) {
      console.error('Error deleting user from RTDB:', error);
      throw error;
    }
  },

  subscribeToUsers(callback: (users: User[]) => void) {
    const usersRef = ref(db, 'users');
    return onValue(usersRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const users = Object.values(data);
        callback(users as User[]);
      } else {
        callback([]);
      }
    }, (error) => {
      console.error('Error subscribing to users:', error);
      callback(storage.getUsers());
    });
  },

  // Products RTDB Methods
  async syncProductsToRTDB(products: Product[]) {
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
    const productsRef = ref(db, 'products');
    return onValue(productsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const products = Array.isArray(data) ? data : Object.values(data);
        callback(products as Product[]);
      } else {
        console.log('RTDB products path is empty.');
        callback([]);
      }
    }, (error) => {
      console.error('Error subscribing to products:', error);
      callback(storage.getProducts());
    });
  }
};
