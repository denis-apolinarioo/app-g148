'use client';

import { useCallback, useRef, useState } from 'react';
import { Play, Pause, Trash2 } from 'lucide-react';
import useAudioBars from '@/lib/useAudioBars';

// ============================================================================
// Player de áudio "oficial" do app — onda real + play/pause + arrastar pra
// buscar. Usado no Feed/perfil (post publicado), na prévia de gravação
// (AudioRecorderButton.js) e na tela de editar post (EditarPostModal.js) —
// um só componente pra não ter versões divergentes da mesma peça de UI.
//
// O progresso segue o áudio via eventos nativos do <audio>
// (onTimeUpdate/onLoadedMetadata/onEnded) — o <audio> fica escondido.
//
// `onExcluir`, se passado, mostra um botão de lixeira ao final (usado na
// prévia de gravação e ao trocar áudio na edição, pra descartar e gravar de
// novo). Sem essa prop, o player fica só leitura — é o caso do Feed.
//
// DUPLO TOQUE: sem onExcluir, este componente não gerencia o duplo toque. O
// pai (PostCard) envolve o player num div com onClick={handleDuploToque}, e
// os cliques em qualquer parte do player sobem normalmente pelo bubbling até
// esse div. O play e a barra NÃO chamam stopPropagation pra não bloquear
// esse bubbling.
// ============================================================================
export default function AudioPlayer({ src, className = '', onExcluir }) {
  const [tocando, setTocando] = useState(false);
  const [duracao, setDuracao] = useState(0);
  const [tempoAtual, setTempoAtual] = useState(0);
  const audioRef = useRef(null);
  const duracaoRef = useRef(0);
  const corrigindoDuracaoRef = useRef(false);
  const barraRef = useRef(null);
  const arrastandoRef = useRef(false);
  const inicioXRef = useRef(null);

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

  // Arrastar a bolinha (ou qualquer ponto da barra) pra escolher onde ouvir.
  // Feito com Pointer Events (funciona igual pra dedo e mouse) + pointer
  // capture, então o gesto continua sendo seguido mesmo que o dedo saia um
  // pouco da faixa da barra durante o arraste.
  const seekParaX = useCallback((clientX) => {
    const audio = audioRef.current;
    const barra = barraRef.current;
    if (!audio || !barra) return;
    // Lê a duração direto do elemento (fonte da verdade do navegador) em vez
    // de confiar só no state/ref internos — evita que o toque seja
    // silenciosamente ignorado se o metadata ainda não tiver dado o evento
    // (comum em mobile, que só carrega metadata depois do 1º play).
    const dur = audio.duration && isFinite(audio.duration) ? audio.duration : duracaoRef.current;
    if (!dur) return;
    const rect = barra.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    audio.currentTime = pct * dur;
    setTempoAtual(pct * dur);
  }, []);

  function handleBarraPointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    inicioXRef.current = e.clientX;
    arrastandoRef.current = false;
    seekParaX(e.clientX);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  function handleBarraPointerMove(e) {
    if (inicioXRef.current === null) return;
    // Só considera "arrastando" depois de um pequeno limiar de movimento,
    // pra um toque parado (tap normal) continuar se comportando como antes.
    if (!arrastandoRef.current && Math.abs(e.clientX - inicioXRef.current) > 3) {
      arrastandoRef.current = true;
    }
    if (arrastandoRef.current) {
      e.preventDefault();
      seekParaX(e.clientX);
    }
  }

  function handleBarraPointerUp() {
    inicioXRef.current = null;
  }

  // Um toque simples (sem arraste) já seekou no pointerDown acima e deve
  // continuar subindo pro post pra contar como parte do duplo toque de
  // curtir (ver comentário no topo do arquivo). Só quando o gesto foi
  // realmente um ARRASTE que a gente intercepta o clique sintético gerado
  // depois do pointerUp, pra ele não contar como um toque de curtir.
  function handleBarraClickCapture(e) {
    if (arrastandoRef.current) {
      e.stopPropagation();
      e.preventDefault();
    }
    arrastandoRef.current = false;
  }

  function fmt(s) {
    const t = Math.round(s || 0);
    return `${Math.floor(t / 60).toString().padStart(2, '0')}:${(t % 60).toString().padStart(2, '0')}`;
  }

  return (
    <div className={`flex items-center gap-5 ${className}`}>
      <button
        type="button"
        onClick={alternarPlay}
        aria-label={tocando ? 'Pausar áudio' : 'Tocar áudio'}
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-forte text-texto-forte shadow-sm"
      >
        {tocando ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" className="ml-0.5" />}
      </button>

      {/* Onda+bolinha ficam absolutas, travadas no centro vertical exato do
          player (h-11 aqui = mesma altura de referência pros dois; o botão
          continua com h-10 normal, só fica levemente dentro dessa faixa).
          Tempos ficam colados na base dessa mesma faixa, sem depender do
          fluxo normal — assim não competem por espaço com a onda. */}
      <div className="relative min-w-0 flex-1 h-14 px-2">
        <div
          ref={barraRef}
          data-swipe-ignore
          className="absolute inset-x-0 top-1/2 flex h-7 -translate-y-1/2 cursor-pointer items-center justify-between"
          style={{ touchAction: 'none' }}
          onPointerDown={handleBarraPointerDown}
          onPointerMove={handleBarraPointerMove}
          onPointerUp={handleBarraPointerUp}
          onPointerCancel={handleBarraPointerUp}
          onClickCapture={handleBarraClickCapture}
        >
          {barras.map((altura, i) => {
            const passado = progresso > 0 && i / barras.length <= progresso;
            return (
              <div
                key={i}
                className="w-[2px] flex-shrink-0 rounded-full transition-colors duration-75"
                style={{
                  height: `${altura}px`,
                  backgroundColor: passado ? 'rgb(var(--cor-coffee-700))' : 'rgb(var(--cor-coffee-200))',
                }}
              />
            );
          })}
          {duracao > 0 && (
            <div
              className="pointer-events-none absolute top-1/2 z-10 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-forte"
              style={{ left: `${progresso * 100}%` }}
            />
          )}
        </div>
        <div className="absolute inset-x-0 bottom-0 flex justify-between text-[10px] leading-none text-coffee-400">
          <span>{fmt(tempoAtual)}</span>
          <span>{fmt(duracao)}</span>
        </div>
      </div>

      {onExcluir && (
        <button
          type="button"
          onClick={onExcluir}
          className="flex-shrink-0 text-coffee-300 hover:text-red-600"
          aria-label="Excluir áudio"
        >
          <Trash2 size={16} />
        </button>
      )}

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
