'use client';

import { useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';
import useAudioBars from '@/lib/useAudioBars';

// ============================================================================
// Player de áudio dos POSTS (Feed/perfil) — usa o mesmo padrão de onda +
// play/pause da prévia de gravação (AudioRecorderButton.js), sem botão de mudo.
//
// O progresso segue o áudio via eventos nativos do <audio>
// (onTimeUpdate/onLoadedMetadata/onEnded) — o <audio> fica escondido.
//
// DUPLO TOQUE: este componente não gerencia o duplo toque. O pai (PostCard)
// envolve o player num div com onClick={handleDuploToque}, e os cliques em
// qualquer parte do player sobem normalmente pelo bubbling até esse div.
// O play e a barra NÃO chamam stopPropagation pra não bloquear esse bubbling.
// ============================================================================
export default function AudioPlayer({ src, className = '' }) {
  const [tocando, setTocando] = useState(false);
  const [duracao, setDuracao] = useState(0);
  const [tempoAtual, setTempoAtual] = useState(0);
  const audioRef = useRef(null);
  const duracaoRef = useRef(0);

  const progresso = duracaoRef.current > 0 ? tempoAtual / duracaoRef.current : 0;

  // Barras reagindo ao som de verdade enquanto toca (Web Audio API) — a
  // parte "tocada" continua sendo pintada por cima conforme progride.
  // Parado, mostra a forma de onda real do áudio inteiro (calculada uma
  // vez a partir do arquivo, com cache — ver lib/useAudioBars.js).
  const barras = useAudioBars(audioRef, tocando, src);

  function alternarPlay() {
    if (!audioRef.current) return;
    if (tocando) {
      audioRef.current.pause();
      setTocando(false);
    } else {
      audioRef.current.play();
      setTocando(true);
    }
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
    if (!audioRef.current || !duracaoRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audioRef.current.currentTime = pct * duracaoRef.current;
    setTempoAtual(pct * duracaoRef.current);
  }

  function fmt(s) {
    const t = Math.round(s || 0);
    return `${Math.floor(t / 60).toString().padStart(2, '0')}:${(t % 60).toString().padStart(2, '0')}`;
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <button
        type="button"
        onClick={alternarPlay}
        aria-label={tocando ? 'Pausar áudio' : 'Tocar áudio'}
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-coffee-700 text-cream shadow-sm"
      >
        {tocando ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" className="ml-0.5" />}
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="relative flex h-7 cursor-pointer items-end gap-[2px]" onClick={handleBarraClick}>
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
          {duracaoRef.current > 0 && (
            <div
              className="pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-coffee-700 shadow-sm"
              style={{ left: `${progresso * 100}%` }}
            />
          )}
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
