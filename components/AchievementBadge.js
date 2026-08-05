'use client';

import { useState } from 'react';
import { vibrarConquista } from '@/lib/haptics';
import EmblemaConquista from '@/components/EmblemaConquista';
import ConquistaDetalheModal from '@/components/ConquistaDetalheModal';

// Tamanho do selo no grid de conquistas do perfil (ver ProfileView, seção
// logo abaixo dos pontos de comunhão / streak). Combina com o grid-cols-5
// usado lá — não aumentar sem revisar o grid junto (a moldura do tier vaza
// ~12% do tamanho pra fora de cada lado, então o gap do grid tem que cobrir
// isso pra não sobrepor a vizinha).
const TAMANHO_BADGE = 56;

/**
 * Badge de conquista clicável usado no grid do perfil. O visual em si (selo
 * circular ou moldura de tier com foto/ícone) é todo delegado ao
 * EmblemaConquista, que é a fonte única desse desenho — aqui só cuida da
 * interação:
 *
 *  - Bloqueada: cadeado sempre visível.
 *  - Desbloqueada mas ainda não aberta (`pendente`): cadeado + bolinha
 *    pulsando, esperando o toque.
 *  - Aberta: sem cadeado.
 *
 * O toque numa conquista pendente dispara a animação do cadeado abrindo +
 * vibração longa, marca como vista, e só então abre o modal de detalhe. O
 * toque em qualquer outra (já vista ou ainda bloqueada) abre o modal direto.
 */
export default function AchievementBadge({ conquista, onAberta }) {
  const [abrindo, setAbrindo] = useState(false);
  const [detalheAberto, setDetalheAberto] = useState(false);

  const desbloqueada = !!conquista.desbloqueada;
  const podeAbrir = desbloqueada && !conquista.visto;

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
        <EmblemaConquista
          conquista={conquista}
          size={TAMANHO_BADGE}
          bloqueada={!desbloqueada}
          pendente={podeAbrir}
          abrindo={abrindo}
        />
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
