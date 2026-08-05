'use client';

import { X, Lock } from 'lucide-react';
import EmblemaConquista from '@/components/EmblemaConquista';

const TAMANHO_DETALHE = 132;

/**
 * Modal de detalhe de uma conquista — abre ao tocar em qualquer badge
 * (components/AchievementBadge.js), desbloqueada ou não. Popup flutuante
 * centralizado (não é mais uma gaveta subindo do rodapé), com o emblema
 * grande (moldura do tier + foto/ícone, via EmblemaConquista), o nome e o
 * texto configurados no painel Admin.
 *
 * Pra bloqueadas, o cadeado padrão do EmblemaConquista (pequeno, pensado
 * pro selo mini do grid) é substituído aqui por um selo próprio maior —
 * `mostrarCadeado={false}` desliga o embutido e o cadeado "bonito" é
 * desenhado por cima, sobre o emblema já acinzentado.
 */
export default function ConquistaDetalheModal({ conquista, onFechar }) {
  const desbloqueada = !!conquista.desbloqueada;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-coffee-900/50 p-4 backdrop-blur-sm"
      onClick={onFechar}
    >
      <div
        className="relative w-full max-w-xs animate-popupFlutuante rounded-3xl bg-cream p-7 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onFechar}
          className="absolute right-4 top-4 rounded-full p-1 text-coffee-400"
        >
          <X size={18} />
        </button>

        <div
          className="relative mx-auto"
          style={{ width: TAMANHO_DETALHE, height: TAMANHO_DETALHE }}
        >
          <EmblemaConquista conquista={conquista} size={TAMANHO_DETALHE} mostrarCadeado={false} />

          {!desbloqueada && (
            <div className="absolute inset-0 z-20 flex items-center justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-coffee-800 shadow-lg ring-4 ring-cream">
                <Lock size={28} strokeWidth={2.2} className="text-cream" />
              </div>
            </div>
          )}
        </div>

        <p className="mt-5 font-destaque text-xl font-semibold text-coffee-800">
          {conquista.nome}
        </p>
        <p className="mt-2 text-sm text-coffee-500">{conquista.descricao}</p>

        {!desbloqueada && conquista.meta != null && (
          <p className="mt-3 text-xs font-medium text-coffee-300">
            Ainda não desbloqueada — meta: {conquista.meta}
          </p>
        )}
      </div>
    </div>
  );
}
