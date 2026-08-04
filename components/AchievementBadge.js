'use client';

import { useState } from 'react';
import * as Icons from 'lucide-react';
import { Lock } from 'lucide-react';
import { vibrarConquista } from '@/lib/haptics';
import { iconePascalCase } from '@/lib/missionIcons';
import { EMBLEMAS_POR_ID, caminhoEmblema } from '@/lib/emblemas';
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
 * Quando a conquista tem um `emblema` (tier ferro/bronze/prata/ouro/
 * diamante — ver lib/emblemas.js), a coroa do tier entra como moldura por
 * cima da foto/ícone, com brilho animado enquanto desbloqueada. Sem
 * `emblema` escolhido no Admin, cai no círculo simples de sempre.
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
  const tier = conquista.emblema ? EMBLEMAS_POR_ID[conquista.emblema] : null;

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

  const conteudo = conquista.imagemURL ? (
    <img
      src={conquista.imagemURL}
      alt=""
      className={`h-full w-full object-cover ${desbloqueada ? '' : 'opacity-50 grayscale'} ${
        abrindo ? 'animate-conquistaRevelada' : ''
      } ${tier ? '' : 'rounded-full'}`}
    />
  ) : (
    <Icone
      size={tier ? 16 : 26}
      strokeWidth={1.8}
      className={
        desbloqueada
          ? `${tier ? 'text-coffee-500' : 'text-cream'} ${abrindo ? 'animate-conquistaRevelada' : ''}`
          : 'text-coffee-200 opacity-70'
      }
    />
  );

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={abrindo}
        className="flex flex-col items-center gap-1.5 text-center active:scale-95 transition-transform"
      >
        <div
          className={`relative flex h-16 w-16 items-center justify-center transition-colors duration-500 ${
            tier
              ? ''
              : `rounded-full ${desbloqueada ? 'bg-gradient-to-br from-gold to-coffee-600 shadow-card' : 'border border-coffee-100 bg-coffee-50'}`
          }`}
        >
          {tier ? (
            <>
              <div
                className="absolute flex items-center justify-center overflow-hidden rounded-full bg-cream-card"
                style={{ left: '21.5%', right: '21.5%', top: '16%', bottom: '27%' }}
              >
                {conteudo}
              </div>

              <img
                src={caminhoEmblema(tier.id)}
                alt=""
                draggable={false}
                className={`pointer-events-none absolute inset-0 h-full w-full select-none ${
                  desbloqueada ? '' : 'opacity-40 grayscale'
                }`}
              />

              {desbloqueada && !abrindo && (
                <div
                  className="emblema-brilho pointer-events-none absolute inset-0"
                  style={{
                    '--brilho-mascara': `url(${caminhoEmblema(tier.id)})`,
                    '--brilho-cor': tier.corBrilho,
                    '--brilho-duracao': `${tier.duracaoSeg}s`,
                    '--brilho-intensidade': tier.intensidade,
                  }}
                />
              )}
            </>
          ) : (
            conteudo
          )}

          {mostrarCadeado && (
            <div
              className={`absolute inset-0 flex items-center justify-center ${tier ? '' : 'rounded-full'} ${
                tier ? '' : desbloqueada ? 'bg-coffee-900/30' : 'bg-coffee-50/60'
              } ${abrindo ? 'animate-cadeadoAbrindo' : ''}`}
            >
              <Lock
                size={19}
                strokeWidth={2.2}
                className={
                  tier
                    ? 'text-coffee-300 drop-shadow'
                    : desbloqueada
                      ? 'text-cream'
                      : 'text-coffee-300'
                }
              />
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
