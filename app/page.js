'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import SplashScreen from '@/components/SplashScreen';

const DURACAO_ANIMACAO_SAIDA_MS = 500; // deve bater com a duration-500 do SplashScreen
const TEMPO_MINIMO_VISIVEL_MS = 1400; // splash fica visível pelo menos esse tempo, mesmo se o login carregar rápido

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

    const decorrido = Date.now() - (montadoEmRef.current || Date.now());
    const esperaAntesDeSair = Math.max(0, TEMPO_MINIMO_VISIVEL_MS - decorrido);

    // Só começa a animação de saída depois do tempo mínimo visível — evita
    // a splash "piscar" quando o login carrega muito rápido (ex.: sessão já
    // em cache do navegador), que era o que estava acontecendo.
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
