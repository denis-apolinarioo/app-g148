'use client';

import * as Icons from 'lucide-react';
import { X, Lock } from 'lucide-react';
import { iconePascalCase } from '@/lib/missionIcons';

/**
 * Modal de detalhe de uma conquista — abre ao tocar em qualquer badge
 * (components/AchievementBadge.js), desbloqueada ou não. Mostra a imagem
 * circular (ou o ícone, quando o Admin ainda não subiu imagem), o nome e o
 * texto configurados no painel Admin.
 */
export default function ConquistaDetalheModal({ conquista, onFechar }) {
  const Icone = Icons[iconePascalCase(conquista.icone)] || Icons.Award;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-coffee-900/40 sm:items-center"
      onClick={onFechar}
    >
      <div
        className="relative w-full max-w-xs rounded-t-2xl bg-cream p-6 text-center sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onFechar}
          className="absolute right-4 top-4 rounded-full p-1 text-coffee-400"
        >
          <X size={18} />
        </button>

        <div
          className={`relative mx-auto flex h-20 w-20 items-center justify-center rounded-full ${
            conquista.desbloqueada
              ? 'bg-gradient-to-br from-gold to-coffee-600 shadow-card'
              : 'border border-coffee-100 bg-coffee-50'
          }`}
        >
          {conquista.imagemURL ? (
            <img
              src={conquista.imagemURL}
              alt=""
              className={`h-full w-full rounded-full object-cover ${
                conquista.desbloqueada ? '' : 'opacity-40 grayscale'
              }`}
            />
          ) : (
            <Icone
              size={30}
              strokeWidth={1.8}
              className={conquista.desbloqueada ? 'text-cream' : 'text-coffee-200'}
            />
          )}
          {!conquista.desbloqueada && (
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-coffee-50/60">
              <Lock size={22} strokeWidth={2.2} className="text-coffee-300" />
            </div>
          )}
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
