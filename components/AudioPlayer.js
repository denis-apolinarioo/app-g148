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
  const corrigindoDuracaoRef = useRef(false);

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
    const audio = audioRef.current;
    if (!audio) return;
    const dur = audio.duration;
    if ((dur === Infinity || Number.isNaN(dur)) && !corrigindoDuracaoRef.current) {
      // Bug conhecido do Chrome com áudio gravado (MediaRecorder/webm): o
      // arquivo não guarda a duração no cabeçalho, então o navegador só
      // consegue calcular depois de "varrer" o arquivo inteiro uma vez.
      corrigindoDuracaoRef.current = true;
      audio.currentTime = 1e101;
      const aoVarrer = () => {
        audio.removeEventListener('timeupdate', aoVarrer);
        const durReal = audio.duration && isFinite(audio.duration) ? audio.duration : 0;
        duracaoRef.current = durReal;
        setDuracao(durReal);
        audio.currentTime = 0;
        corrigindoDuracaoRef.current = false;
      };
      audio.addEventListener('timeupdate', aoVarrer);
      return;
    }
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
    const audio = audioRef.current;
    if (!audio) return;
    // Lê a duração direto do elemento (fonte da verdade do navegador) em vez
    // de confiar só no state/ref internos — evita que o clique seja
    // silenciosamente ignorado se o metadata ainda não tiver dado o evento
    // (comum em mobile, que só carrega metadata depois do 1º play).
    const dur = audio.duration && isFinite(audio.duration) ? audio.duration : duracaoRef.current;
    if (!dur) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = pct * dur;
    setTempoAtual(pct * dur);
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

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 px-2">
        <div className="relative flex h-7 cursor-pointer items-center justify-between" onClick={handleBarraClick}>
          {barras.map((altura, i) => {
            const passado = progresso > 0 && i / barras.length <= progresso;
            return (
              <div
                key={i}
                className="w-[2px] flex-shrink-0 rounded-full transition-colors duration-75"
                style={{ height: `${altura}px`, backgroundColor: passado ? '#3F2C1C' : '#D4C4B0' }}
              />
            );
          })}
          {duracao > 0 && (
            <div
              className="pointer-events-none absolute z-10 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-coffee-700"
              style={{ left: `${progresso * 100}%`, top: 'calc(50% + 6px)' }}
            />
          )}
        </div>
        <div className="flex justify-between text-[10px] text-coffee-400 mt-1.5">
          <span>{fmt(tempoAtual)}</span>
          <span>{fmt(duracao)}</span>
        </div>
      </div>

      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onDurationChange={handleLoadedMetadata}
        onEnded={handleEnded}
        preload="metadata"
        className="hidden"
      />
    </div>
  );
}
