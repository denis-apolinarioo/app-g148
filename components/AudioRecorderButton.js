'use client';

import { useRef, useState, useEffect } from 'react';
import { Mic, Square, Trash2, Play, Pause } from 'lucide-react';

/**
 * Gravador de áudio simples via MediaRecorder do navegador. Ao terminar,
 * chama `onGravado(blob)` com o áudio pronto. Formato webm/opus, que já
 * sai naturalmente leve (não precisa de compressão adicional).
 */
export default function AudioRecorderButton({ onGravado, onLimpar }) {
  const [gravando, setGravando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [audioURL, setAudioURL] = useState('');
  const [tocando, setTocando] = useState(false);
  const [erro, setErro] = useState('');

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const intervalRef = useRef(null);
  const audioRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    return () => {
      clearInterval(intervalRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function iniciarGravacao() {
    setErro('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioURL(URL.createObjectURL(blob));
        onGravado(blob);
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start();
      setGravando(true);
      setSegundos(0);
      intervalRef.current = setInterval(() => setSegundos((s) => s + 1), 1000);
    } catch (err) {
      console.error('Erro ao acessar o microfone:', err);
      setErro('Não conseguimos acessar o microfone. Verifique a permissão do navegador.');
    }
  }

  function pararGravacao() {
    mediaRecorderRef.current?.stop();
    clearInterval(intervalRef.current);
    setGravando(false);
  }

  function limpar() {
    setAudioURL('');
    setSegundos(0);
    onLimpar?.();
  }

  function alternarPlay() {
    if (!audioRef.current) return;
    if (tocando) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setTocando((v) => !v);
  }

  function formatarTempo(s) {
    const min = Math.floor(s / 60).toString().padStart(2, '0');
    const seg = (s % 60).toString().padStart(2, '0');
    return `${min}:${seg}`;
  }

  if (audioURL) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-coffee-100 bg-cream px-4 py-3">
        <button
          type="button"
          onClick={alternarPlay}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-coffee-700 text-cream"
        >
          {tocando ? <Pause size={15} /> : <Play size={15} className="ml-0.5" />}
        </button>
        <span className="flex-1 text-sm text-coffee-500">Áudio gravado · {formatarTempo(segundos)}</span>
        <button type="button" onClick={limpar} className="text-coffee-300 hover:text-red-700">
          <Trash2 size={16} />
        </button>
        <audio
          ref={audioRef}
          src={audioURL}
          onEnded={() => setTocando(false)}
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
        className={`flex w-full items-center justify-center gap-2.5 rounded-xl border py-3.5 text-sm font-semibold ${
          gravando
            ? 'border-red-200 bg-red-50 text-red-700'
            : 'border-coffee-100 bg-cream text-coffee-700'
        }`}
      >
        {gravando ? (
          <>
            <Square size={15} fill="currentColor" />
            Parar gravação · {formatarTempo(segundos)}
          </>
        ) : (
          <>
            <Mic size={17} />
            Gravar áudio
          </>
        )}
      </button>
      {erro && <p className="mt-2 text-xs text-red-700">{erro}</p>}
    </div>
  );
}
