'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getUserProfile, subscribeToUserProfile } from '@/lib/firestore-helpers';
import { solicitarArmazenamentoPersistente } from '@/lib/imageCache';
import { escutarPushEmPrimeiroPlano, sincronizarBadge } from '@/lib/push';
import { verificarConquistas } from '@/lib/achievements';

const AuthContext = createContext({
  usuarioAuth: null,
  perfil: null,
  carregando: true,
});

export function AuthProvider({ children }) {
  const [usuarioAuth, setUsuarioAuth] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const router = useRouter();

  useEffect(() => {
    solicitarArmazenamentoPersistente();
  }, []);

  // Com o app ABERTO, quem recebe o push é este listener (não o Service
  // Worker — é assim que o FCM funciona). A função escutarPushEmPrimeiroPlano
  // já existia em lib/push.js, mas nunca era chamada em lugar nenhum: o push
  // chegava, e nada aparecia na tela. Aqui ela é ligada globalmente (uma vez
  // só, pro app inteiro), espelhando o mesmo tratamento que o Service Worker
  // já faz em background (public/firebase-messaging-sw.js): mostra uma
  // notificação e sincroniza o badge do ícone.
  useEffect(() => {
    if (!usuarioAuth) return undefined;
    let cancelado = false;
    let pararDeEscutar = () => {};

    escutarPushEmPrimeiroPlano((payload) => {
      const dados = payload.data || {};
      const titulo = (payload.notification && payload.notification.title) || 'G148';
      const corpo = (payload.notification && payload.notification.body) || '';

      if (dados.badgeCount !== undefined) {
        sincronizarBadge(Number(dados.badgeCount) || 0);
      }

      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        const notificacao = new Notification(titulo, {
          body: corpo,
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-badge-monochrome.png',
          tag: dados.tipo === 'mensagem' ? 'g148-mensagens' : 'g148-social',
        });
        notificacao.onclick = () => {
          window.focus();
          router.push(dados.url || '/correio');
          notificacao.close();
        };
      }
    }).then((unsub) => {
      if (cancelado) unsub();
      else pararDeEscutar = unsub;
    });

    return () => {
      cancelado = true;
      pararDeEscutar();
    };
  }, [usuarioAuth, router]);

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

  // CONQUISTAS NOVAS — checagens que só fazem sentido rodar "de vez em
  // quando" (não têm 1 evento só que dispare sozinho, ou dependem de uma
  // ação de OUTRA pessoa que a regra do Firestore não deixa conceder na
  // sessão de quem agiu — ver comentário em lib/achievements.js,
  // contexto 'sessao'): "Adão e Eva do App" (1 ano de conta), "Luz do Feed"
  // (curtidas recebidas) e "Publicano" (saldo de Dracma via transferência
  // recebida). Roda 1x por sessão, quando a pessoa abre o app logada.
  useEffect(() => {
    if (!usuarioAuth) return;
    verificarConquistas(usuarioAuth.uid, 0, 'sessao').catch((err) => {
      console.error('Erro ao checar conquistas de sessão:', err);
    });
  }, [usuarioAuth]);

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
