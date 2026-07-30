'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getUserProfile, subscribeToUserProfile } from '@/lib/firestore-helpers';
import { solicitarArmazenamentoPersistente } from '@/lib/imageCache';

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
    solicitarArmazenamentoPersistente();
  }, []);

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
    const unsubscribePerfil = subscribeToUserProfile(
      usuarioAuth.uid,
      (dados) => {
        setPerfil(dados);
        setCarregando(false);
      },
      // ANTES: se essa escuta desse erro (permissão negada, rede instável
      // etc.), carregando nunca virava false e o app ficava preso na splash
      // pra sempre, sem nenhuma mensagem.
      // AGORA: mesmo com erro, libera a tela em vez de travar pra sempre —
      // na pior das hipóteses a pessoa cai no login/onboarding e pode tentar
      // de novo, em vez de ficar olhando pra uma splash que nunca sai.
      () => setCarregando(false)
    );
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
