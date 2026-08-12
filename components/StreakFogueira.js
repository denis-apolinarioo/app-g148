'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Lottie from 'lottie-react';
import { Flame } from 'lucide-react';
import { vibrarToqueLeve } from '@/lib/haptics';
import fireAnimation from '@/lib/lottie/fire.json';

let proximoIdFaisca = 0;

// 4 níveis por tempo de streak (dias seguidos). Só a ALTURA da chama muda
// entre eles — a largura fica travada em LARGURA_REAL em todo nível (ela
// "cresce pra cima", nunca pros lados). velocidade = setSpeed do Lottie;
// faiscaIntervaloS = a cada quantos segundos (em média) sai uma faísca
// sozinha; cliqueQtd = quantas faíscas um toque solta de uma vez.
const LARGURA_REAL = 66; // px — fixa em todo nível
const NIVEIS = [
  { min: 1, max: 7, altura: 51, velocidade: 1.5, faiscaIntervaloS: 1.0, cliqueQtd: 1 },
  { min: 8, max: 14, altura: 56, velocidade: 1.7, faiscaIntervaloS: 0.7, cliqueQtd: 2 },
  { min: 15, max: 30, altura: 61, velocidade: 2.0, faiscaIntervaloS: 0.5, cliqueQtd: 2 },
  { min: 31, max: Infinity, altura: 66, velocidade: 2.2, faiscaIntervaloS: 0.3, cliqueQtd: 5 },
];

function obterNivel(dias) {
  const d = Math.max(1, dias || 1);
  return NIVEIS.find((n) => d >= n.min && d <= n.max) || NIVEIS[NIVEIS.length - 1];
}

// A chama fica com position:absolute dentro de uma caixa de tamanho fixo
// (56x56, ver mais abaixo) — o offset abaixo da caixa é sempre -5px, em
// todo nível (só a altura da própria chama muda, isso aqui não).
const CHAMA_OFFSET_BOTTOM = -5;

// Fração da altura da chama (medida a partir da BASE dela, não da caixa)
// onde a faísca nasce — pedido do usuário: "quase da base, centralizada,
// saindo praticamente do meio". Mesmo valor em todo nível, então a faísca
// sempre nasce num ponto proporcional à chama atual, não um pixel fixo.
const FAISCA_ORIGEM_FRACAO = 0.25;

// Cada faísca "estoura" da chama numa direção totalmente aleatória (pode
// sair de lado ou até meio pra baixo, como uma fagulha de verdade), mas a
// partir do 2º trecho a trajetória sempre curva pra cima — o puxão vertical
// domina o resto do caminho, não importa de que lado ela saiu. É uma curva
// em 3 trechos (estouro → sobe → some), não uma linha reta. Esse padrão é o
// mesmo em todos os níveis — só o intervalo entre faíscas e quantas saem no
// toque mudam por nível.
function gerarTrajetoriaFaisca() {
  const anguloEstouro = Math.random() * 360;
  const distEstouro = 5 + Math.random() * 9;
  const tx1 = Math.cos((anguloEstouro * Math.PI) / 180) * distEstouro;
  const ty1 = Math.sin((anguloEstouro * Math.PI) / 180) * distEstouro;

  const derivaLateral = (Math.random() - 0.5) * 14; // ventinho lateral extra, aleatório
  const tx2 = tx1 * 1.3 + derivaLateral;
  const ty2 = -(16 + Math.random() * 12); // a partir daqui só sobe

  const tx3 = tx2 * 0.75; // desacelera de lado (resistência do ar)
  const ty3 = -(42 + Math.random() * 22); // continua subindo até sumir

  return { tx1, ty1, tx2, ty2, tx3, ty3 };
}

/**
 * Fogueira do streak de constância — usa a animação Lottie fire.json (fogo
 * vetorial, looping) em vez das fotos estáticas por nível de antes.
 *
 * Fica ACESA se a pessoa completou uma missão HOJE ou ONTEM — não apaga
 * assim que vira o dia; só apaga de fato quando passa 00:00 do 2º dia sem
 * nenhuma ação (ver aceso em ProfileView.js, calculado com
 * todayBrasilia()/yesterdayBrasilia() de lib/dateUtils.js). O streak em si
 * (o número) só reseta na próxima ação fora da sequência (ver
 * atualizarStreak em lib/points.js) — `aceso` é só o liga/desliga visual.
 *
 * Tamanho/velocidade/faíscas mudam em 4 níveis conforme `dias` (streak
 * atual) — ver NIVEIS no topo do arquivo: 1-7, 8-14, 15-30 e 31+ dias.
 * Só a altura da chama cresce (sempre "pra cima", a largura não muda) e só
 * ela entra em position:absolute — a caixa que conta pro layout flex do
 * Perfil continua com tamanho fixo (56x56) em todo nível, então crescer de
 * nível nunca empurra o balão de Pontos de Comunhão nem a Vitrine de
 * Conquistas.
 *
 * Faíscas: saem sozinhas o tempo todo enquanto está acesa, num intervalo
 * sempre aleatório girando em torno do valor do nível atual (não é um
 * metrônomo fixo — cada uma espera um tempinho diferente). Nascem perto da
 * base da chama, centralizadas. Um toque na fogueira solta várias de uma
 * vez (quantidade também por nível). Só efeito visual, não mexe em nada no
 * Firestore. Sem fogo, não tem o que faiscar (nem automático nem por
 * toque).
 */
