'use client';

import * as Icons from 'lucide-react';
import { Lock } from 'lucide-react';
import { iconePascalCase } from '@/lib/missionIcons';
import { EMBLEMAS_POR_ID, caminhoEmblema } from '@/lib/emblemas';

/**
 * Selo visual de uma conquista — usado no grid (AchievementBadge), na
 * vitrine do perfil (VitrineConquistas) e no modal de detalhe
 * (ConquistaDetalheModal). Sempre a mesma regra:
 *
 *  - Sem `conquista.emblema`: círculo simples com gradiente (visual
 *    original, mantido pra quem ainda não escolheu um tier no Admin).
 *  - Com `conquista.emblema`: a coroa/anel do tier escolhido entra como
 *    moldura por cima da foto (ou ícone) da conquista, com uma animação de
 *    brilho quando desbloqueada — mais forte quanto melhor o tier (ver
 *    lib/emblemas.js).
 *
 * `size` é em px (a moldura é sempre quadrada). `bloqueada` decide o
 * tratamento de cinza + cadeado; por padrão usa `!conquista.desbloqueada`.
 */
export default function EmblemaConquista({
  conquista,
  size = 64,
  bloqueada,
  mostrarCadeado = true,
  className = '',
}) {
  const Icone = Icons[iconePascalCase(conquista.icone)] || Icons.Award;
  const travada = bloqueada ?? !conquista.desbloqueada;
  const tier = conquista.emblema ? EMBLEMAS_POR_ID[conquista.emblema] : null;

  if (!tier) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`relative flex items-center justify-center rounded-full ${
          travada
            ? 'border border-coffee-100 bg-coffee-50'
            : 'bg-gradient-to-br from-gold to-coffee-600 shadow-card'
        } ${className}`}
      >
        {conquista.imagemURL ? (
          <img
            src={conquista.imagemURL}
            alt=""
            className={`h-full w-full rounded-full object-cover ${travada ? 'opacity-50 grayscale' : ''}`}
          />
        ) : (
          <Icone
            size={Math.round(size * 0.42)}
            strokeWidth={1.8}
            className={travada ? 'text-coffee-200 opacity-70' : 'text-cream'}
          />
        )}
        {travada && mostrarCadeado && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-coffee-50/60">
            <Lock size={Math.round(size * 0.3)} strokeWidth={2.2} className="text-coffee-300" />
          </div>
        )}
      </div>
    );
  }

  const src = caminhoEmblema(tier.id);

  return (
    <div style={{ width: size, height: size }} className={`relative ${className}`}>
      {/* foto/ícone da conquista, encaixado no vão do emblema */}
      <div
        className="absolute overflow-hidden rounded-full bg-cream-card"
        style={{ left: '21.5%', right: '21.5%', top: '16%', bottom: '27%' }}
      >
        <div className="flex h-full w-full items-center justify-center">
          {conquista.imagemURL ? (
            <img
              src={conquista.imagemURL}
              alt=""
              className={`h-full w-full object-cover ${travada ? 'opacity-50 grayscale' : ''}`}
            />
          ) : (
            <Icone
              size={Math.round(size * 0.24)}
              strokeWidth={1.8}
              className={travada ? 'text-coffee-200 opacity-70' : 'text-coffee-500'}
            />
          )}
        </div>
      </div>

      {/* moldura do tier */}
      <img
        src={src}
        alt=""
        draggable={false}
        className={`pointer-events-none absolute inset-0 h-full w-full select-none ${
          travada ? 'opacity-40 grayscale' : ''
        }`}
      />

      {/* brilho animado — só quando desbloqueada, mascarado no formato do emblema */}
      {!travada && (
        <div
          className="emblema-brilho pointer-events-none absolute inset-0"
          style={{
            '--brilho-mascara': `url(${src})`,
            '--brilho-cor': tier.corBrilho,
            '--brilho-duracao': `${tier.duracaoSeg}s`,
            '--brilho-intensidade': tier.intensidade,
          }}
        />
      )}

      {travada && mostrarCadeado && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Lock size={Math.round(size * 0.3)} strokeWidth={2.2} className="text-coffee-300 drop-shadow" />
        </div>
      )}
    </div>
  );
}
