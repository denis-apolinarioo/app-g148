'use client';

import * as Icons from 'lucide-react';
import { Check, CornerUpRight, Loader2 } from 'lucide-react';
import BowArrowIcon from '@/components/BowArrowIcon';
import { iconePascalCase } from '@/lib/missionIcons';

export default function MissionCard({ missao, concluida, onClick, bloqueada, progresso, onEncaminhar, enviando }) {
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
  // saber SE deve mostrar o botão. Enquanto o envio otimista ainda está em
  // voo (ver missoes/page.js), não tem post de verdade pra encaminhar
  // ainda — o botão fica escondido até confirmar.
  const mostrarEncaminhar = !enviando && !!onEncaminhar && (progresso?.usadas || 0) > 0;

  // Pontos de Comunhão e/ou Dracma que a missão concede — `pontua` ausente
  // conta como true (missão criada antes desta opção existir, sempre
  // pontuou); `daDracma` só entra quando realmente marcado.
  const recompensas = [];
  if (missao.pontua !== false) recompensas.push(`+${missao.pontos} pontos`);
  if (missao.daDracma) recompensas.push(`+${missao.dracma || 0} Dracma`);

  // PUBLICAÇÃO OTIMISTA — enquanto o envio desta missão está rodando em
  // segundo plano (ver handleEnviarOtimista em missoes/page.js), o card já
  // se comporta como concluído (não dá pra clicar de novo), mas com um
  // spinner no lugar do check e "Enviando..." no lugar da recompensa, pra
  // diferenciar visualmente de uma missão que já foi confirmada de verdade.
  const bloqueadaVisual = concluida || bloqueada || enviando;

  // O card inteiro precisou deixar de ser um <button> (não dá pra colocar
  // um <button> dentro de outro <button> — HTML não permite) pra caber o
  // botão de encaminhar no canto sem interferir no toque de abrir a missão.
  return (
    <div
      role="button"
      tabIndex={bloqueadaVisual ? -1 : 0}
      onClick={() => !bloqueadaVisual && onClick(missao)}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !bloqueadaVisual) onClick(missao);
      }}
      aria-disabled={bloqueadaVisual}
      className={`relative flex w-full items-center gap-3.5 rounded-xl2 px-4 py-3.5 text-left transition-colors ${
        concluida || enviando
          ? 'bg-coffee-50/60 shadow-flutuante'
          : 'bg-cream-card shadow-flutuante active:bg-coffee-50'
      } ${bloqueadaVisual ? '' : 'cursor-pointer'}`}
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
          concluida || enviando ? 'bg-green-100' : 'bg-coffee-100'
        }`}
      >
        {enviando ? (
          <Loader2 size={18} className="animate-spin text-green-700" />
        ) : concluida ? (
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
            concluida || enviando ? 'text-coffee-400 line-through' : 'text-coffee-600'
          } ${mostrarEncaminhar ? 'pr-7' : ''}`}
        >
          {missao.titulo}
        </span>
        <span className="block text-xs text-coffee-400">
          {enviando
            ? 'Enviando...'
            : recompensas.length > 0
              ? recompensas.join(' · ')
              : 'Sem recompensa'}
          {!enviando && mostrarProgresso && ` · ${progresso.usadas}/${progresso.limite} no período`}
        </span>
      </span>
    </div>
  );
}
