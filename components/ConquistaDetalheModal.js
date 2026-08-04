'use client';

import { X } from 'lucide-react';
import EmblemaConquista from '@/components/EmblemaConquista';

/**
 * Modal de detalhe de uma conquista — abre ao tocar em qualquer badge
 * (components/AchievementBadge.js), desbloqueada ou não. Mostra o emblema
 * (moldura do tier + foto/ícone, via EmblemaConquista), o nome e o texto
 * configurados no painel Admin.
 */
export default function ConquistaDetalheModal({ conquista, onFechar }) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-coffee-900/40 sm:items-center"
      onClick={onFechar}
    >
      <div
        className="relative max-h-[85vh] w-full max-w-xs overflow-y-auto rounded-t-2xl bg-cream p-6 text-center sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onFechar}
          className="absolute right-4 top-4 rounded-full p-1 text-coffee-400"
        >
          <X size={18} />
        </button>

        <div className="mx-auto flex items-center justify-center">
          <EmblemaConquista conquista={conquista} size={96} />
        </div>

        <p className="mt-4 font-destaque text-lg font-semibold text-coffee-800">
          {conquista.nome}
        </p>
        <p className="mt-1.5 text-sm text-coffee-500">{conquista.descricao}</p>

        {!conquista.desbloqueada && conquista.meta != null && (
          <p className="mt-3 text-xs font-medium text-coffee-300">
            Ainda não desbloqueada — meta: {conquista.meta}
          </p>
        )}
      </div>
    </div>
  );
}
