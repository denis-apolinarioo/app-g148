'use client';

import { useRef, useState } from 'react';
import { Flame } from 'lucide-react';
import { vibrarToqueLeve } from '@/lib/haptics';

let proximoIdFaisca = 0;

// Duração do "segurar" antes de entrar em modo pré-visualização (ms) e o
// intervalo entre cada nível subindo automaticamente durante o long press.
const ATRASO_LONG_PRESS = 350;
const INTERVALO_PREVIEW = 550;
const NIVEL_MAX = 7;

// Camadas de chama por NÍVEL (2 a 7 — nível 1 é só lenha, sem fogo), na
// mesma progressão de 7 estágios da referência que o usuário mandou
// (lenha crua → chama pequena → fogo cheio). Cada camada usa o ícone Flame
// do lucide, com a animação chamaFlutuar já existente (balanço + escala,
// ver tailwind.config.js) — é essa animação que dá o "foguinho mexendo"
// pedido, sem precisar de nada novo.
const CHAMAS_POR_NIVEL = {
  2: [{ tamanho: 13, cor: 'text-orange-500', bottom: 7, left: 0, atraso: '0s' }],
  3: [
    { tamanho: 16, cor: 'text-orange-500', bottom: 6, left: -3, atraso: '0s' },
    { tamanho: 10, cor: 'text-yellow-400', bottom: 9, left: 4, atraso: '0.35s' },
  ],
  4: [
    { tamanho: 18, cor: 'text-orange-500', bottom: 5, left: -4, atraso: '0s' },
    { tamanho: 14, cor: 'text-yellow-400', bottom: 8, left: 5, atraso: '0.3s' },
  ],
  5: [
    { tamanho: 21, cor: 'text-orange-500', bottom: 3, left: -5, atraso: '0s' },
    { tamanho: 17, cor: 'text-red-500', bottom: 7, left: 6, atraso: '0.3s' },
    { tamanho: 13, cor: 'text-yellow-400', bottom: 9, left: 0, atraso: '0.5s' },
  ],
  6: [
    { tamanho: 24, cor: 'text-orange-500', bottom: 2, left: 4, atraso: '0s' },
    { tamanho: 19, cor: 'text-red-500', bottom: 5, left: -9, atraso: '0.35s' },
    { tamanho: 19, cor: 'text-orange-400', bottom: 6, left: 7, atraso: '0.15s' },
    { tamanho: 15, cor: 'text-yellow-400', bottom: 10, left: -2, atraso: '0.55s' },
  ],
  7: [
    { tamanho: 28, cor: 'text-orange-500', bottom: 0, left: 5, atraso: '0s' },
    { tamanho: 23, cor: 'text-red-500', bottom: 3, left: -11, atraso: '0.3s' },
    { tamanho: 23, cor: 'text-orange-400', bottom: 4, left: 9, atraso: '0.12s' },
    { tamanho: 17, cor: 'text-yellow-400', bottom: 9, left: -2, atraso: '0.5s' },
    { tamanho: 12, cor: 'text-yellow-300', bottom: 13, left: 3, atraso: '0.7s' },
  ],
};

// Dias de streak → nível real (1 a 7), seguindo os cortes que o usuário deu:
// 1 = sem fogo (0 dias, usuário não abriu o app ainda), 2 = 1 dia, 3 = do
// dia 3 em diante, 4 = 7 dias, 5 = 14 dias, 6 = 21 dias, 7 = 28 dias. (O dia
// 2 sozinho não foi mencionado — ficou dentro do nível 2, junto do dia 1,
// já que o próximo corte só começa no dia 3.)
function nivelParaDias(dias) {
  if (dias >= 28) return 7;
  if (dias >= 21) return 6;
  if (dias >= 14) return 5;
  if (dias >= 7) return 4;
  if (dias >= 3) return 3;
  if (dias >= 1) return 2;
  return 1;
}

/**
 * Fogueira animada do streak de constância — a lenha cruzada fica sempre
 * visível e o fogo cresce em 7 níveis reais (nível 1 = só lenha crua, sem
 * fogo; níveis 2 a 7 vão de uma chamazinha até o fogo cheio, seguindo a
 * imagem de referência do usuário).
 *
 * Toque rápido: solta faíscas subindo (quantidade cresce junto com o nível
 * atual), só efeito visual, não mexe em nada no Firestore.
 *
 * Segurar (long press): depois de ~350ms, entra em modo pré-visualização e
 * vai passando pelos níveis 2 a 7 automaticamente e aos poucos, pra dar
 * pra ver como cada estágio fica e como o fogo vai crescendo — solta o
 * dedo/botão e ela volta pro nível real da pessoa.
 */
