'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Check, ZoomIn, ZoomOut } from 'lucide-react';

export default function ImageCropper({ src, razao: razaoInicial, onConfirmar, onCancelar, opcoes }) {
  const [razao, setRazao] = useState(razaoInicial || { w: 1, h: 1 });
  const [escala, setEscala] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [arrastando, setArrastando] = useState(false);
  const ultimoPonto = useRef(null);
  const distanciaInicial = useRef(null);
  const escalaInicial = useRef(1);
  const imgRef = useRef(null);
  const [processando, setProcessando] = useState(false);

  const JANELA_W = Math.min(typeof window !== 'undefined' ? window.innerWidth - 48 : 320, 360);
  const JANELA_H = Math.round((JANELA_W * razao.h) / razao.w);

  useEffect(() => {
    setPos({ x: 0, y: 0 });
    setEscala(1);
  }, [razao]);

  function aoIniciarToque(e) {
    if (e.touches.length === 2) {
      distanciaInicial.current = dist2(e.touches);
      escalaInicial.current = escala;
    } else {
      ultimoPonto.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      setArrastando(true);
    }
  }

  function aoMoverToque(e) {
    e.preventDefault();
    if (e.touches.length === 2 && distanciaInicial.current) {
      const novaEscala = Math.max(1, Math.min(5, escalaInicial.current * (dist2(e.touches) / distanciaInicial.current)));
      setEscala(novaEscala);
    } else if (e.touches.length === 1 && ultimoPonto.current) {
      const dx = e.touches[0].clientX - ultimoPonto.current.x;
      const dy = e.touches[0].clientY - ultimoPonto.current.y;
      moverPor(dx, dy);
      ultimoPonto.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }

  function aoSoltarToque() {
    ultimoPonto.current = null;
    distanciaInicial.current = null;
    setArrastando(false);
  }

  function aoIniciarMouse(e) {
    ultimoPonto.current = { x: e.clientX, y: e.clientY };
    setArrastando(true);
  }

  function aoMoverMouse(e) {
    if (!ultimoPonto.current) return;
    moverPor(e.clientX - ultimoPonto.current.x, e.clientY - ultimoPonto.current.y);
    ultimoPonto.current = { x: e.clientX, y: e.clientY };
  }

  function aoSoltarMouse() {
    ultimoPonto.current = null;
    setArrastando(false);
  }

  function moverPor(dx, dy) {
    setPos((p) => ({ x: p.x + dx, y: p.y + dy }));
  }

  function ajustarZoom(delta) {
    setEscala((s) => Math.max(1, Math.min(5, s + delta)));
  }

  const confirmar = useCallback(async () => {
    if (processando) return;
    setProcessando(true);
    try {
      const img = imgRef.current;
      if (!img) {
        setProcessando(false);
        return;
      }

      const canvas = document.createElement('canvas');
      const OUTPUT = 1080;
      const outW = razao.w >= razao.h ? Math.round(OUTPUT * razao.w / razao.h) : OUTPUT;
      const outH = razao.w >= razao.h ? OUTPUT : Math.round(OUTPUT * razao.h / razao.w);
      canvas.width = outW;
      canvas.height = outH;

      const ctx = canvas.getContext('2d');

      const escalaImg = Math.max(JANELA_W / img.naturalWidth, JANELA_H / img.naturalHeight);
      const imgExibidaW = img.naturalWidth * escalaImg * escala;
      const imgExibidaH = img.naturalHeight * escalaImg * escala;

      const origemX = (imgExibidaW - JANELA_W) / 2 - pos.x;
      const origemY = (imgExibidaH - JANELA_H) / 2 - pos.y;

      const srcX = origemX / (escalaImg * escala);
      const srcY = origemY / (escalaImg * escala);
      const srcW = JANELA_W / (escalaImg * escala);
      const srcH = JANELA_H / (escalaImg * escala);

      ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, outW, outH);

      canvas.toBlob(
        (blob) => {
          if (blob) onConfirmar(blob);
          setProcessando(false);
        },
        'image/jpeg',
        0.88
      );
    } catch (err) {
      console.error('Erro ao cortar imagem:', err);
      setProcessando(false);
    }
  }, [processando, razao, JANELA_W, JANELA_H, escala, pos, onConfirmar]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-black pb-8 pt-4">
      {/* Topo */}
      <div className="flex w-full items-center justify-between px-5">
        <button
          onClick={onCancelar}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white"
        >
          <X size={20} />
        </button>
        <span className="text-sm font-semibold text-white">Ajustar foto</span>
        <button
          onClick={confirmar}
          disabled={processando}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white disabled:opacity-40"
        >
          <Check size={20} />
        </button>
      </div>

      {/* Seletor de proporção */}
      {opcoes && (
        <div className="flex gap-2">
          {opcoes.map((op) => (
            <button
              key={op.label}
              onClick={() => setRazao({ w: op.w, h: op.h })}
              className={`rounded-full px-3.5 py-1 text-xs font-semibold ${
                razao.w === op.w && razao.h === op.h
                  ? 'bg-white text-black'
                  : 'bg-white/20 text-white'
              }`}
            >
              {op.label}
            </button>
          ))}
        </div>
      )}

      {/* Área de corte */}
      <div
        style={{ width: JANELA_W, height: JANELA_H }}
        className="relative overflow-hidden rounded-xl outline outline-2 outline-white/60 cursor-grab active:cursor-grabbing"
        onMouseDown={aoIniciarMouse}
        onMouseMove={aoMoverMouse}
        onMouseUp={aoSoltarMouse}
        onMouseLeave={aoSoltarMouse}
        onTouchStart={aoIniciarToque}
        onTouchMove={aoMoverToque}
        onTouchEnd={aoSoltarToque}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={src}
          alt="Cortar"
          draggable={false}
          crossOrigin="anonymous"
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px)) scale(${escala})`,
            transformOrigin: 'center',
            transition: arrastando ? 'none' : 'transform 0.1s',
            maxWidth: 'none',
            width: `${100 * escala}%`,
            objectFit: 'cover',
            userSelect: 'none',
            touchAction: 'none',
          }}
        />
      </div>

      {/* Controles de zoom */}
      <div className="flex items-center gap-5">
        <button
          onClick={() => ajustarZoom(-0.2)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white"
        >
          <ZoomOut size={18} />
        </button>
        <span className="w-12 text-center text-sm text-white/70">{Math.round(escala * 100)}%</span>
        <button
          onClick={() => ajustarZoom(0.2)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white"
        >
          <ZoomIn size={18} />
        </button>
      </div>
    </div>
  );
}

function dist2(toques) {
  return Math.hypot(
    toques[1].clientX - toques[0].clientX,
    toques[1].clientY - toques[0].clientY
  );
}
