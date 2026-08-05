'use client';

import { useRef, useState, useEffect } from 'react';
import { Mic, Square, Trash2, Play, Pause } from 'lucide-react';
import useAudioBars from '@/lib/useAudioBars';

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
  // Espelha `segundos` (contador visível durante a gravação) num ref, pra
  // poder ler o valor exato assim que a gravação para (recorder.onstop) —
  // nesse momento o state `segundos` capturado no closure de
  // iniciarGravacao já pode estar desatualizado. Usado só pra mandar a
  // duração aproximada (em segundos inteiros) pra quem consome o áudio
  // (ex.: conquistas que exigem duração mínima de áudio).
  const segundosRef = useRef(0);
  // CORREÇÃO DE VAZAMENTO: o AudioContext (usado só pra animar as
  // barrinhas de volume) nunca era fechado — cada gravação criava um novo
  // e o navegador tem um limite de contextos simultâneos por aba. Guardado
  // aqui pra poder chamar ctx.close() assim que a gravação parar (ou se o
  // componente desmontar no meio de uma gravação).
  const audioCtxRef = useRef(null);

  // Barras da PRÉVIA (depois de gravado, ao dar play pra conferir) reagindo
  // ao som de verdade — diferente das `barras` acima, que reagem ao
  // microfone durante a gravação em si. Parada, mostra a forma de onda
  // real do que foi gravado (audioURL é um blob: local, mesma origem —
  // não depende do CORS do Storage).
  const barrasPlayback = useAudioBars(audioRef, tocando, audioURL);

  useEffect(() => {
    return () => {
      clearInterval(intervalRef.current);
      cancelAnimationFrame(animFrameRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  // CORREÇÃO DE VAZAMENTO: a prévia gravada (audioURL, um blob: local)
  // nunca era revogada — ficava viva na memória mesmo depois de descartar
  // a gravação ou fechar a tela. Revoga a URL anterior sempre que ela é
  // trocada (nova gravação ou "limpar") e também ao desmontar.
  useEffect(() => {
    return () => {
      if (audioURL) URL.revokeObjectURL(audioURL);
    };
  }, [audioURL]);

  function animarBarras() {
    if (!analyserRef.current) return;
    const data = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(data);
    const novas = Array.from({ length: 28 }, (_, i) => {
      const val = data[Math.floor((i / 28) * analyserRef.current.frequencyBinCount)] || 0;
      return Math.max(3, Math.round((val / 255) * 28));
    });
    setBarras(novas);
    animFrameRef.current = requestAnimationFrame(animarBarras);
  }

  async function iniciarGravacao() {
    setErro('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          // Sem filtros = som limpo, sem distorção em voz nem música
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 2, // estéreo — necessário pra música soar bem
        },
      });
      streamRef.current = stream;

      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      animFrameRef.current = requestAnimationFrame(animarBarras);

      const formatos = [
        'audio/webm;codecs=opus',
        'audio/ogg;codecs=opus',
        'audio/webm',
      ];
      const mimeType = formatos.find((f) => MediaRecorder.isTypeSupported(f)) || '';

      // 64kbps estéreo Opus = qualidade de música excelente + arquivo leve
      // 1 min ≈ 480KB (era 1.9MB com 256kbps — 4x menor, qualidade igual)
      const opcoes = { audioBitsPerSecond: 64000 };
      if (mimeType) opcoes.mimeType = mimeType;

      const recorder = new MediaRecorder(stream, opcoes);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const tipo = mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: tipo });
        setAudioURL(URL.createObjectURL(blob));
        onGravado(blob, segundosRef.current);
        stream.getTracks().forEach((t) => t.stop());
        cancelAnimationFrame(animFrameRef.current);
        setBarras(Array(28).fill(3));
        // Já animou as barrinhas o que precisava — fecha o AudioContext
        // pra não acumular um por gravação enquanto a tela ficar aberta.
        audioCtxRef.current?.close().catch(() => {});
        audioCtxRef.current = null;
      };

      recorder.start(200);
      setGravando(true);
      setSegundos(0);
      segundosRef.current = 0;
      intervalRef.current = setInterval(() => {
        segundosRef.current += 1;
        setSegundos(segundosRef.current);
      }, 1000);
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
    setTempoAtual(audioRef.current.currentTime);
    if (duracaoRef.current > 0)
      setProgresso(audioRef.current.currentTime / duracaoRef.current);
  }

  function handleLoadedMetadata() {
    if (!audioRef.current) return;
    const dur = audioRef.current.duration;
    const durFinal = dur && isFinite(dur) ? dur : segundos;
    duracaoRef.current = durFinal;
    setDuracao(durFinal);
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
    const t = Math.round(s || 0);
    return `${Math.floor(t / 60).toString().padStart(2, '0')}:${(t % 60).toString().padStart(2, '0')}`;
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
            {barrasPlayback.map((altura, i) => {
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
          crossOrigin="anonymous"
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