export default function StreakFogueira({ dias = 0 }) {
  const [faiscas, setFaiscas] = useState([]);
  const [nivelPreview, setNivelPreview] = useState(null);
  const holdTimeoutRef = useRef(null);
  const previewIntervalRef = useRef(null);
  const houvePreviewRef = useRef(false);

  const nivelReal = nivelParaDias(dias);
  const nivelExibido = nivelPreview ?? nivelReal;
  const chamas = CHAMAS_POR_NIVEL[nivelExibido] || [];

  function iniciarPreview() {
    let atual = Math.max(2, nivelReal + 1);
    if (atual > NIVEL_MAX) return; // já está no máximo, nada pra pré-visualizar
    houvePreviewRef.current = true;
    setNivelPreview(atual);
    previewIntervalRef.current = setInterval(() => {
      atual = Math.min(NIVEL_MAX, atual + 1);
      setNivelPreview(atual);
      if (atual >= NIVEL_MAX) clearInterval(previewIntervalRef.current);
    }, INTERVALO_PREVIEW);
  }

  function handlePointerDown() {
    holdTimeoutRef.current = setTimeout(iniciarPreview, ATRASO_LONG_PRESS);
  }

  function pararPreview() {
    clearTimeout(holdTimeoutRef.current);
    clearInterval(previewIntervalRef.current);
    setNivelPreview(null);
  }

  function handleClick() {
    // Se acabou de segurar (pré-visualização), esse toque só serve pra
    // "soltar" o preview — não deve também disparar faísca.
    if (houvePreviewRef.current) {
      houvePreviewRef.current = false;
      return;
    }
    vibrarToqueLeve();
    // Nível 1 é só lenha (sem fogo) — não solta faísca nenhuma.
    const qtd = Math.max(0, nivelReal - 1);
    for (let i = 0; i < qtd; i++) {
      const id = proximoIdFaisca++;
      const desvio = qtd > 1 ? (i - (qtd - 1) / 2) * 6 : 0;
      setFaiscas((atual) => [...atual, { id, desvio, atraso: i * 90 }]);
      setTimeout(() => {
        setFaiscas((atual) => atual.filter((f) => f.id !== id));
      }, 700 + i * 90);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerUp={pararPreview}
      onPointerLeave={pararPreview}
      onPointerCancel={pararPreview}
      // translate-y-1: desce a fogueira um pouco (pedido do usuário),
      // mantendo o alinhamento items-end com o card de Pontos de Comunhão
      // ao lado — o translate não mexe no fluxo do layout, só empurra o
      // visual pra baixo.
      className="flex translate-y-1 flex-col items-center gap-1 px-1 pb-2.5"
      aria-label={`Streak de ${dias} ${dias === 1 ? 'dia' : 'dias'}`}
    >
      <div className="relative h-14 w-14">
        {/* Lenha cruzada — sempre visível, mesmo em 0 dias */}
        <div className="absolute bottom-1 left-1/2 h-1.5 w-10 -translate-x-1/2 -rotate-12 rounded-full bg-coffee-500" />
        <div className="absolute bottom-1 left-1/2 h-1.5 w-10 -translate-x-1/2 rotate-12 rounded-full bg-coffee-600" />

        {chamas.map((c, i) => (
          <div
            key={i}
            className="absolute"
            style={{ bottom: c.bottom, left: `calc(50% + ${c.left}px)`, transform: 'translateX(-50%)' }}
          >
            <Flame
              size={c.tamanho}
              fill="currentColor"
              className={`animate-chamaFlutuar ${c.cor}`}
              style={{ animationDelay: c.atraso }}
            />
          </div>
        ))}

        {faiscas.map((f) => (
          <div
            key={f.id}
            className="absolute bottom-3 left-1/2 -translate-x-1/2"
            style={{ marginLeft: f.desvio, animationDelay: `${f.atraso}ms` }}
          >
            <Flame size={11} fill="currentColor" className="text-orange-400 animate-faiscaSobe" />
          </div>
        ))}
      </div>
      <span className="font-destaque text-xs font-semibold text-coffee-700">
        {dias} {dias === 1 ? 'dia' : 'dias'}
      </span>
    </button>
  );
}
