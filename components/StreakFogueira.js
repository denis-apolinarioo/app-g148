'use client';

import { useState } from 'react';
import Lottie from 'lottie-react';
import { Flame } from 'lucide-react';
import { vibrarToqueLeve } from '@/lib/haptics';
import fireAnimation from '@/lib/lottie/fire.json';

let proximoIdFaisca = 0;

/**
 * Fogueira do streak de constância — usa a animação Lottie fire.json (fogo
 * vetorial, looping) em vez das fotos estáticas por nível de antes.
 *
 * Não cresce mais em estágios por quantidade de dias. Fica ACESA sempre que
 * a pessoa já completou pelo menos 1 missão HOJE — controlado por
 * `usuario.ultimoDiaAtivo === hoje` (fuso Brasília, ver lib/dateUtils.js),
 * calculado no componente pai (ProfileView.js) e passado aqui como `aceso`.
 * Se a pessoa ainda não entrou/não fez nada hoje, fica vazia (sem fogo) —
 * mesmo que o contador de dias (`dias`/streakAtual) ainda mostre um número,
 * já que o streak só reseta de fato na próxima ação fora da sequência (ver
 * atualizarStreak em lib/points.js).
 *
 * Interação: cada clique solta 1 faísca avulsa, com direção e distância
 * aleatórias — só efeito visual, não mexe em nada no Firestore. Só reage a
 * clique quando está acesa (sem fogo, não tem o que faiscar).
 */
export default function StreakFogueira({ dias = 0, aceso = false }) {
  const [faiscas, setFaiscas] = useState([]);

  function handleClick() {
    if (!aceso) return;
    vibrarToqueLeve();

    const id = proximoIdFaisca++;
    // Ângulo e distância aleatórios pra cada faísca sair "pra qualquer lado",
    // com viés leve pra cima (ty sempre negativo) pra parecer faísca subindo,
    // não caindo.
    const anguloGraus = 200 + Math.random() * 140; // ~200°–340°: leque voltado pra cima
    const distancia = 22 + Math.random() * 20;
    const tx = Math.cos((anguloGraus * Math.PI) / 180) * distancia;
    const ty = Math.sin((anguloGraus * Math.PI) / 180) * distancia;

    setFaiscas((atual) => [...atual, { id, tx, ty }]);
    setTimeout(() => {
      setFaiscas((atual) => atual.filter((f) => f.id !== id));
    }, 650);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      // translate-y-2: desce a fogueira (pedido do usuário), quase na base
      // do balão de Pontos de Comunhão ao lado — o translate não mexe no
      // fluxo do layout, só empurra o visual pra baixo. items-end no pai
      // (ProfileView.js) já alinha as duas bases antes desse ajuste extra.
      className="flex translate-y-2 flex-col items-center gap-1 px-1 pb-2.5"
      aria-label={
        aceso
          ? `Streak de ${dias} ${dias === 1 ? 'dia' : 'dias'}`
          : `Streak de ${dias} ${dias === 1 ? 'dia' : 'dias'} — ainda sem missão concluída hoje`
      }
    >
      <div className="relative flex h-14 w-14 items-end justify-center">
        {aceso && (
          <Lottie
            animationData={fireAnimation}
            loop
            autoplay
            speed={1.5}
            className="h-14 w-14"
          />
        )}

        {faiscas.map((f) => (
          <div
            key={f.id}
            className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 animate-faiscaVoa"
            style={{ '--faisca-tx': `${f.tx}px`, '--faisca-ty': `${f.ty}px` }}
          >
            <Flame size={11} fill="currentColor" className="text-orange-400" />
          </div>
        ))}
      </div>
      <span className="font-destaque text-xs font-semibold text-coffee-700">
        {dias} {dias === 1 ? 'dia' : 'dias'}
      </span>
    </button>
  );
}
