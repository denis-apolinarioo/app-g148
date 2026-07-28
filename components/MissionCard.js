'use client';

import * as Icons from 'lucide-react';
import { Check } from 'lucide-react';
import BowArrowIcon from '@/components/BowArrowIcon';

export default function MissionCard({ missao, concluida, onClick, bloqueada }) {
  // Ícone padrão trocado de estrela genérica para arco-e-flecha (temática de
  // "missão"/"alvo"), usado sempre que a missão não tem um ícone específico
  // mapeado na biblioteca lucide-react.
  const IconeLucide = Icons[iconePascalCase(missao.icone)];

  return (
    <button
      onClick={() => !concluida && !bloqueada && onClick(missao)}
      disabled={concluida || bloqueada}
      className={`flex w-full items-center gap-3.5 rounded-xl2 border px-4 py-3.5 text-left transition-colors ${
        concluida
          ? 'border-coffee-100 bg-coffee-50/60'
          : 'border-coffee-100 bg-cream-card shadow-card active:bg-coffee-50'
      }`}
    >
      <span
        className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full ${
          concluida ? 'bg-green-100' : 'bg-coffee-100'
        }`}
      >
        {concluida ? (
          <Check size={20} className="text-green-700" />
        ) : IconeLucide ? (
          <IconeLucide size={19} className="text-coffee-600" strokeWidth={1.8} />
        ) : (
          <BowArrowIcon size={19} className="text-coffee-600" strokeWidth={1.8} />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`block font-destaque text-sm font-semibold ${
            concluida ? 'text-coffee-400 line-through' : 'text-coffee-800'
          }`}
        >
          {missao.titulo}
        </span>
        <span className="block text-xs text-coffee-400">+{missao.pontos} pontos</span>
      </span>
    </button>
  );
}

function iconePascalCase(nomeKebab) {
  return nomeKebab
    .split('-')
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
    .join('');
}
