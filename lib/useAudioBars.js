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

// Onda decorativa — aparece parado (quando não está tocando). Não depende
// do arquivo real nem de CORS (ver histórico: fetch+decodeAudioData foi
// removido daqui por travar a tela de Perfil em produção).
const BARRAS_PARADAS = ondaDecorativa();

/**
 * Anima as barrinhas de um player de áudio.
 *
 * Parado, mostra uma onda decorativa fixa. Tocando, mostra uma animação
 * de pulso suave (várias ondas senoidais somadas + um pouco de ruído).
 *
 * IMPORTANTE: este hook NÃO usa mais Web Audio API / AnalyserNode pra ler
 * o volume real do som enquanto toca. Motivo: conectar o elemento <audio>
 * a um AudioContext via createMediaElementSource rerroteia TODA a saída de
 * áudio daquele elemento pelo grafo do Web Audio — e isso se mostrou
 * frágil em produção (o som ficava mudo, sem nenhum erro no console, e a
 * barra travava porque a conexão nem sempre completava) mesmo em áudio
 * local (blob:), sem CORS envolvido. A animação abaixo é decorativa, não
 * reage ao volume real, mas o <audio> toca 100% nativo — sem nenhum risco
 * de ficar mudo por causa da animação.
 */
export default function useAudioBars(audioRef, tocando, src) {
  const [barras, setBarras] = useState(BARRAS_PARADAS);
  const rafRef = useRef(null);
  const faseRef = useRef(0);

  // Reseta quando troca de src (ex: AudioRecorderButton gravando novo áudio)
  useEffect(() => {
    setBarras(BARRAS_PARADAS);
  }, [src]);

  useEffect(() => {
    if (!tocando) {
      cancelAnimationFrame(rafRef.current);
      setBarras(BARRAS_PARADAS);
      return;
    }

    function passo() {
      faseRef.current += 0.35;
      const t = faseRef.current;
      const novas = Array.from({ length: NUM_BARRAS }, (_, i) => {
        const onda =
          Math.sin(t + i * 0.5) * 0.5 +
          Math.sin(t * 1.7 + i * 0.3) * 0.3 +
          Math.random() * 0.3;
        return PISO + Math.max(0, Math.round(((onda + 1) / 2) * ALTURA_MAX));
      });
      setBarras(novas);
      rafRef.current = requestAnimationFrame(passo);
    }
    rafRef.current = requestAnimationFrame(passo);

    return () => cancelAnimationFrame(rafRef.current);
  }, [tocando]);

  return barras;
}
