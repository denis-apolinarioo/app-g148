'use client';

import { useRef, useState, useEffect } from 'react';

const NUM_BARRAS = 28;
const PISO = 3;
const ALTURA_MAX = 25;

function ondaDecorativa() {
  return Array.from({ length: NUM_BARRAS }, (_, i) =>
    PISO + Math.round(Math.sin((i / (NUM_BARRAS - 1)) * Math.PI) * 18 + Math.sin((i / 7) * Math.PI) * 6)
  );
}

// Onda decorativa — aparece parado (quando não está tocando). Antes a gente
// tentava calcular a onda REAL do arquivo via fetch+decodeAudioData, mas
// isso exige CORS configurado no Firebase Storage (o cors.json do projeto
// tem "SEU-DOMINIO-AQUI.com" como placeholder — não está configurado pra
// produção), então o fetch sempre falha em produção e lançava exceção,
// quebrando a tela de Perfil com vários players. Onda decorativa é mais
// simples, não depende de CORS, e o resultado visual é equivalente.
const BARRAS_PARADAS = ondaDecorativa();

/**
 * Anima as barrinhas de um player de áudio reagindo ao som de verdade (Web
 * Audio API + AnalyserNode) enquanto toca. Parado, mostra uma onda
 * decorativa — não faz fetch do arquivo, não depende de CORS.
 *
 * `createMediaElementSource` só pode ser chamado uma única vez por
 * elemento <audio> — a conexão é feita só na primeira vez que toca e
 * reaproveitada depois (daí o `conectadoRef`). Uma vez conectado, todo o
 * som passa pelo grafo do Web Audio, então o analyser precisa continuar
 * ligado no destino ou o áudio fica mudo.
 */
export default function useAudioBars(audioRef, tocando, src) {
  const [barras, setBarras] = useState(BARRAS_PARADAS);
  const ctxRef = useRef(null);
  const analyserRef = useRef(null);
  const conectadoRef = useRef(false);
  const rafRef = useRef(null);

  // Reseta quando troca de src (ex: AudioRecorderButton gravando novo áudio)
  useEffect(() => {
    setBarras(BARRAS_PARADAS);
    // Não desmonta o AudioContext nem o analyser — o elemento <audio> é o
    // mesmo ref, só o src mudou. Se desconectar aqui, createMediaElementSource
    // vai lançar erro na próxima vez que tocar ("already connected").
  }, [src]);

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
        // Navegador sem suporte — player continua funcionando, só sem
        // animação nas barras enquanto toca.
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
        setBarras(BARRAS_PARADAS);
      } else {
        const novas = Array.from({ length: NUM_BARRAS }, (_, i) => {
          const v = data[i * passoIdx] || 0;
          return PISO + Math.round((v / 255) * ALTURA_MAX);
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
