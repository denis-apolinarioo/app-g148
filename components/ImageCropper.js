'use client';

// ============================================================================
// Tela de corte de imagem — usada tanto na troca de foto de perfil (1:1 fixo)
// quanto no post com foto (1:1 / 4:5 / 3:4, escolhido pelo usuário).
//
// CORREÇÃO DE BUG (memória cheia / app reiniciando ao tirar foto): fotos de
// câmera de celular moderno podem chegar com 12-50MP (20-50MB descomprimida
// em memória). Manipular isso direto num <canvas> a cada arraste/zoom explode
// a memória e o navegador mata a aba. A correção: assim que a imagem chega,
// ela é redesenhada UMA VEZ num canvas de trabalho limitado a no máximo
// 1600px no lado maior — é nessa versão "leve" que todo o corte/zoom/arraste
// acontece. O resultado final do corte também sai desse canvas já reduzido.
// ============================================================================

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Check, ZoomIn, ZoomOut } from 'lucide-react';

const LADO_MAXIMO_TRABALHO = 1600; // limite de segurança pra não estourar memória

export default function ImageCropper({ src, razao, opcoes, onConfirmar, onCancelar }) {
  const [prontoParaCortar, setProntoParaCortar] = useState(false);
  const [erro, setErro] = useState('');
  const [razaoAtual, setRazaoAtual] = useState(razao || { w: 1, h: 1 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [processando, setProcessando] = useState(false);

  const workingCanvasRef = useRef(null); // canvas escondido com a imagem já reduzida
  const frameRef = useRef(null); // moldura visível (a "janela" de corte)

  const arrastandoRef = useRef(false);
  const ultimoPonteiroRef = useRef({ x: 0, y: 0 });
  const pinchRef = useRef(null); // distância inicial entre 2 dedos

  const frameWRef = useRef(0);
  const frameHRef = useRef(0);
  const escalaBaseRef = useRef(1); // escala mínima pra imagem cobrir a moldura

  // --------------------------------------------------------------------
  // 1) Reduz a imagem original pra um tamanho seguro de trabalho
  // --------------------------------------------------------------------
  useEffect(() => {
    let cancelado = false;
    setProntoParaCortar(false);
    setErro('');

    const img = new Image();
    img.onload = () => {
      if (cancelado) return;
      let { width, height } = img;

      if (width > LADO_MAXIMO_TRABALHO || height > LADO_MAXIMO_TRABALHO) {
        if (width > height) {
          height = Math.round((height * LADO_MAXIMO_TRABALHO) / width);
          width = LADO_MAXIMO_TRABALHO;
        } else {
          width = Math.round((width * LADO_MAXIMO_TRABALHO) / height);
          height = LADO_MAXIMO_TRABALHO;
        }
      }

      const canvas = workingCanvasRef.current;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setProntoParaCortar(true);
    };
    img.onerror = () => {
      if (!cancelado) setErro('Não foi possível abrir essa imagem.');
    };
    img.src = src;

    return () => {
      cancelado = true;
    };
  }, [src]);

  // --------------------------------------------------------------------
  // 2) Calcula o tamanho da moldura de corte (proporção atual) e a escala
  //    mínima pra imagem cobrir a moldura inteira (sem sobrar vazio)
  // --------------------------------------------------------------------
  const recalcularEscalaBase = useCallback(() => {
    const canvas = workingCanvasRef.current;
    if (!canvas.width || !canvas.height) return;

    const larguraTela = Math.min(window.innerWidth, 480) - 32; // padding lateral
    const frameW = larguraTela;
    const frameH = (frameW * razaoAtual.h) / razaoAtual.w;

    frameWRef.current = frameW;
    frameHRef.current = frameH;

    const escala = Math.max(frameW / canvas.width, frameH / canvas.height);
    escalaBaseRef.current = escala;
  }, [razaoAtual]);

  useEffect(() => {
    if (!prontoParaCortar) return;
    recalcularEscalaBase();
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, [prontoParaCortar, razaoAtual, recalcularEscalaBase]);

  // --------------------------------------------------------------------
  // 3) Mantém a imagem sempre cobrindo a moldura (clamp do offset)
  // --------------------------------------------------------------------
  const clampOffset = useCallback((desejado, zoomAtual) => {
    const canvas = workingCanvasRef.current;
    const escala = escalaBaseRef.current * zoomAtual;
    const imgWNaTela = canvas.width * escala;
    const imgHNaTela = canvas.height * escala;

    const limiteX = Math.max(0, (imgWNaTela - frameWRef.current) / 2);
    const limiteY = Math.max(0, (imgHNaTela - frameHRef.current) / 2);

    return {
      x: Math.min(limiteX, Math.max(-limiteX, desejado.x)),
      y: Math.min(limiteY, Math.max(-limiteY, desejado.y)),
    };
  }, []);

  function aplicarZoom(novoZoom) {
    const zoomClampado = Math.min(3, Math.max(1, novoZoom));
    setZoom(zoomClampado);
    setOffset((atual) => clampOffset(atual, zoomClampado));
  }

  // --------------------------------------------------------------------
  // 4) Arrastar (mouse/touch) e pinça (2 dedos) pra zoom
  // --------------------------------------------------------------------
  function distanciaEntreToques(toques) {
    const dx = toques[0].clientX - toques[1].clientX;
    const dy = toques[0].clientY - toques[1].clientY;
    return Math.hypot(dx, dy);
  }

  function handlePointerDown(e) {
    if (e.touches && e.touches.length === 2) {
      pinchRef.current = distanciaEntreToques(e.touches);
      return;
    }
    arrastandoRef.current = true;
    const ponto = e.touches ? e.touches[0] : e;
    ultimoPonteiroRef.current = { x: ponto.clientX, y: ponto.clientY };
  }

  function handlePointerMove(e) {
    if (e.touches && e.touches.length === 2) {
      if (pinchRef.current == null) {
        pinchRef.current = distanciaEntreToques(e.touches);
        return;
      }
      const distanciaAtual = distanciaEntreToques(e.touches);
      const fator = distanciaAtual / pinchRef.current;
      pinchRef.current = distanciaAtual;
      aplicarZoom(zoom * fator);
      return;
    }

    if (!arrastandoRef.current) return;
    const ponto = e.touches ? e.touches[0] : e;
    const dx = ponto.clientX - ultimoPonteiroRef.current.x;
    const dy = ponto.clientY - ultimoPonteiroRef.current.y;
    ultimoPonteiroRef.current = { x: ponto.clientX, y: ponto.clientY };

    setOffset((atual) => clampOffset({ x: atual.x + dx, y: atual.y + dy }, zoom));
  }

  function handlePointerUp() {
    arrastandoRef.current = false;
    pinchRef.current = null;
  }

  // --------------------------------------------------------------------
  // 5) Confirmar corte: desenha a área visível da moldura num canvas final
  // --------------------------------------------------------------------
  function handleConfirmar() {
    if (processando) return;
    setProcessando(true);

    try {
      const canvasOrigem = workingCanvasRef.current;
      const escala = escalaBaseRef.current * zoom;

      // Canto superior-esquerdo da moldura, em pixels da imagem original (reduzida)
      const centroXImg = canvasOrigem.width / 2 - offset.x / escala;
      const centroYImg = canvasOrigem.height / 2 - offset.y / escala;
      const larguraRecorteImg = frameWRef.current / escala;
      const alturaRecorteImg = frameHRef.current / escala;

      const saidaW = Math.round(Math.min(frameWRef.current * 2, larguraRecorteImg));
      const saidaH = Math.round((saidaW * razaoAtual.h) / razaoAtual.w);

      const canvasSaida = document.createElement('canvas');
      canvasSaida.width = saidaW;
      canvasSaida.height = saidaH;
      const ctx = canvasSaida.getContext('2d');

      ctx.drawImage(
        canvasOrigem,
        centroXImg - larguraRecorteImg / 2,
        centroYImg - alturaRecorteImg / 2,
        larguraRecorteImg,
        alturaRecorteImg,
        0,
        0,
        saidaW,
        saidaH
      );

      canvasSaida.toBlob(
        (blob) => {
          setProcessando(false);
          if (!blob) {
            setErro('Não foi possível processar o corte. Tente novamente.');
            return;
          }
          onConfirmar(blob);
        },
        'image/jpeg',
        0.9
      );
    } catch (err) {
      console.error('Erro ao cortar imagem:', err);
      setProcessando(false);
      setErro('Não foi possível processar o corte. Tente novamente.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-coffee-900">
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={onCancelar} className="rounded-full p-2 text-cream/80">
          <X size={22} />
        </button>
        <span className="text-sm font-medium text-cream/90">Ajustar foto</span>
        <button
          onClick={handleConfirmar}
          disabled={!prontoParaCortar || processando}
          className="flex items-center gap-1.5 rounded-full bg-coffee-700 px-4 py-1.5 text-sm font-semibold text-cream disabled:opacity-40"
        >
          <Check size={16} />
          Usar foto
        </button>
      </div>

      <div className="flex flex-1 items-center justify-center overflow-hidden px-4">
        {erro ? (
          <p className="text-sm text-cream/80">{erro}</p>
        ) : (
          <div
            ref={frameRef}
            className="relative touch-none overflow-hidden rounded-lg bg-black/40"
            style={{ width: frameWRef.current || '100%', height: frameHRef.current || 300 }}
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
            onTouchStart={handlePointerDown}
            onTouchMove={handlePointerMove}
            onTouchEnd={handlePointerUp}
          >
            {prontoParaCortar && (
              <img
                src={workingCanvasRef.current?.toDataURL('image/jpeg', 0.85)}
                alt="Prévia para corte"
                draggable={false}
                className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
                style={{
                  width: workingCanvasRef.current.width * escalaBaseRef.current * zoom,
                  height: workingCanvasRef.current.height * escalaBaseRef.current * zoom,
                  transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`,
                }}
              />
            )}
          </div>
        )}
        {/* canvas de trabalho fica escondido — só serve pra reduzir a imagem original com segurança */}
        <canvas ref={workingCanvasRef} className="hidden" />
      </div>

      <div className="space-y-4 px-5 pb-6 pt-2">
        {opcoes && opcoes.length > 0 && (
          <div className="flex justify-center gap-2">
            {opcoes.map((op) => (
              <button
                key={op.label}
                onClick={() => setRazaoAtual({ w: op.w, h: op.h })}
                className={
                  'rounded-full border px-3.5 py-1.5 text-xs font-medium ' +
                  (razaoAtual.w === op.w && razaoAtual.h === op.h
                    ? 'border-cream bg-cream text-coffee-800'
                    : 'border-cream/30 text-cream/70')
                }
              >
                {op.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => aplicarZoom(zoom - 0.2)}
            className="rounded-full bg-cream/10 p-2 text-cream"
          >
            <ZoomOut size={18} />
          </button>
          <input
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={zoom}
            onChange={(e) => aplicarZoom(parseFloat(e.target.value))}
            className="w-40"
          />
          <button
            onClick={() => aplicarZoom(zoom + 0.2)}
            className="rounded-full bg-cream/10 p-2 text-cream"
          >
            <ZoomIn size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
