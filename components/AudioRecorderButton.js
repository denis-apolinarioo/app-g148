'use client';

import { useRef, useState, useEffect } from 'react';
import { Mic, Square, Trash2, Play, Pause } from 'lucide-react';

export default function AudioRecorderButton({ onGravado, onLimpar }) {
  const [gravando, setGravando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [audioURL, setAudioURL] = useState('');
  const [duracao, setDuracao] = useState(0);
  const [progresso, setProgresso] = useState(0);
  const [tocando, setTocando] = useState(false);
  const [erro, setErro] = useState('');
  const [barras, setBarras] = useState(Array(28).fill(3));
  const [tempoAtual, setTempoAtual] = useState(0);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const intervalRef = useRef(null);
  const audioRef = useRef(null);
  const streamRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const duracaoRef = useRef(0);

  useEffect(() => {
    return () => {
      clearInterval(intervalRef.current);
      cancelAnimationFrame(animFrameRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function animarBarras() {
    if (!analyserRef.current) return;
    const data = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(data);
    const total = 28;
    const step = Math.floor(data.length / total);
    const novas = Array.from({ length: total }, (_, i) => {
      const val = data[i * step] || 0;
      return Math.max(3, Math.round((val / 255) * 28));
    });
    setBarras(novas);
    animFrameRef.current = requestAnimationFrame(animarBarras);
  }

  async function iniciarGravacao() {
    setErro('');
    try {
      // 48kHz é o padrão do Opus — melhor qualidade de voz possível no browser
      // autoGainControl normaliza volume, echoCancellation e noiseSuppression
      // limpam o áudio na captura, antes de gravar
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1, // mono — voz não precisa de estéreo
        },
      });
      streamRef.current = stream;

      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      animFrameRef.current = requestAnimationFrame(animarBarras);

      // Opus 64kbps: qualidade de voz excelente, arquivo pequeno
      // (1 minuto de áudio ≈ ~480KB — comparado a MP3 que seria ~1MB)
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
        ? 'audio/ogg;codecs=opus'
        : 'audio/webm';

      const recorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 64000, // 64kbps — qualidade de voz premium
      });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setAudioURL(url);
        onGravado(blob);
        stream.getTracks().forEach((t) => t.stop());
        cancelAnimationFrame(animFrameRef.current);
        setBarras(Array(28).fill(3));
      };

      recorder.start(200);
      setGravando(true);
      setSegundos(0);
      intervalRef.current = setInterval(() => setSegundos((s) => s + 1), 1000);
    } catch {
      setErro('Não conseguimos acessar o microfone. Verifique a permissão do navegador.');
    }
  }

  function pararGravacao() {
    mediaRecorderRef.current?.stop();
    clearInterval(intervalRef.current);
    setGravando(false);
  }

  function limpar() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    setAudioURL('');
    setSegundos(0);
    setProgresso(0);
    setDuracao(0);
    setTempoAtual(0);
    setTocando(false);
    duracaoRef.current = 0;
    onLimpar?.();
  }

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
    const atual = audioRef.current.currentTime;
    const dur = duracaoRef.current;
    setTempoAtual(atual);
    if (dur > 0) setProgresso(atual / dur);
  }

  function handleLoadedMetadata() {
    if (!audioRef.current) return;
    // Bug fix: alguns browsers reportam Infinity na duração com webm/opus
    // Solução: aguarda o áudio carregar e usa o currentTime para forçar a leitura
    const dur = audioRef.current.duration;
    if (dur && isFinite(dur)) {
      duracaoRef.current = dur;
      setDuracao(dur);
    } else {
      // Fallback: usa os segundos gravados
      duracaoRef.current = segundos;
      setDuracao(segundos);
    }
    // Garante que a barrinha começa do zero
    audioRef.current.currentTime = 0;
    setProgresso(0);
    setTempoAtual(0);
  }

  function handleEnded() {
    setTocando(false);
    setProgresso(0);
    setTempoAtual(0);
    if (audioRef.current) audioRef.current.currentTime = 0;
  }

  function handleBarraClick(e) {
    if (!audioRef.current || !duracaoRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audioRef.current.currentTime = pct * duracaoRef.current;
    setProgresso(pct);
    setTempoAtual(pct * duracaoRef.current);
  }

  function fmt(s) {
    const total = Math.round(s || 0);
    return `${Math.floor(total / 60).toString().padStart(2, '0')}:${(total % 60).toString().padStart(2, '0')}`;
  }

  if (audioURL) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-coffee-100 bg-cream-card px-4 py-3">
        <button
          type="button"
          onClick={alternarPlay}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-coffee-700 text-cream shadow-sm"
        >
          {tocando
            ? <Pause size={15} fill="currentColor" />
            : <Play size={15} fill="currentColor" className="ml-0.5" />}
        </button>

        <div className="flex flex-1 flex-col gap-1.5 min-w-0">
          <div
            className="flex items-end gap-[2px] h-7 cursor-pointer"
            onClick={handleBarraClick}
          >
            {Array(28).fill(0).map((_, i) => {
              const altura = 3 + Math.round(
                Math.sin((i / 27) * Math.PI) * 18 +
                Math.sin((i / 7) * Math.PI) * 6
              );
              const passado = progresso > 0 && i / 28 <= progresso;
              return (
                <div
                  key={i}
                  className="flex-1 rounded-full transition-colors duration-75"
                  style={{
                    height: `${altura}px`,
                    backgroundColor: passado ? '#3F2C1C' : '#D4C4B0',
                  }}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] text-coffee-400">
            <span>{fmt(tempoAtual)}</span>
            <span>{fmt(duracao || segundos)}</span>
          </div>
        </div>

        <button type="button" onClick={limpar} className="text-coffee-300 hover:text-red-600 flex-shrink-0">
          <Trash2 size={16} />
        </button>

        <audio
          ref={audioRef}
          src={audioURL}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
          preload="metadata"
          className="hidden"
        />
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={gravando ? pararGravacao : iniciarGravacao}
        className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 ${
          gravando ? 'border-red-200 bg-red-50' : 'border-coffee-100 bg-cream-card'
        }`}
      >
        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${
          gravando ? 'bg-red-500' : 'bg-coffee-700'
        } text-cream shadow-sm`}>
          {gravando ? <Square size={13} fill="currentColor" /> : <Mic size={17} />}
        </div>

        {gravando ? (
          <div className="flex flex-1 items-end gap-[2px] h-7">
            {barras.map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-full bg-red-400 transition-all duration-75"
                style={{ height: `${h}px` }}
              />
            ))}
          </div>
        ) : (
          <span className="flex-1 text-sm font-medium text-coffee-600">Gravar áudio</span>
        )}

        <span className={`text-sm font-semibold flex-shrink-0 ${gravando ? 'text-red-600' : 'text-coffee-400'}`}>
          {fmt(segundos)}
        </span>
      </button>
      {erro && <p className="mt-2 text-xs text-red-700">{erro}</p>}
    </div>
  );
}
