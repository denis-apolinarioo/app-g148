'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import SplashScreen from '@/components/SplashScreen';
import { preloadFeedInicial } from '@/lib/preload';

const DURACAO_ANIMACAO_SAIDA_MS = 500; // deve bater com a duration-500 do SplashScreen
const TEMPO_MINIMO_VISIVEL_MS = 1700; // splash fica visível pelo menos esse tempo

export default function RootPage() {
  const { usuarioAuth, perfil, carregando } = useAuth();
  const router = useRouter();
  const [saindo, setSaindo] = useState(false);
  const jaAgendouRef = useRef(false);
  const montadoEmRef = useRef(null);

  useEffect(() => {
    montadoEmRef.current = Date.now();
  }, []);

  useEffect(() => {
    if (carregando || jaAgendouRef.current) return;
    jaAgendouRef.current = true;

    let destino = '/feed';
    if (!usuarioAuth) destino = '/login';
    else if (!perfil) destino = '/onboarding';

    // Dispara o carregamento em segundo plano ENQUANTO a splash ainda está
    // visível — assim, quando ela sair, o feed já tem os posts, fotos e
    // autores prontos em cache, em vez de aparecer vazio/esqueleto depois
    // que a splash fecha.
    if (destino === '/feed') {
      preloadFeedInicial();
    }

    const decorrido = Date.now() - (montadoEmRef.current || Date.now());
    const esperaAntesDeSair = Math.max(0, TEMPO_MINIMO_VISIVEL_MS - decorrido);

    // Só começa a animação de saída depois do tempo mínimo visível — evita
    // a splash "piscar" quando o login carrega muito rápido.
    const timerEspera = setTimeout(() => {
      setSaindo(true);
    }, esperaAntesDeSair);

    const timerNavegar = setTimeout(() => {
      router.replace(destino);
    }, esperaAntesDeSair + DURACAO_ANIMACAO_SAIDA_MS);

    return () => {
      clearTimeout(timerEspera);
      clearTimeout(timerNavegar);
    };
  }, [carregando, usuarioAuth, perfil, router]);

  return <SplashScreen saindo={saindo} />;
}
