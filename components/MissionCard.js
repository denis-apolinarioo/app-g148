'use client';

import * as Icons from 'lucide-react';
import { Check, CornerUpRight } from 'lucide-react';
import BowArrowIcon from '@/components/BowArrowIcon';
import { iconePascalCase } from '@/lib/missionIcons';

export default function MissionCard({ missao, concluida, onClick, bloqueada, progresso, onEncaminhar }) {
  // Ícone padrão trocado de estrela genérica para arco-e-flecha (temática de
  // "missão"/"alvo"), usado sempre que a missão não tem um ícone específico
  // mapeado na biblioteca lucide-react.
  const IconeLucide = Icons[iconePascalCase(missao.icone)];

  // `progresso` = { usadas, limite } — só mostra "2/5" quando a missão pode
  // ser cumprida mais de uma vez por período; com limite 1 fica redundante
  // com o próprio estado "concluída".
  const mostrarProgresso = progresso && progresso.limite > 1;

  // Botão de "encaminhar" (canto superior direito) — só aparece quando a
  // pessoa já cumpriu esta missão pelo menos uma vez no período atual, pra
  // levar direto pro(s) post(s) já feitos. `onEncaminhar` decide sozinho se
  // é 1 (vai direto) ou mais de 1 (abre a listinha) — este card só precisa
  // saber SE deve mostrar o botão.
  const mostrarEncaminhar = !!onEncaminhar && (progresso?.usadas || 0) > 0;

  // O card inteiro precisou deixar de ser um <button> (não dá pra colocar
  // um <button> dentro de outro <button> — HTML não permite) pra caber o
  // botão de encaminhar no canto sem interferir no toque de abrir a missão.
  return (
    <div
      role="button"
      tabIndex={concluida || bloqueada ? -1 : 0}
      onClick={() => !concluida && !bloqueada && onClick(missao)}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !concluida && !bloqueada) onClick(missao);
      }}
      aria-disabled={concluida || bloqueada}
      className={`relative flex w-full items-center gap-3.5 rounded-xl2 border px-4 py-3.5 text-left transition-colors ${
        concluida
          ? 'border-coffee-100 bg-coffee-50/60'
          : 'border-coffee-100 bg-cream-card shadow-card active:bg-coffee-50'
      } ${concluida || bloqueada ? '' : 'cursor-pointer'}`}
    >
      {mostrarEncaminhar && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEncaminhar(missao);
          }}
          aria-label="Ver envio anterior desta missão"
          className="absolute right-2.5 top-2.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-coffee-300 active:bg-coffee-100 active:text-coffee-600"
        >
          <CornerUpRight size={15} />
        </button>
      )}

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
          className={`block text-xs font-semibold uppercase tracking-wider ${
            concluida ? 'text-coffee-400 line-through' : 'text-coffee-600'
          } ${mostrarEncaminhar ? 'pr-7' : ''}`}
        >
          {missao.titulo}
        </span>
        <span className="block text-xs text-coffee-400">
          +{missao.pontos} pontos
          {mostrarProgresso && ` · ${progresso.usadas}/${progresso.limite} no período`}
        </span>
      </span>
    </div>
  );
}
