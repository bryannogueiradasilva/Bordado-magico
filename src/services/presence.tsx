import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import { User as UserType } from './storage';
import { API_BASE_URL } from '../config';

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

const ONLINE_THRESHOLD = 30000; // 30 segundos

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

  // 2. Heartbeat e Presence Tracking
  useEffect(() => {
    if (!isFirebaseAuthenticated || !auth.currentUser) return;

    const uid = auth.currentUser.uid;

    const updateUserPresence = async () => {
      try {
        await fetch(API_BASE_URL + "/api/presence/update", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            uid: uid,
            lastSeen: Date.now(),
          }),
        });
      } catch (err) {
        console.error("Erro no heartbeat de presença:", err);
      }
    };

    // Heartbeat inicial
    updateUserPresence();

    // Heartbeat a cada 10 segundos
    const heartbeatInterval = setInterval(updateUserPresence, 10000);

    // Marcar offline ao sair (beforeunload)
    const handleBeforeUnload = () => {
      navigator.sendBeacon(
        API_BASE_URL + "/api/presence/offline",
        JSON.stringify({ uid: uid })
      );
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      clearInterval(heartbeatInterval);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      // Tenta marcar offline ao desmontar o componente também
      fetch(API_BASE_URL + "/api/presence/offline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: uid }),
        keepalive: true
      }).catch(() => {});
    };
  }, [isFirebaseAuthenticated]);

  // 3. Fetch Presence List e Contagem
  useEffect(() => {
    const fetchPresence = async () => {
      try {
        const res = await fetch(API_BASE_URL + "/api/presence/list");
        const data = await res.json();
        
        if (data.presence) {
          const now = Date.now();
          // Filtrar duplicados e usuários inativos (threshold)
          const uniqueUsersMap = new Map();
          data.presence.forEach((p: any) => {
            if (now - p.lastSeen < ONLINE_THRESHOLD) {
              uniqueUsersMap.set(p.uid, p);
            }
          });

          const onlineUsers = Array.from(uniqueUsersMap.values());
          setGlobalOnlineCount(onlineUsers.length);
          
          // Nota: A contagem por página pode ser implementada se a rota suportar, 
          // mas por enquanto mantemos a global conforme solicitado.
          setPageOnlineCount(onlineUsers.length); 
        }
      } catch (err) {
        console.error("Erro ao buscar lista de presença:", err);
      }
    };

    // Busca inicial
    fetchPresence();

    // Atualiza a cada 5 segundos
    const fetchInterval = setInterval(fetchPresence, 5000);

    return () => clearInterval(fetchInterval);
  }, []);

  return (
    <PresenceContext.Provider value={{ globalOnlineCount, pageOnlineCount, currentPageId, setCurrentPageId, authError }}>
      {children}
    </PresenceContext.Provider>
  );
};
