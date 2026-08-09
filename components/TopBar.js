'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

// `voltarPara` continua aceitando um caminho fixo (Link normal, como sempre
// foi). `voltarPorHistorico` é uma alternativa nova: usa router.back(), pra
// telas acessadas de mais de um lugar (ex.: /post/[postId], que agora abre
// tanto da Denúncia do Admin quanto de uma notificação do Correio) voltarem
// pro lugar de onde a pessoa realmente veio, não pra um destino fixo.
export default function TopBar({ titulo, voltarPara, voltarPorHistorico, acao }) {
  const router = useRouter();

  return (
    // Sem transition-colors própria aqui: a troca de cor ao alternar tema
    // agora é coberta pelo cross-fade da View Transition (ver lib/theme.js
    // e app/globals.css), junto com o resto da tela. Ter uma transição
    // separada nessa barra (como tinha antes) fazia ela ficar dessincronizada
    // do resto — mudando de cor num ritmo diferente, com delay perceptível.
    <header className="sticky top-0 z-30 flex items-center gap-2 bg-cream/95 px-4 py-3.5 backdrop-blur pt-[calc(env(safe-area-inset-top)+0.875rem)]">
      {voltarPorHistorico ? (
        <button
          type="button"
          onClick={() => router.back()}
          className="-ml-1.5 flex h-8 w-8 items-center justify-center rounded-full text-coffee-600"
        >
          <ChevronLeft size={22} />
        </button>
      ) : (
        voltarPara && (
          <Link
            href={voltarPara}
            className="-ml-1.5 flex h-8 w-8 items-center justify-center rounded-full text-coffee-600"
          >
            <ChevronLeft size={22} />
          </Link>
        )
      )}
      <h1 className="flex-1 truncate font-destaque text-lg font-semibold text-coffee-800">
        {titulo}
      </h1>
      {acao}
    </header>
  );
}
