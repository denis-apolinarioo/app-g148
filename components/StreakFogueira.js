'use client';

import { useState } from 'react';
import { Flame } from 'lucide-react';
import { vibrarToqueLeve } from '@/lib/haptics';

let proximoIdFaisca = 0;

// Camadas de chama por faixa de dias de streak — cada faixa empilha mais
// "chamas" (tamanho/cor/posição variados) por cima da lenha, dando a
// sensação de fogo crescendo conforme a constância aumenta.
function chamasParaDias(dias) {
  if (dias >= 31) {
    return [
      { tamanho: 30, cor: 'text-orange-500', bottom: 2, left: 6, atraso: '0s' },
      { tamanho: 24, cor: 'text-red-500', bottom: 6, left: -12, atraso: '0.35s' },
      { tamanho: 24, cor: 'text-orange-400', bottom: 8, left: 10, atraso: '0.15s' },
      { tamanho: 18, cor: 'text-yellow-400', bottom: 12, left: -2, atraso: '0.55s' },
    ];
  }
  if (dias >= 15) {
    return [
      { tamanho: 24, cor: 'text-orange-500', bottom: 4, left: -5, atraso: '0s' },
      { tamanho: 19, cor: 'text-red-500', bottom: 8, left: 7, atraso: '0.3s' },
      { tamanho: 15, cor: 'text-yellow-400', bottom: 10, left: 0, atraso: '0.5s' },
    ];
  }
  if (dias >= 8) {
    return [
      { tamanho: 20, cor: 'text-orange-500', bottom: 6, left: -4, atraso: '0s' },
      { tamanho: 15, cor: 'text-yellow-400', bottom: 9, left: 5, atraso: '0.35s' },
    ];
  }
  if (dias >= 1) {
    return [{ tamanho: 18, cor: 'text-orange-500', bottom: 8, left: 0, atraso: '0s' }];
  }
  return [];
}

/**
 * Fogueira animada do streak de constância — substitui a antiga caixa
 * branca com texto por um visual mais lúdico, sem fundo, com a lenha
 * cruzada sempre visível e o fogo crescendo em 4 estágios (1-7, 8-14,
 * 15-30, 31+ dias). Em 0 dias mostra só a lenha, sem fogo.
 *
 * Interativa: tocar faz uma faiscazinha subir e sumir (só efeito visual,
 * não mexe em nada no Firestore).
 */
export default function StreakFogueira({ dias = 0 }) {
  const [faiscas, setFaiscas] = useState([]);
  const chamas = chamasParaDias(dias);

  function handleClick() {
    vibrarToqueLeve();
    const id = proximoIdFaisca++;
    setFaiscas((atual) => [...atual, id]);
    setTimeout(() => {
      setFaiscas((atual) => atual.filter((f) => f !== id));
    }, 700);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      // Padding inferior igual ao card de Pontos de Comunhão (py-2.5 = 10px)
      // — o topo fica mais enxuto (pt-1) porque a lenha/chama já é um
      // elemento visualmente "pesado". Isso faz o rótulo "X dias" cair na
      // mesma altura do rótulo "Pontos de Comunhão" ao lado, quando os dois
      // ficam numa linha com items-end (ver ProfileView.js) — antes, com
      // padding simétrico pequeno, a fogueira "vazava" pra baixo por ser
      // mais alta que o card e parecia desalinhada.
      className="flex flex-col items-center gap-1 px-1 pb-2.5 pt-1"
      aria-label={`Streak de ${dias} ${dias === 1 ? 'dia' : 'dias'}`}
    >
      <div className="relative h-12 w-14">
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

        {faiscas.map((id) => (
          <div key={id} className="absolute bottom-3 left-1/2 -translate-x-1/2">
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
