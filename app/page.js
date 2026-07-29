'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import SplashScreen from '@/components/SplashScreen';

const DURACAO_ANIMACAO_SAIDA_MS = 500; // deve bater com a duration-500 do SplashScreen

export default function RootPage() {
  const { usuarioAuth, perfil, carregando } = useAuth();
  const router = useRouter();
  const [saindo, setSaindo] = useState(false);
  const jaAgendouRef = useRef(false);

  useEffect(() => {
    if (carregando || jaAgendouRef.current) return;
    jaAgendouRef.current = true;

    let destino = '/feed';
    if (!usuarioAuth) destino = '/login';
    else if (!perfil) destino = '/onboarding';

    // Dispara a animação de saída primeiro, e só navega depois dela terminar
    // — assim a splash sempre é vista "fechando" em vez de sumir de repente.
    setSaindo(true);
    const timer = setTimeout(() => {
      router.replace(destino);
    }, DURACAO_ANIMACAO_SAIDA_MS);

    return () => clearTimeout(timer);
  }, [carregando, usuarioAuth, perfil, router]);

  return <SplashScreen saindo={saindo} />;
}
