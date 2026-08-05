'use client';

import { useRef, useState, useEffect } from 'react';

const NUM_BARRAS = 28;
const PISO = 3; // altura mínima (px) das barras em repouso

function ondaDecorativa() {
  return Array.from({ length: NUM_BARRAS }, (_, i) =>
    PISO + Math.round(Math.sin((i / (NUM_BARRAS - 1)) * Math.PI) * 18 + Math.sin((i / 7) * Math.PI) * 6)
  );
}

const BARRAS_PARADAS = ondaDecorativa();

/**
 * Anima as barrinhas de um player de áudio reagindo ao som de verdade (Web
 * Audio API + AnalyserNode), em vez da onda decorativa fixa antiga. Usada
 * tanto no player do Feed/Correio (AudioPlayer) quanto na prévia de
 * gravação (AudioRecorderButton) — a gravação em si já tinha esse efeito
 * (lendo direto do microfone); isso aqui cobre a PLAYBACK.
 *
 * `createMediaElementSource` só pode ser chamado uma única vez por
 * elemento <audio> (o navegador trava numa segunda tentativa), então a
 * conexão é feita só na primeira vez que toca e reaproveitada depois —
 * daí o `conectadoRef`. Uma vez conectado, TODO o som do elemento passa a
 * sair pelo grafo do Web Audio, por isso o analyser precisa continuar
 * ligado no destino (`analyser.connect(ctx.destination)`) ou o áudio fica
 * mudo.
 *
 * Se o arquivo vier de outra origem sem CORS liberado, o navegador
 * "silencia" a leitura por segurança — as barras então ficam paradas na
 * onda decorativa, mas o áudio continua tocando normalmente.
 */
export default function useAudioBars(audioRef, tocando) {
  const [barras, setBarras] = useState(BARRAS_PARADAS);
  const ctxRef = useRef(null);
  const analyserRef = useRef(null);
  const conectadoRef = useRef(false);
  const rafRef = useRef(null);

  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current);
      ctxRef.current?.close().catch(() => {});
    },
    []
  );

  useEffect(() => {
    if (!tocando) {
      cancelAnimationFrame(rafRef.current);
      setBarras(BARRAS_PARADAS);
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
        // onda decorativa parada e o player segue funcionando normal.
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
        // Sem leitura real (ex.: áudio de outra origem sem CORS liberado
        // no servidor — comum em arquivos do Firebase Storage) — cai pra
        // onda decorativa normal em vez de travar as barras achatadas,
        // pra nunca parecer quebrado mesmo sem conseguir reagir ao som.
        setBarras(BARRAS_PARADAS);
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
