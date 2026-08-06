'use client';

import { useRef, useState } from 'react';
import { Flame } from 'lucide-react';
import { vibrarToqueLeve } from '@/lib/haptics';

let proximoIdFaisca = 0;

// Duração do "segurar" antes de entrar em modo pré-visualização (ms) e o
// intervalo entre cada nível subindo automaticamente durante o long press.
const ATRASO_LONG_PRESS = 350;
const INTERVALO_PREVIEW = 550;
const NIVEL_MIN = 1;
const NIVEL_MAX = 7;

// Fogueira em 7 estágios reais (fotos do usuário, ver
// public/icons/streak/fogueira-1.png a fogueira-7.png), cada arquivo já
// com o fogo + lenha cruzada prontos — não é mais desenhado com ícones.
const IMAGEM_POR_NIVEL = {
  1: '/icons/streak/fogueira-1.png',
  2: '/icons/streak/fogueira-2.png',
  3: '/icons/streak/fogueira-3.png',
  4: '/icons/streak/fogueira-4.png',
  5: '/icons/streak/fogueira-5.png',
  6: '/icons/streak/fogueira-6.png',
  7: '/icons/streak/fogueira-7.png',
};

// Dias de streak → nível (1 a 7), cortes definidos pelo usuário.
function nivelParaDias(dias) {
  if (dias >= 40) return 7;
  if (dias >= 28) return 6;
  if (dias >= 21) return 5;
  if (dias >= 14) return 4;
  if (dias >= 7) return 3;
  if (dias >= 3) return 2;
  return 1; // 0 e 1 dia caem no nível 1 (não existe estágio "sem fogo" nas fotos)
}

/**
 * Fogueira do streak de constância — usa as 7 fotos reais mandadas pelo
 * usuário (fogueira-1.png a fogueira-7.png), cada uma já pronta (fogo +
 * lenha cruzada). As imagens ficam ancoradas embaixo (items-end) num
 * container de altura fixa, pra lenha de todos os níveis alinhar na mesma
 * base enquanto só a chama cresce pra cima.
 *
 * Toque rápido: solta faíscas subindo (quantidade cresce com o nível
 * atual), só efeito visual, não mexe em nada no Firestore.
 *
 * Segurar (long press): depois de ~350ms, entra em modo pré-visualização e
 * vai passando pelos níveis seguintes automaticamente, pra dar pra ver
 * como cada estágio fica — solta o dedo/botão e ela volta pro nível real.
 */
export default function StreakFogueira({ dias = 0 }) {
  const [faiscas, setFaiscas] = useState([]);
  const [nivelPreview, setNivelPreview] = useState(null);
  const holdTimeoutRef = useRef(null);
  const previewIntervalRef = useRef(null);
  const houvePreviewRef = useRef(false);

  const nivelReal = nivelParaDias(dias);
  const nivelExibido = nivelPreview ?? nivelReal;

  function iniciarPreview() {
    let atual = Math.min(NIVEL_MAX, nivelReal + 1);
    if (atual <= nivelReal) return; // já está no máximo, nada pra pré-visualizar
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
    const qtd = Math.max(1, nivelReal - NIVEL_MIN + 1);
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
      // translate-y-2: desce a fogueira (pedido do usuário), quase na base
      // do balão de Pontos de Comunhão ao lado — o translate não mexe no
      // fluxo do layout, só empurra o visual pra baixo. items-end no pai
      // (ProfileView.js) já alinha as duas bases antes desse ajuste extra.
      className="flex translate-y-2 flex-col items-center gap-1 px-1 pb-2.5"
      aria-label={`Streak de ${dias} ${dias === 1 ? 'dia' : 'dias'}`}
    >
      <div className="relative flex h-14 w-14 items-end justify-center">
        <img
          src={IMAGEM_POR_NIVEL[nivelExibido]}
          alt=""
          className="max-h-14 w-auto max-w-full object-contain"
          draggable={false}
        />

        {faiscas.map((f) => (
          <div
            key={f.id}
            className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2"
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
