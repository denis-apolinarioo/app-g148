'use client';

import { useRef, useState, useEffect } from 'react';

const NUM_BARRAS = 28;
const PISO = 3; // altura mínima (px) das barras em repouso
const ALTURA_MAX = 25; // px de variação acima do piso

function ondaDecorativa() {
  return Array.from({ length: NUM_BARRAS }, (_, i) =>
    PISO + Math.round(Math.sin((i / (NUM_BARRAS - 1)) * Math.PI) * 18 + Math.sin((i / 7) * Math.PI) * 6)
  );
}

// Onda genérica de reserva — só aparece se o arquivo não puder ser baixado
// e decodificado por algum motivo (ex.: sem internet, CORS bloqueado de
// verdade). Na prática, com CORS ok, o áudio parado já mostra a onda real.
const BARRAS_PARADAS = ondaDecorativa();

// Cache em memória (dura a sessão da aba) da forma de onda real já
// calculada por áudio, pra não rebaixar/redecodificar o mesmo arquivo toda
// vez que o player remonta (ex.: rolar o Feed pra cima e pra baixo).
// Guarda a Promise enquanto calcula e o array pronto depois, pra chamadas
// simultâneas do mesmo áudio reaproveitarem o mesmo cálculo.
const cacheFormaOnda = new Map();

async function calcularFormaOndaReal(src) {
  const resposta = await fetch(src);
  const buffer = await resposta.arrayBuffer();
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  try {
    const audioBuffer = await ctx.decodeAudioData(buffer);
    const canal = audioBuffer.getChannelData(0);
    const tamanhoBloco = Math.max(1, Math.floor(canal.length / NUM_BARRAS));
    const picos = Array.from({ length: NUM_BARRAS }, (_, i) => {
      let pico = 0;
      const inicio = i * tamanhoBloco;
      const fim = Math.min(canal.length, inicio + tamanhoBloco);
      for (let j = inicio; j < fim; j++) {
        const v = Math.abs(canal[j]);
        if (v > pico) pico = v;
      }
      return pico;
    });
    // Normaliza pelo pico mais alto da faixa inteira, pra sempre usar a
    // altura máxima disponível (áudios mais baixos/sussurrados também
    // ficam com uma onda visível, e não achatada).
    const picoMax = Math.max(...picos, 0.02);
    return picos.map((p) => PISO + Math.round((p / picoMax) * ALTURA_MAX));
  } finally {
    ctx.close().catch(() => {});
  }
}

/**
 * Anima as barrinhas de um player de áudio reagindo ao som de verdade (Web
 * Audio API + AnalyserNode) enquanto toca. Parado/pausado, mostra a forma
 * de onda REAL do áudio inteiro (calculada uma vez a partir do arquivo, com
 * cache em memória por src), não mais uma onda decorativa genérica igual
 * pra todo áudio.
 *
 * Usado tanto no player do Feed/Correio (AudioPlayer) quanto na prévia de
 * gravação (AudioRecorderButton).
 *
 * `createMediaElementSource` só pode ser chamado uma única vez por
 * elemento <audio> (o navegador trava numa segunda tentativa), então a
 * conexão é feita só na primeira vez que toca e reaproveitada depois —
 * daí o `conectadoRef`. Uma vez conectado, TODO o som do elemento passa a
 * sair pelo grafo do Web Audio, por isso o analyser precisa continuar
 * ligado no destino (`analyser.connect(ctx.destination)`) ou o áudio fica
 * mudo.
 */
export default function useAudioBars(audioRef, tocando, src) {
  const [barras, setBarras] = useState(BARRAS_PARADAS);
  const ctxRef = useRef(null);
  const analyserRef = useRef(null);
  const conectadoRef = useRef(false);
  const rafRef = useRef(null);
  const formaOndaRef = useRef(null);
  const tocandoRef = useRef(false);

  useEffect(() => {
    tocandoRef.current = tocando;
  }, [tocando]);

  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current);
      ctxRef.current?.close().catch(() => {});
    },
    []
  );

  // Calcula (ou reaproveita do cache) a forma de onda real do arquivo
  // assim que o src estiver disponível, independente de estar tocando ou
  // não — assim ela já está pronta pra mostrar parada desde o começo.
  useEffect(() => {
    if (!src) return;
    let cancelado = false;

    const existente = cacheFormaOnda.get(src);
    const promessa = existente || calcularFormaOndaReal(src).catch(() => BARRAS_PARADAS);
    if (!existente) cacheFormaOnda.set(src, promessa);

    promessa.then((arr) => {
      cacheFormaOnda.set(src, arr); // troca a Promise pelo resultado já resolvido
      if (cancelado) return;
      formaOndaRef.current = arr;
      if (!tocandoRef.current) setBarras(arr);
    });

    return () => {
      cancelado = true;
    };
  }, [src]);

  useEffect(() => {
    if (!tocando) {
      cancelAnimationFrame(rafRef.current);
      setBarras(formaOndaRef.current || BARRAS_PARADAS);
      return;
    }
    if (!audioRef.current) return;

    if (!conectadoRef.current) {
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        const ctx = new Ctx();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 128;
        const source = ctx.createMediaElementSource(audioRef.current);
        source.connect(analyser);
        analyser.connect(ctx.destination);
        ctxRef.current = ctx;
        analyserRef.current = analyser;
        conectadoRef.current = true;
      } catch {
        // Navegador sem suporte, ou já conectado por engano — mantém a
        // forma de onda real (ou decorativa, se ainda não calculou) e o
        // player segue funcionando normal.
        return;
      }
    }

    ctxRef.current?.resume?.().catch(() => {});

    const analyser = analyserRef.current;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const passoIdx = Math.max(1, Math.floor(data.length / NUM_BARRAS));

    function passo() {
      analyser.getByteFrequencyData(data);
      let soma = 0;
      for (let i = 0; i < data.length; i++) soma += data[i];
      if (soma === 0) {
        // Sem leitura real (ex.: CORS ainda bloqueado por algum motivo) —
        // cai pra forma de onda real já calculada (ou decorativa, se
        // nenhuma das duas funcionou), em vez de travar as barras achatadas.
        setBarras(formaOndaRef.current || BARRAS_PARADAS);
      } else {
        const novas = Array.from({ length: NUM_BARRAS }, (_, i) => {
          const v = data[i * passoIdx] || 0;
          return PISO + Math.round((v / 255) * 25);
        });
        setBarras(novas);
      }
      rafRef.current = requestAnimationFrame(passo);
    }
    rafRef.current = requestAnimationFrame(passo);

    return () => cancelAnimationFrame(rafRef.current);
  }, [tocando, audioRef]);

  return barras;
}
