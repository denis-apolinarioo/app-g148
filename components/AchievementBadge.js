'use client';

import { useState } from 'react';
import * as Icons from 'lucide-react';
import { Lock } from 'lucide-react';
import { vibrarConquista } from '@/lib/haptics';
import { iconePascalCase } from '@/lib/missionIcons';
import ConquistaDetalheModal from '@/components/ConquistaDetalheModal';

/**
 * Badge de conquista com três estados visuais:
 *  - Bloqueada: cores bem claras, quase sem contraste, com cadeado por cima.
 *  - Desbloqueada mas ainda não aberta (visto=false): já fica com mais
 *    contraste/mais escura pra sinalizar "essa é sua", mas o cadeado
 *    continua ali esperando o toque.
 *  - Aberta (visto=true): contraste total, sem cadeado.
 *
 * Sempre circular. Usa `conquista.imagemURL` (escolhida pelo Admin) quando
 * existir; cai pro ícone lucide (`conquista.icone`) como reserva pras
 * conquistas que ainda não ganharam imagem.
 *
 * O toque numa conquista pendente (desbloqueada e ainda não vista) dispara
 * a animação do cadeado abrindo + vibração longa, marca como vista, e só
 * então abre o modal de detalhe. O toque em qualquer outra (já vista ou
 * ainda bloqueada) abre o modal de detalhe direto, sem animação.
 */
export default function AchievementBadge({ conquista, onAberta }) {
  const [abrindo, setAbrindo] = useState(false);
  const [detalheAberto, setDetalheAberto] = useState(false);
  const Icone = Icons[iconePascalCase(conquista.icone)] || Icons.Award;

  const desbloqueada = !!conquista.desbloqueada;
  const podeAbrir = desbloqueada && !conquista.visto;
  const mostrarCadeado = !desbloqueada || podeAbrir || abrindo;

  function handleClick() {
    if (abrindo) return;
    if (!podeAbrir) {
      setDetalheAberto(true);
      return;
    }
    setAbrindo(true);
    vibrarConquista();
    setTimeout(() => {
      onAberta?.(conquista.id);
      setAbrindo(false);
      setDetalheAberto(true);
    }, 600);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={abrindo}
        className="flex flex-col items-center gap-1.5 text-center active:scale-95 transition-transform"
      >
        <div
          className={`relative flex h-16 w-16 items-center justify-center rounded-full transition-colors duration-500 ${
            desbloqueada
              ? 'bg-gradient-to-br from-gold to-coffee-600 shadow-card'
              : 'border border-coffee-100 bg-coffee-50'
          }`}
        >
          {conquista.imagemURL ? (
            <img
              src={conquista.imagemURL}
              alt=""
              className={`h-full w-full rounded-full object-cover ${
                desbloqueada ? '' : 'opacity-50 grayscale'
              } ${abrindo ? 'animate-conquistaRevelada' : ''}`}
            />
          ) : (
            <Icone
              size={26}
              strokeWidth={1.8}
              className={
                desbloqueada
                  ? `text-cream ${abrindo ? 'animate-conquistaRevelada' : ''}`
                  : 'text-coffee-200 opacity-70'
              }
            />
          )}

          {mostrarCadeado && (
            <div
              className={`absolute inset-0 flex items-center justify-center rounded-full ${
                desbloqueada ? 'bg-coffee-900/30' : 'bg-coffee-50/60'
              } ${abrindo ? 'animate-cadeadoAbrindo' : ''}`}
            >
              <Lock size={19} strokeWidth={2.2} className={desbloqueada ? 'text-cream' : 'text-coffee-300'} />
            </div>
          )}

          {podeAbrir && !abrindo && (
            <span className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full bg-gold ring-2 ring-cream animate-pulse" />
          )}
        </div>
        <p
          className={`font-destaque text-[11px] font-semibold leading-tight ${
            desbloqueada ? 'text-coffee-600' : 'text-coffee-300'
          }`}
        >
          {conquista.nome}
        </p>
      </button>

      {detalheAberto && (
        <ConquistaDetalheModal conquista={conquista} onFechar={() => setDetalheAberto(false)} />
      )}
    </>
  );
}
