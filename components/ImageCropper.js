'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Check, ZoomIn, ZoomOut } from 'lucide-react';

/**
 * Tela de corte de imagem com arrastar e zoom.
 * Props:
 *   src        — URL ou blob URL da imagem original
 *   razao      — objeto { w, h } ex: {w:1,h:1} para 1:1, {w:4,h:5} para 4:5
 *   onConfirmar(blob) — chamado com o Blob da imagem cortada
 *   onCancelar — fecha sem fazer nada
 *   opcoes     — array de { label, w, h } — se passado, mostra seletor de proporção
 */
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

  // Tamanho da janela de corte na tela
  const JANELA_W = Math.min(typeof window !== 'undefined' ? window.innerWidth - 48 : 320, 360);
  const JANELA_H = Math.round((JANELA_W * razao.h) / razao.w);

  // Centraliza sempre que razão muda
  useEffect(() => {
    setPos({ x: 0, y: 0 });
    setEscala(1);
  }, [razao]);

  // ── Toque ──────────────────────────────────────────────────────────────────
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

  // ── Mouse (desktop) ────────────────────────────────────────────────────────
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

  // ── Zoom pelos botões ──────────────────────────────────────────────────────
  function ajustarZoom(delta) {
    setEscala((s) => Math.max(1, Math.min(5, s + delta)));
  }

  // ── Cortar e gerar blob ────────────────────────────────────────────────────
  const confirmar = useCallback(async () => {
    if (processando) return;
    setProcessando(true);
    try {
      const img = imgRef.current;
      if (!img) return;

      const canvas = document.createElement('canvas');
      const OUTPUT = 1080; // sempre exporta em 1080px no lado menor
      const outW = razao.w >= razao.h ? Math.round(OUTPUT * razao.w / razao.h) : OUTPUT;
      const outH = razao.w >= razao.h ? OUTPUT : Math.round(OUTPUT * razao.h / razao.w);
      canvas.width = outW;
      canvas.height = outH;

      const ctx = canvas.getContext('2d');

      // Calcula o quanto da imagem real cabe na janela de corte
      const escalaImg = Math.max(JANELA_W / img.naturalWidth, JANELA_H / img.naturalHeight);
      const imgExibidaW = img.naturalWidth * escalaImg * escala;
      const imgExibidaH = img.naturalHeight * escalaImg * escala;

      // Offset da imagem em relação ao centro da janela
      const origemX = (imgExibidaW - JANELA_W) / 2 - pos.x;
      const origemY = (imgExibidaH - JANELA_H) / 2 - pos.y;

      // Converte para coordenadas na imagem original
      const srcX = origemX / (escalaImg * escala);
      const srcY = origemY / (escalaImg * escala);
      const srcW = JANELA_W / (escalaImg * escala);
      const srcH = JANELA_H / (escalaImg * escala);

      ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, outW, outH);

      canvas.toBlob(
        (blob) => {
          if (blob) onConfirmar(blob);
