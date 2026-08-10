'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { preloadFeedInicial, preloadAvataresComunidade } from '@/lib/preload';

// Splash screen removida a pedido do Denis — atrasava a entrada no app sem
// necessidade. Agora, assim que o estado de login é conhecido, a gente já
// navega direto pra tela final (feed/login/onboarding), sem tela intermediária
// nem espera artificial.
export default function RootPage() {
  const { usuarioAuth, perfil, carregando } = useAuth();
  const router = useRouter();
  const jaNavegouRef = useRef(false);

  useEffect(() => {
    if (carregando || jaNavegouRef.current) return;
    jaNavegouRef.current = true;

    let destino = '/feed';
    if (!usuarioAuth) destino = '/login';
    else if (!perfil) destino = '/onboarding';

    router.replace(destino);

    // Continua esquentando o cache de imagens do Feed/Ranking/Perfil em
    // segundo plano — só que agora sem travar a navegação esperando isso
    // terminar (nenhuma das duas funções rejeita, então é seguro disparar
    // e esquecer).
    if (destino === '/feed') {
      preloadFeedInicial();
      preloadAvataresComunidade();
    }
  }, [carregando, usuarioAuth, perfil, router]);

  return null;
}
