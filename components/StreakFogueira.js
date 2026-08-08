'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Lottie from 'lottie-react';
import { Flame } from 'lucide-react';
import { vibrarToqueLeve } from '@/lib/haptics';
import fireAnimation from '@/lib/lottie/fire.json';

let proximoIdFaisca = 0;

// Velocidade da chama Lottie — 1 é o ritmo original do arquivo, 2 é o
// dobro da velocidade (pedido do usuário, "quero a animação rodando mais
// rápido"). Setado via lottieRef.setSpeed porque a versão do lottie-react
// usada aqui não tem prop `speed` direta.
const VELOCIDADE_CHAMA = 2.0;

// Cada faísca "estoura" da chama numa direção totalmente aleatória (pode
// sair de lado ou até meio pra baixo, como uma fagulha de verdade), mas a
// partir do 2º trecho a trajetória sempre curva pra cima — o puxão vertical
// domina o resto do caminho, não importa de que lado ela saiu. É uma curva
// em 3 trechos (estouro → sobe → some), não uma linha reta.
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
 * Não cresce mais em estágios por quantidade de dias. Fica ACESA sempre que
 * a pessoa já completou pelo menos 1 missão HOJE — controlado por
 * `usuario.ultimoDiaAtivo === hoje` (fuso Brasília, ver lib/dateUtils.js),
 * calculado no componente pai (ProfileView.js) e passado aqui como `aceso`.
 * Se a pessoa ainda não entrou/não fez nada hoje, fica vazia (sem fogo) —
 * mesmo que o contador de dias (`dias`/streakAtual) ainda mostre um número,
 * já que o streak só reseta de fato na próxima ação fora da sequência (ver
 * atualizarStreak em lib/points.js).
 *
 * Faíscas: saem sozinhas o tempo todo enquanto está acesa, num intervalo
 * sempre aleatório girando em torno de meio segundo (não é um metrônomo
 * fixo de 500ms — cada uma espera um tempinho diferente). Um toque na
 * fogueira solta mais uma faísca na hora, além dessas automáticas. Só
 * efeito visual, não mexe em nada no Firestore. Sem fogo, não tem o que
 * faiscar (nem automático nem por toque).
 */
export default function StreakFogueira({ dias = 0, aceso = false }) {
  const [faiscas, setFaiscas] = useState([]);
  const lottieRef = useRef(null);

  // setSpeed precisa ser chamado depois que o player carrega — o próprio
  // callback onDOMLoaded do lottie-react garante isso; o efeito é só um
  // reforço caso `aceso` mude (fogo apaga e acende de novo no dia
  // seguinte) e o player seja remontado.
  useEffect(() => {
    lottieRef.current?.setSpeed(VELOCIDADE_CHAMA);
  }, [aceso]);

  const emitirFaisca = useCallback(() => {
    const id = proximoIdFaisca++;
    setFaiscas((atual) => [...atual, { id, ...gerarTrajetoriaFaisca() }]);
    setTimeout(() => {
      setFaiscas((atual) => atual.filter((f) => f.id !== id));
    }, 900);
  }, []);

  // Loop de faíscas automáticas: reagenda a si mesmo com um atraso aleatório
  // a cada rodada, então nunca cai num ritmo mecânico. Só roda enquanto a
  // fogueira está acesa; para e limpa o timer se apagar ou desmontar.
  useEffect(() => {
    if (!aceso) return undefined;
    let ativo = true;
    let timeoutId;

    function agendarProxima() {
      const atraso = 300 + Math.random() * 400; // gira em torno de 0,5s, sempre aleatório
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
  }, [aceso, emitirFaisca]);

  function handleClick() {
    if (!aceso) return;
    vibrarToqueLeve();
    emitirFaisca();
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
            lottieRef={lottieRef}
            animationData={fireAnimation}
            loop
            autoplay
            onDOMLoaded={() => lottieRef.current?.setSpeed(VELOCIDADE_CHAMA)}
            className="h-14 w-14"
          />
        )}

        {faiscas.map((f) => (
          <div
            key={f.id}
            className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 animate-faiscaVoa"
            style={{
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
