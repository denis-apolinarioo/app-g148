'use client';

// ============================================================================
// Splash screen (tela de abertura do app) — usada SÓ em app/page.js, no
// momento em que o app decide pra onde te mandar (login / onboarding / feed).
// Não mexe no LoadingScreen.js genérico, que continua igual e é usado em
// todas as outras telas de carregamento do app.
//
// Tem duas animações:
// - ENTRADA: ao montar, a logo nasce com fade + leve zoom-in.
// - SAÍDA: quando a prop `saindo` vira true (controlado por app/page.js,
//   no momento exato em que já sabe pra onde vai navegar), a logo faz um
//   fade + leve zoom-out antes da navegação acontecer de fato.
// ============================================================================

import { useEffect, useState } from 'react';

export default function SplashScreen({ saindo = false }) {
  const [entrou, setEntrou] = useState(false);

  useEffect(() => {
    // pequeno delay só pra garantir que o navegador aplique o estado inicial
    // (opacidade 0) antes de animar pra opacidade 1 — senão a transição não roda
    const id = requestAnimationFrame(() => setEntrou(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const visivel = entrou && !saindo;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-cream">
      <div
        className={
          'flex flex-col items-center gap-4 transition-all duration-500 ease-out ' +
          (visivel ? 'scale-100 opacity-100' : saindo ? 'scale-105 opacity-0' : 'scale-90 opacity-0')
        }
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icons/icon-512.png"
          alt="Geração 148"
          width={96}
          height={96}
          className="h-24 w-24 rounded-2xl shadow-sm"
        />
        <div className="flex flex-col items-center gap-1">
          <h1 className="font-destaque text-xl font-semibold text-coffee-800">Geração 148</h1>
          <p className="text-xs text-coffee-400">Itumbiara</p>
        </div>
      </div>

      <div
        className={
          'flex gap-1.5 transition-opacity duration-500 ' + (visivel ? 'opacity-100' : 'opacity-0')
        }
      >
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-coffee-300 [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-coffee-300 [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-coffee-300" />
      </div>
    </div>
  );
}
