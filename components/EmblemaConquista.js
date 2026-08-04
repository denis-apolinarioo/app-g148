'use client';

import * as Icons from 'lucide-react';
import { Lock } from 'lucide-react';
import { iconePascalCase } from '@/lib/missionIcons';
import { EMBLEMAS_POR_ID, caminhoEmblema } from '@/lib/emblemas';

/**
 * Selo visual de uma conquista — fonte única usada no grid do perfil
 * (AchievementBadge), na vitrine (VitrineConquistas), no modal de detalhe
 * (ConquistaDetalheModal) e no Admin (AbaConquistas). Sempre a mesma regra:
 *
 *  - Sem `conquista.emblema`: círculo simples com gradiente (visual
 *    original, mantido pra quem ainda não escolheu um tier no Admin).
 *  - Com `conquista.emblema`: a foto/ícone fica numa camada de trás (z-0),
 *    do tamanho exato do vão circular do desenho do anel, e a moldura do
 *    tier entra por CIMA (z-10) — nunca o contrário. Isso é o que garante
 *    que o anel sempre apareça como moldura visível por cima da foto, e não
 *    "escondido" dentro do espaço dela.
 *
 * `size` é em px (a moldura é sempre quadrada). `bloqueada` decide o
 * tratamento de cinza + cadeado; por padrão usa `!conquista.desbloqueada`.
 * `pendente` (desbloqueada mas ainda não vista) e `abrindo` (animação do
 * toque em andamento) são usados pelo AchievementBadge no grid do perfil.
 */
export default function EmblemaConquista({
  conquista,
  size = 64,
  bloqueada,
  mostrarCadeado = true,
  pendente = false,
  abrindo = false,
  className = '',
}) {
  const Icone = Icons[iconePascalCase(conquista.icone)] || Icons.Award;
  const travada = bloqueada ?? !conquista.desbloqueada;
  const tier = conquista.emblema ? EMBLEMAS_POR_ID[conquista.emblema] : null;
  const precisaCadeado = mostrarCadeado && (travada || pendente || abrindo);
  const animRevelada = abrindo ? 'animate-conquistaRevelada' : '';

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
            className={`h-full w-full rounded-full object-cover ${
              travada ? 'opacity-50 grayscale' : ''
            } ${animRevelada}`}
          />
        ) : (
          <Icone
            size={Math.round(size * 0.42)}
            strokeWidth={1.8}
            className={`${travada ? 'text-coffee-200 opacity-70' : 'text-cream'} ${animRevelada}`}
          />
        )}
        {precisaCadeado && (
          <div
            className={`absolute inset-0 flex items-center justify-center rounded-full ${
              travada ? 'bg-coffee-50/60' : 'bg-coffee-900/30'
            } ${abrindo ? 'animate-cadeadoAbrindo' : ''}`}
          >
            <Lock
              size={Math.round(size * 0.3)}
              strokeWidth={2.2}
              className={travada ? 'text-coffee-300' : 'text-cream'}
            />
          </div>
        )}
        {pendente && !abrindo && (
          <span className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full bg-gold ring-2 ring-cream animate-pulse" />
        )}
      </div>
    );
  }

  const src = caminhoEmblema(tier.id);

  return (
    <div style={{ width: size, height: size }} className={`relative ${className}`}>
      {/* foto/ícone da conquista — camada de trás (z-0), encaixada exatamente
          no vão circular do anel (percentuais medidos a partir do desenho
          real em public/emblemas/*.png). A moldura entra por cima dela, não
          o contrário. */}
      <div
        className="absolute z-0 overflow-hidden rounded-full bg-cream-card"
        style={{ left: '20%', right: '20%', top: '14%', bottom: '26%' }}
      >
        <div className="flex h-full w-full items-center justify-center">
          {conquista.imagemURL ? (
            <img
              src={conquista.imagemURL}
              alt=""
              className={`h-full w-full object-cover ${
                travada ? 'opacity-50 grayscale' : ''
              } ${animRevelada}`}
            />
          ) : (
            <Icone
              size={Math.round(size * 0.25)}
              strokeWidth={1.8}
              className={`${travada ? 'text-coffee-200 opacity-70' : 'text-coffee-500'} ${animRevelada}`}
            />
          )}
        </div>
      </div>

      {/* moldura do tier — sempre por cima da foto (z-10) */}
      <img
        src={src}
        alt=""
        draggable={false}
        className={`pointer-events-none absolute inset-0 z-10 h-full w-full select-none ${
          travada ? 'opacity-40 grayscale' : ''
        }`}
      />

      {/* brilho animado — só quando desbloqueada e sem animação de abertura
          em andamento, mascarado no formato do emblema, também por cima */}
      {!travada && !abrindo && (
        <div
          className="emblema-brilho pointer-events-none absolute inset-0 z-10"
          style={{
            '--brilho-mascara': `url(${src})`,
            '--brilho-cor': tier.corBrilho,
            '--brilho-duracao': `${tier.duracaoSeg}s`,
            '--brilho-intensidade': tier.intensidade,
          }}
        />
      )}

      {precisaCadeado && (
        <div
          className={`absolute inset-0 z-20 flex items-center justify-center ${
            abrindo ? 'animate-cadeadoAbrindo' : ''
          }`}
        >
          <Lock size={Math.round(size * 0.3)} strokeWidth={2.2} className="text-coffee-300 drop-shadow" />
        </div>
      )}

      {pendente && !abrindo && (
        <span className="absolute -right-1 -top-1 z-20 h-3.5 w-3.5 rounded-full bg-gold ring-2 ring-cream animate-pulse" />
      )}
    </div>
  );
}
