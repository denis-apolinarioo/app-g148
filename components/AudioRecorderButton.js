'use client';

import { useRef, useState, useEffect } from 'react';
import { Mic, Square } from 'lucide-react';
import AudioPlayer from '@/components/AudioPlayer';

// A prévia do que foi gravado (depois de parar) usa o mesmo AudioPlayer.js
// do Feed — mesma onda real, play/pause e arrastar pra buscar — em vez de
// uma versão própria e mais simples só de tocar; só a lixeira de descartar
// (onExcluir) é extra, pra poder gravar de novo.
export default function AudioRecorderButton({ onGravado, onLimpar }) {
  const [gravando, setGravando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [audioURL, setAudioURL] = useState('');
  const [erro, setErro] = useState('');
  const [barras, setBarras] = useState(Array(28).fill(3));

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const intervalRef = useRef(null);
  const streamRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
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

      // Cadeia de volume: em vez de só multiplicar o ganho (o que estoura/
      // distorce qualquer parte que já tava alta), primeiro um COMPRESSOR
      // "nivela" a diferença entre trechos baixos e altos (aproxima o
      // volume dos dois sem cortar nada), depois um GANHO real levanta o
      // volume geral, e por fim um LIMITADOR (2º compressor, bem agressivo
      // e rápido) trava o teto pra garantir que nada estoure mesmo que
      // alguém grite ou bata no microfone — evita perder qualidade mesmo
      // com o áudio saindo mais alto.
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -30;
      compressor.knee.value = 12;
      compressor.ratio.value = 3;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.25;

      const ganho = ctx.createGain();
      ganho.gain.value = 1.8; // ~+5dB de reforço

      const limitador = ctx.createDynamicsCompressor();
      limitador.threshold.value = -1;
      limitador.knee.value = 0;
      limitador.ratio.value = 20;
      limitador.attack.value = 0.001;
      limitador.release.value = 0.1;

      const destino = ctx.createMediaStreamDestination();

      source.connect(compressor);
      compressor.connect(ganho);
      ganho.connect(limitador);
      limitador.connect(destino);

      // Barrinhas de volume durante a gravação lêem depois do processamento
      // (limitador), pra refletir o volume já reforçado que vai ser gravado.
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      limitador.connect(analyser);
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

      // Grava o stream JÁ PROCESSADO (destino.stream), não o stream cru do
      // microfone (`stream`) — é isso que aplica o reforço de volume no
      // arquivo final.
      const recorder = new MediaRecorder(destino.stream, opcoes);
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

  // A prévia (AudioPlayer) cuida do próprio <audio> internamente — aqui só
  // precisa zerar o que pertence à gravação em si.
  function limpar() {
    setAudioURL('');
    setSegundos(0);
    onLimpar?.();
  }

  function fmt(s) {
    const t = Math.round(s || 0);
    return `${Math.floor(t / 60).toString().padStart(2, '0')}:${(t % 60).toString().padStart(2, '0')}`;
  }

  if (audioURL) {
    return (
      <AudioPlayer
        src={audioURL}
        onExcluir={limpar}
        className="rounded-2xl border border-coffee-100 bg-cream-card px-4 py-2"
      />
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
          gravando ? 'bg-red-500' : 'bg-forte'
        } text-texto-forte shadow-sm`}>
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
