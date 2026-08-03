'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { getCachedImageURL } from '@/lib/imageCache';

const ESCALA_MIN = 1;
const ESCALA_MAX = 4;

/**
 * Visualizador de foto em tela cheia.
 * - Clicar fora da foto ou no X fecha.
 * - Pinça com dois dedos dá zoom (até 4x).
 * - Com zoom aplicado, arrastar com um dedo movimenta a foto (pan).
 * - Duplo clique/toque alterna entre 1x e 2x (atalho útil no desktop).
 * - Esc fecha (desktop).
 */
export default function ImageViewerModal({ src, alt = 'Foto', onClose }) {
  const [escala, setEscala] = useState(1);
  const [posicao, setPosicao] = useState({ x: 0, y: 0 });
  const gesto = useRef({ distanciaInicial: 0, escalaInicial: 1, ultimoToque: null });

  // Alguns chamadores (ex.: PostCard) já passam uma URL local (blob:) que
  // veio do cache de imagens. Outros (ex.: foto de perfil em tela cheia,
  // foto do Correio) ainda passam a URL original do Firebase Storage —
  // essas passam pelo cache aqui, pra também ficarem salvas em disco e não
  // baixar de novo toda vez que a pessoa abrir a foto.
  const [srcCacheado, setSrcCacheado] = useState('');
  useEffect(() => {
    if (!src || src.startsWith('blob:') || src.startsWith('data:')) {
      setSrcCacheado('');
      return undefined;
    }
    let cancelado = false;
    getCachedImageURL(src).then((url) => {
      if (!cancelado) setSrcCacheado(url);
    });
    return () => {
      cancelado = true;
    };
  }, [src]);
  const srcFinal = srcCacheado || src;

  // Trava o scroll da página por trás enquanto o visualizador está aberto.
  useEffect(() => {
    const overflowOriginal = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflowOriginal;
    };
  }, []);

  useEffect(() => {
    function aoTeclar(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onClose]);

  function distanciaEntreToques(toques) {
    const [a, b] = toques;
    return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
  }

  function aoIniciarToque(e) {
    if (e.touches.length === 2) {
      gesto.current.distanciaInicial = distanciaEntreToques(e.touches);
      gesto.current.escalaInicial = escala;
    } else if (e.touches.length === 1 && escala > 1) {
      gesto.current.ultimoToque = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }

  function aoMoverToque(e) {
    if (e.touches.length === 2) {
      e.preventDefault();
      const distanciaAtual = distanciaEntreToques(e.touches);
      const fator = distanciaAtual / (gesto.current.distanciaInicial || distanciaAtual);
      const novaEscala = Math.min(
        ESCALA_MAX,
        Math.max(ESCALA_MIN, gesto.current.escalaInicial * fator)
      );
      setEscala(novaEscala);
      if (novaEscala <= 1) setPosicao({ x: 0, y: 0 });
    } else if (e.touches.length === 1 && escala > 1 && gesto.current.ultimoToque) {
      e.preventDefault();
      const dx = e.touches[0].clientX - gesto.current.ultimoToque.x;
      const dy = e.touches[0].clientY - gesto.current.ultimoToque.y;
      setPosicao((p) => ({ x: p.x + dx, y: p.y + dy }));
      gesto.current.ultimoToque = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }

  function aoFinalizarToque(e) {
    if (e.touches.length === 0) {
      gesto.current.ultimoToque = null;
      if (escala < 1.05) {
        setEscala(1);
        setPosicao({ x: 0, y: 0 });
      }
    }
  }

  function aoDarDuploClique() {
    if (escala > 1) {
      setEscala(1);
      setPosicao({ x: 0, y: 0 });
    } else {
      setEscala(2);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={onClose}
      // Tem pinça/zoom/pan próprios (ver aoIniciarToque/aoMoverToque acima).
      // Isso avisa o useSwipeNavigation (troca de aba arrastando a tela) pra
      // nunca disputar gesto com esse visualizador — quem arrasta por
      // natureza tem prioridade.
      data-swipe-ignore
    >
      <button
        onClick={onClose}
        aria-label="Fechar"
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white active:bg-black/70"
      >
        <X size={22} />
      </button>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={srcFinal}
        alt={alt}
        draggable={false}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={aoDarDuploClique}
        onTouchStart={aoIniciarToque}
        onTouchMove={aoMoverToque}
        onTouchEnd={aoFinalizarToque}
        style={{
          transform: `translate(${posicao.x}px, ${posicao.y}px) scale(${escala})`,
          transition: gesto.current.ultimoToque ? 'none' : 'transform 0.15s ease-out',
        }}
        className="max-h-[92vh] max-w-[94vw] touch-none select-none object-contain"
      />
    </div>
  );
}
