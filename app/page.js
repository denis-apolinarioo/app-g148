'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import SplashScreen from '@/components/SplashScreen';
import { preloadFeedInicial } from '@/lib/preload';

const DURACAO_ANIMACAO_SAIDA_MS = 500; // deve bater com a duration-500 do SplashScreen
const TEMPO_MINIMO_VISIVEL_MS = 1700; // splash fica visível pelo menos esse tempo (evita "piscar" quando carrega rápido demais)
const TEMPO_MAXIMO_ESPERA_MS = 5000; // trava de segurança: nunca espera o carregamento por mais que isso (internet ruim/caiu)

export default function RootPage() {
  const { usuarioAuth, perfil, carregando } = useAuth();
  const router = useRouter();
  const [saindo, setSaindo] = useState(false);
  const jaAgendouRef = useRef(false);

  useEffect(() => {
    if (carregando || jaAgendouRef.current) return;
    jaAgendouRef.current = true;

    let cancelado = false;
    let timerNavegar = null;

    let destino = '/feed';
    if (!usuarioAuth) destino = '/login';
    else if (!perfil) destino = '/onboarding';

    // Promessa que só resolve quando o feed (posts + fotos + autores) já
    // está pronto em cache. Se o destino não for o feed, não tem o que
    // esperar. preloadFeedInicial() nunca rejeita (ela mesma trata os
    // próprios erros e não lança pra fora) — então essa promessa sempre
    // resolve, cedo ou tarde.
    const promessaCarregamento = destino === '/feed' ? preloadFeedInicial() : Promise.resolve();

    const espera = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    // ANTES: a splash saía depois de um tempo fixo, sem checar se o feed
    // já tinha carregado de verdade — por isso às vezes ela sumia e a
    // tela seguinte ainda aparecia vazia/carregando.
    //
    // AGORA: a splash só sai quando as duas coisas acontecerem:
    //  1) o tempo mínimo visível já passou (pra não piscar em conexões rápidas)
    //  2) o carregamento real já terminou — e não só disparou
    // Com uma trava de tempo máximo: se o carregamento demorar demais
    // (sem internet, Firebase lento etc.), a splash sai mesmo assim depois
    // de TEMPO_MAXIMO_ESPERA_MS, pra nunca prender o usuário numa tela travada.
    Promise.all([
      espera(TEMPO_MINIMO_VISIVEL_MS),
      Promise.race([promessaCarregamento, espera(TEMPO_MAXIMO_ESPERA_MS)]),
    ]).then(() => {
      if (cancelado) return;
      setSaindo(true);
      timerNavegar = setTimeout(() => {
        if (!cancelado) router.replace(destino);
      }, DURACAO_ANIMACAO_SAIDA_MS);
    });

    return () => {
      cancelado = true;
      if (timerNavegar) clearTimeout(timerNavegar);
    };
  }, [carregando, usuarioAuth, perfil, router]);

  return <SplashScreen saindo={saindo} />;
}