export default function StreakFogueira({ dias = 0, aceso = false }) {
  const [faiscas, setFaiscas] = useState([]);
  const lottieRef = useRef(null);
  const nivel = obterNivel(dias);

  // setSpeed precisa ser chamado depois que o player carrega — o próprio
  // callback onDOMLoaded do lottie-react garante isso; o efeito é só um
  // reforço caso `aceso` ou o nível (velocidade) mudem e o player continue
  // montado.
  useEffect(() => {
    lottieRef.current?.setSpeed(nivel.velocidade);
  }, [aceso, nivel.velocidade]);

  const emitirFaisca = useCallback(() => {
    const id = proximoIdFaisca++;
    setFaiscas((atual) => [...atual, { id, ...gerarTrajetoriaFaisca() }]);
    setTimeout(() => {
      setFaiscas((atual) => atual.filter((f) => f.id !== id));
    }, 900);
  }, []);

  // Loop de faíscas automáticas: reagenda a si mesmo com um atraso aleatório
  // a cada rodada (girando em torno do intervalo do nível atual), então
  // nunca cai num ritmo mecânico. Só roda enquanto a fogueira está acesa;
  // para e limpa o timer se apagar, mudar de nível ou desmontar.
  useEffect(() => {
    if (!aceso) return undefined;
    let ativo = true;
    let timeoutId;
    const intervaloMs = nivel.faiscaIntervaloS * 1000;

    function agendarProxima() {
      const atraso = intervaloMs * 0.6 + Math.random() * intervaloMs * 0.8; // sempre aleatório, em torno do intervalo do nível
      timeoutId = setTimeout(() => {
        if (!ativo) return;
        emitirFaisca();
        agendarProxima();
      }, atraso);
    }

    agendarProxima();
    return () => {
      ativo = false;
      clearTimeout(timeoutId);
    };
  }, [aceso, nivel.faiscaIntervaloS, emitirFaisca]);

  function handleClick() {
    if (!aceso) return;
    vibrarToqueLeve();
    for (let i = 0; i < nivel.cliqueQtd; i += 1) emitirFaisca();
  }

  // Ponto de origem das faíscas: perto da base da chama, medido a partir da
  // altura REAL do nível atual (não um pixel fixo) — ver FAISCA_ORIGEM_FRACAO.
  const faiscaOrigemBottomPx = CHAMA_OFFSET_BOTTOM + FAISCA_ORIGEM_FRACAO * nivel.altura;

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
      {/* Caixa com o TAMANHO ORIGINAL fixo (56x56) — é isso que entra na
          conta do layout flex (items-end na linha com o balão de Pontos de
          Comunhão, em ProfileView.js). A chama em si varia de altura por
          nível (51 a 66px) e fica com position:absolute por dentro, então o
          "footprint" que o layout enxerga nunca muda — trocar de nível não
          empurra mais o balão de Pontos nem a Vitrine de Conquistas embaixo. */}
      <div className="relative h-14 w-14">
        {aceso && (
          <Lottie
            lottieRef={lottieRef}
            animationData={fireAnimation}
            loop
            autoplay
            onDOMLoaded={() => lottieRef.current?.setSpeed(nivel.velocidade)}
            className="absolute left-1/2 w-[66px] -translate-x-1/2"
            style={{ height: `${nivel.altura}px`, bottom: `${CHAMA_OFFSET_BOTTOM}px` }}
          />
        )}

        {faiscas.map((f) => (
          <div
            key={f.id}
            className="pointer-events-none absolute left-1/2 -translate-x-1/2 animate-faiscaVoa"
            style={{
              bottom: `${faiscaOrigemBottomPx}px`,
              '--faisca-tx1': `${f.tx1}px`,
              '--faisca-ty1': `${f.ty1}px`,
              '--faisca-tx2': `${f.tx2}px`,
              '--faisca-ty2': `${f.ty2}px`,
              '--faisca-tx3': `${f.tx3}px`,
              '--faisca-ty3': `${f.ty3}px`,
            }}
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
