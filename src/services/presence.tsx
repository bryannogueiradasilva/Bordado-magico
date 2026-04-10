import React, { createContext, useContext, useEffect, useState } from 'react';
import { ref, set, onDisconnect, onValue, serverTimestamp } from 'firebase/database';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../firebase';
import { User as UserType } from './storage';

interface PresenceContextType {
  globalOnlineCount: number;
  pageOnlineCount: number;
  currentPageId: string | null;
  setCurrentPageId: (id: string | null) => void;
  authError: string | null;
}

const PresenceContext = createContext<PresenceContextType | undefined>(undefined);

export const usePresence = () => {
  const context = useContext(PresenceContext);
  if (!context) {
    throw new Error('usePresence must be used within a PresenceProvider');
  }
  return context;
};

export const PresenceProvider: React.FC<{ user: UserType | null; children: React.ReactNode }> = ({ user, children }) => {
  const [globalOnlineCount, setGlobalOnlineCount] = useState(0);
  const [pageOnlineCount, setPageOnlineCount] = useState(0);
  const [currentPageId, setCurrentPageId] = useState<string | null>(null);
  const [isFirebaseAuthenticated, setIsFirebaseAuthenticated] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // 1. Handle Firebase Authentication State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser) {
        setIsFirebaseAuthenticated(true);
        setAuthError(null);
      } else {
        setIsFirebaseAuthenticated(false);
        setAuthError("Faça login para ver quem está online.");
      }
    });
    
    return () => unsubscribe();
  }, []);

  // 2. Handle Global Presence
  useEffect(() => {
    if (!isFirebaseAuthenticated || !auth.currentUser) {
      setGlobalOnlineCount(0);
      return;
    }

    const uid = auth.currentUser.uid;
    const globalRef = ref(db, `online/global/${uid}`);
    const globalListRef = ref(db, 'online/global');

    // Set presence and setup onDisconnect
    const setupPresence = async () => {
      try {
        await set(globalRef, {
          online: true,
          lastSeen: serverTimestamp(),
          appUserId: user?.id || 'anonymous',
          name: user?.name || 'Visitante'
        });
        await onDisconnect(globalRef).remove();
      } catch (err) {
        console.error("Erro ao configurar presença:", err);
      }
    };

    setupPresence();

    // Listen for global count
    const unsubscribeGlobal = onValue(globalListRef, (snapshot) => {
      const data = snapshot.val();
      setGlobalOnlineCount(data ? Object.keys(data).length : 0);
    });

    return () => {
      unsubscribeGlobal();
      set(globalRef, null).catch(() => {}); // Manually clear if unmounting
    };
  }, [isFirebaseAuthenticated, user?.id, user?.name]);

  // 3. Handle Page Presence
  useEffect(() => {
    if (!isFirebaseAuthenticated || !currentPageId || !auth.currentUser) {
      setPageOnlineCount(0);
      return;
    }

    const uid = auth.currentUser.uid;
    const pageRef = ref(db, `online/paginas/${currentPageId}/${uid}`);
    const pageListRef = ref(db, `online/paginas/${currentPageId}`);

    // Set presence on page and setup onDisconnect
    const setupPagePresence = async () => {
      try {
        await set(pageRef, {
          online: true,
          lastSeen: serverTimestamp(),
          name: user?.name || 'Visitante'
        });
        await onDisconnect(pageRef).remove();
      } catch (err) {
        console.error("Erro ao configurar presença na página:", err);
      }
    };

    setupPagePresence();

    // Listen for page count
    const unsubscribePage = onValue(pageListRef, (snapshot) => {
      const data = snapshot.val();
      setPageOnlineCount(data ? Object.keys(data).length : 0);
    });

    return () => {
      unsubscribePage();
      set(pageRef, null).catch(() => {}); // Manually clear if unmounting
    };
  }, [isFirebaseAuthenticated, currentPageId, user?.name]);

  return (
    <PresenceContext.Provider value={{ globalOnlineCount, pageOnlineCount, currentPageId, setCurrentPageId, authError }}>
      {children}
    </PresenceContext.Provider>
  );
};
