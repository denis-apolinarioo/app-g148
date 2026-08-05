'use client';

import { useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';
import useAudioBars from '@/lib/useAudioBars';

// ============================================================================
// Player de áudio dos POSTS (Feed/perfil) — antes usava o <audio controls>
// nativo do navegador (feio, cara de Android/Chrome, sem nada do visual do
// app). Agora usa o mesmo padrão de onda + play/pause já testado na prévia
// de gravação (components/AudioRecorderButton.js), sem botão de mudo.
//
// O progresso segue o áudio de verdade via eventos nativos do <audio>
// (onTimeUpdate/onLoadedMetadata/onEnded) — o elemento <audio> em si fica
// escondido (só toca o som), quem aparece na tela é a onda + play/pause.
//
// CURTIDA POR DUPLO TOQUE: este componente não decide sozinho o que é
// "duplo toque" — só avisa o pai (via `onTap`) toda vez que a pessoa clica
// em QUALQUER parte dele (play, onda, ou o espaço vazio ao redor). Isso
// funciona por causa do "bubbling" normal do clique no navegador — não
// precisa de nenhum código extra pra isso "chegar" no botão de play/na onda,
// já que nenhum deles usa stopPropagation. Assim o toque duplo funciona no
// player inteiro, não só numa faixa em volta dele.
// ============================================================================
export default function AudioPlayer({ src, onTap, className = '' }) {
  const [tocando, setTocando] = useState(false);
  const [duracao, setDuracao] = useState(0);
  const [tempoAtual, setTempoAtual] = useState(0);
  const audioRef = useRef(null);
  const duracaoRef = useRef(0);

  const progresso = duracaoRef.current > 0 ? tempoAtual / duracaoRef.current : 0;

  // Barras reagindo ao som de verdade enquanto toca (Web Audio API) — a
  // parte "tocada" continua sendo pintada por cima conforme progride.
  const barras = useAudioBars(audioRef, tocando);

  function alternarPlay(e) {
    e.stopPropagation();
    if (!audioRef.current) return;
    if (tocando) {
      audioRef.current.pause();
      setTocando(false);
    } else {
      audioRef.current.play();
      setTocando(true);
    }
    onTap?.();
  }

  function handleTimeUpdate() {
    if (!audioRef.current) return;
    setTempoAtual(audioRef.current.currentTime);
  }

  function handleLoadedMetadata() {
    if (!audioRef.current) return;
    const dur = audioRef.current.duration;
    const durFinal = dur && isFinite(dur) ? dur : 0;
    duracaoRef.current = durFinal;
    setDuracao(durFinal);
  }

  function handleEnded() {
    setTocando(false);
    setTempoAtual(0);
    if (audioRef.current) audioRef.current.currentTime = 0;
  }

  function handleBarraClick(e) {
    e.stopPropagation();
    if (!audioRef.current || !duracaoRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audioRef.current.currentTime = pct * duracaoRef.current;
    setTempoAtual(pct * duracaoRef.current);
    onTap?.();
  }

  function fmt(s) {
    const t = Math.round(s || 0);
    return `${Math.floor(t / 60).toString().padStart(2, '0')}:${(t % 60).toString().padStart(2, '0')}`;
  }

  return (
    <div className={`flex items-center gap-3 ${className}`} onClick={() => onTap?.()}>
      <button
        type="button"
        onClick={alternarPlay}
        aria-label={tocando ? 'Pausar áudio' : 'Tocar áudio'}
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-coffee-700 text-cream shadow-sm"
      >
        {tocando ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" className="ml-0.5" />}
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex h-7 cursor-pointer items-end gap-[2px]" onClick={handleBarraClick}>
          {barras.map((altura, i) => {
            const passado = progresso > 0 && i / 28 <= progresso;
            return (
              <div
                key={i}
                className="flex-1 rounded-full transition-colors duration-75"
                style={{ height: `${altura}px`, backgroundColor: passado ? '#3F2C1C' : '#D4C4B0' }}
              />
            );
          })}
        </div>
        <div className="flex justify-between text-[10px] text-coffee-400">
          <span>{fmt(tempoAtual)}</span>
          <span>{fmt(duracao)}</span>
        </div>
      </div>

      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        preload="metadata"
        className="hidden"
      />
    </div>
  );
}
