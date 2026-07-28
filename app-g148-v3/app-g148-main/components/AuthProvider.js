'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getUserProfile, subscribeToUserProfile } from '@/lib/firestore-helpers';

const AuthContext = createContext({
  usuarioAuth: null,
  perfil: null,
  carregando: true,
});

export function AuthProvider({ children }) {
  const [usuarioAuth, setUsuarioAuth] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setUsuarioAuth(user);
      if (!user) {
        setPerfil(null);
        setCarregando(false);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!usuarioAuth) return undefined;

    // Enquanto o perfil ainda não existe (pessoa no meio do onboarding),
    // subscribeToUserProfile vai retornar null — a tela de onboarding trata
    // esse caso, não é um erro.
    const unsubscribePerfil = subscribeToUserProfile(usuarioAuth.uid, (dados) => {
      setPerfil(dados);
      setCarregando(false);
    });
    return () => unsubscribePerfil();
  }, [usuarioAuth]);

  return (
    <AuthContext.Provider value={{ usuarioAuth, perfil, carregando }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
