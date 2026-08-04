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
 *  - Com `conquista.emblema`: a foto/ícone preenche o círculo INTEIRO
 *    (z-0), e a moldura do tier (anel + louros) entra por CIMA (z-10) maior
 *    que o próprio círculo e deslocada (ver `moldura` em lib/emblemas.js),
 *    pra aparecer como um elemento externo ao redor da foto — nunca dentro
 *    dela nem cobrindo o centro. `moldura.escala/deslocX/deslocY` é
 *    calculado por tier a partir do vão real de cada PNG.
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
  const { escala, deslocX, deslocY } = tier.moldura;
  // Estilo comum da moldura (imagem do anel) e do brilho mascarado nela —
  // os dois precisam ficar exatamente sobrepostos, maiores que o círculo e
  // deslocados pra fora, então compartilham o mesmo tamanho/posição.
  // maxWidth/maxHeight: 'none' é necessário só na <img> (não no <div> do
  // brilho) pra anular o reset global do Tailwind (`img { max-width: 100%;
  // height: auto }`), que senão prende a largura da moldura a 100% do
  // círculo e distorce/desalinha o anel.
  const estiloMoldura = { left: deslocX, top: deslocY, width: escala, height: escala };

  return (
    <div style={{ width: size, height: size }} className={`relative isolate ${className}`}>
      {/* foto/ícone da conquista — preenche o círculo inteiro (z-0). A
          moldura do tier entra por cima, maior e por fora (ver acima). */}
      <div className="absolute inset-0 z-0 overflow-hidden rounded-full bg-cream-card">
        {conquista.imagemURL ? (
          <img
            src={conquista.imagemURL}
            alt=""
            className={`h-full w-full object-cover ${
              travada ? 'opacity-50 grayscale' : ''
            } ${animRevelada}`}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Icone
              size={Math.round(size * 0.4)}
              strokeWidth={1.8}
              className={`${travada ? 'text-coffee-200 opacity-70' : 'text-coffee-500'} ${animRevelada}`}
            />
          </div>
        )}
      </div>

      {/* moldura do tier — maior que o círculo e deslocada, aparece como
          elemento externo (anel + louros ultrapassando a borda da foto) */}
      <img
        src={src}
        alt=""
        draggable={false}
        className={`pointer-events-none absolute z-10 max-w-none select-none ${
          travada ? 'opacity-40 grayscale' : ''
        }`}
        style={{ ...estiloMoldura, maxWidth: 'none', maxHeight: 'none' }}
      />

      {/* brilho animado — só quando desbloqueada e sem animação de abertura
          em andamento, mascarado no formato da moldura, na mesma posição/
          tamanho dela */}
      {!travada && !abrindo && (
        <div
          className="emblema-brilho pointer-events-none absolute z-10"
          style={{
            ...estiloMoldura,
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
