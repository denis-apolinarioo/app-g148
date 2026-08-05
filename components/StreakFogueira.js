'use client';

import { useRef, useState } from 'react';
import { Flame } from 'lucide-react';
import { vibrarToqueLeve } from '@/lib/haptics';

let proximoIdFaisca = 0;

// Duração do "segurar" antes de entrar em modo pré-visualização (ms) e o
// intervalo entre cada nível subindo automaticamente durante o long press.
const ATRASO_LONG_PRESS = 350;
const INTERVALO_PREVIEW = 650;

// Camadas de chama por NÍVEL (1 a 5, não mais por dias direto) — cada nível
// empilha mais "chamas" (tamanho/cor/posição variados) por cima da lenha,
// dando a sensação de fogo crescendo conforme a constância aumenta. Tamanhos
// ~15% menores que a versão anterior (pedido do usuário: "abaixar um
// pouquinho, não muito").
const CHAMAS_POR_NIVEL = {
  1: [{ tamanho: 15, cor: 'text-orange-500', bottom: 7, left: 0, atraso: '0s' }],
  2: [
    { tamanho: 17, cor: 'text-orange-500', bottom: 5, left: -4, atraso: '0s' },
    { tamanho: 13, cor: 'text-yellow-400', bottom: 8, left: 5, atraso: '0.35s' },
  ],
  3: [
    { tamanho: 20, cor: 'text-orange-500', bottom: 3, left: -5, atraso: '0s' },
    { tamanho: 16, cor: 'text-red-500', bottom: 7, left: 6, atraso: '0.3s' },
    { tamanho: 13, cor: 'text-yellow-400', bottom: 9, left: 0, atraso: '0.5s' },
  ],
  4: [
    { tamanho: 25, cor: 'text-orange-500', bottom: 1, left: 5, atraso: '0s' },
    { tamanho: 20, cor: 'text-red-500', bottom: 5, left: -10, atraso: '0.35s' },
    { tamanho: 20, cor: 'text-orange-400', bottom: 6, left: 8, atraso: '0.15s' },
    { tamanho: 15, cor: 'text-yellow-400', bottom: 10, left: -2, atraso: '0.55s' },
  ],
  5: [
    { tamanho: 29, cor: 'text-orange-500', bottom: -1, left: 5, atraso: '0s' },
    { tamanho: 24, cor: 'text-red-500', bottom: 3, left: -11, atraso: '0.3s' },
    { tamanho: 24, cor: 'text-orange-400', bottom: 4, left: 9, atraso: '0.12s' },
    { tamanho: 18, cor: 'text-yellow-400', bottom: 9, left: -2, atraso: '0.5s' },
    { tamanho: 13, cor: 'text-yellow-300', bottom: 13, left: 3, atraso: '0.7s' },
  ],
};

// Dias de streak → nível real (1 a 5, ou 0 = só lenha, sem fogo). Nível 5
// (o mais forte) é novo — antes o máximo era o antigo "31+".
function nivelParaDias(dias) {
  if (dias >= 61) return 5;
  if (dias >= 31) return 4;
  if (dias >= 15) return 3;
  if (dias >= 8) return 2;
  if (dias >= 1) return 1;
  return 0;
}

/**
 * Fogueira animada do streak de constância — a lenha cruzada fica sempre
 * visível e o fogo cresce em 5 níveis reais (1-7, 8-14, 15-30, 31-60, 61+
 * dias). Em 0 dias mostra só a lenha, sem fogo.
 *
 * Toque rápido: solta faíscas subindo (quantidade cresce junto com o nível
 * atual — do nível 1 ao 5 sai cada vez mais fogo saltando), só efeito
 * visual, não mexe em nada no Firestore.
 *
 * Segurar (long press): depois de ~350ms, entra em modo pré-visualização e
 * vai passando pelos níveis 2, 3, 4 e 5 automaticamente e aos poucos, pra
 * dar pra ver como cada estágio fica e como o fogo vai crescendo — solta o
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
    if (atual > 5) return; // já está no máximo, nada pra pré-visualizar
    houvePreviewRef.current = true;
    setNivelPreview(atual);
    previewIntervalRef.current = setInterval(() => {
      atual = Math.min(5, atual + 1);
      setNivelPreview(atual);
      if (atual >= 5) clearInterval(previewIntervalRef.current);
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
    const qtd = Math.max(1, nivelReal);
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
      // Padding inferior igual ao card de Pontos de Comunhão (py-2.5 = 10px)
      // — o topo fica sem padding (era pt-1) e o container um pouco mais
      // alto (h-14, era h-12) pra sobrar espaço da chama subir e começar
      // ligeiramente acima do topo da caixa de Pontos de Comunhão ao lado.
      className="flex flex-col items-center gap-1 px-1 pb-2.5"
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
