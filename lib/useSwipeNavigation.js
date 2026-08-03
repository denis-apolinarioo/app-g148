'use client';

import { useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ABAS_PRINCIPAIS } from './constants';

// Distância mínima pra contar como swipe de verdade (e não um toque tremido
// ou o início de um scroll vertical). Usa o menor entre um valor fixo em px
// e uma fração da largura da tela, pra funcionar igual em celular pequeno e
// grande.
const LIMIAR_PX = 70;
const LIMIAR_PROPORCAO_TELA = 0.25;

// O gesto precisa ser CLARAMENTE mais horizontal que vertical. Isso é o que
// evita que rolar o Feed pra cima/baixo dispare uma troca de aba sem querer.
const RAZAO_MINIMA_HORIZONTAL = 1.4;

/**
 * Hook de navegação por arrastar entre as ABAS_PRINCIPAIS (mesma ordem da
 * BottomNav). Devolve handlers pra colocar no elemento que envolve o
 * conteúdo da página (ver app/(app)/layout.js).
 *
 * REGRAS DE PRIORIDADE (pedido do Denis): se o toque começar dentro de um
 * elemento marcado com o atributo `data-swipe-ignore` (ex.: o visualizador
 * de foto em tela cheia, que já tem pinça/zoom/pan próprios — ver
 * components/ImageViewerModal.js — ou qualquer carrossel futuro), esse
 * gesto é 100% ignorado aqui: quem arrasta por natureza sempre ganha.
 *
 * Só ativa em telas de nível principal (pathname bate exatamente com uma
 * das ABAS_PRINCIPAIS) — dentro de detalhe de post, Admin, Correio, Carteira
 * etc. o swipe fica desligado, pra não competir com o "voltar" nativo nem
 * confundir quem tá numa tela de drill-down.
 */
export function useSwipeNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const gesto = useRef({ x0: 0, y0: 0, ativo: false });

  const indiceAtual = ABAS_PRINCIPAIS.findIndex((aba) => aba.href === pathname);
  const dentroDeAbaPrincipal = indiceAtual !== -1;

  const aoIniciar = useCallback(
    (e) => {
      if (!dentroDeAbaPrincipal || e.touches.length !== 1) {
        gesto.current.ativo = false;
        return;
      }
      // Prioridade pra quem arrasta por natureza (ver comentário acima).
      const alvoComPrioridade = e.target.closest('[data-swipe-ignore]');
      gesto.current = {
        x0: e.touches[0].clientX,
        y0: e.touches[0].clientY,
        ativo: !alvoComPrioridade,
      };
    },
    [dentroDeAbaPrincipal]
  );

  // Não faz nada durante o movimento (sem preventDefault, sem arrastar visual
  // junto do dedo) — de propósito: assim o scroll vertical nativo do feed
  // continua liso, sem nenhuma interferência enquanto a pessoa só rola a
  // tela. Toda a decisão acontece de uma vez no soltar o dedo.
  const aoMover = useCallback(() => {}, []);

  const aoSoltar = useCallback(
    (e) => {
      if (!gesto.current.ativo || !dentroDeAbaPrincipal) return;
      gesto.current.ativo = false;

      const toqueFinal = e.changedTouches[0];
      if (!toqueFinal) return;

      const dx = toqueFinal.clientX - gesto.current.x0;
      const dy = toqueFinal.clientY - gesto.current.y0;

      const distanciaMinima = Math.min(LIMIAR_PX, window.innerWidth * LIMIAR_PROPORCAO_TELA);
      if (Math.abs(dx) < distanciaMinima) return;
      if (Math.abs(dx) < Math.abs(dy) * RAZAO_MINIMA_HORIZONTAL) return;

      // Arrastou pra ESQUERDA (dx negativo) → avança pra próxima aba.
      // Arrastou pra DIREITA (dx positivo) → volta pra aba anterior.
      const proximoIndice = dx < 0 ? indiceAtual + 1 : indiceAtual - 1;
      const proximaAba = ABAS_PRINCIPAIS[proximoIndice];
      if (proximaAba) router.push(proximaAba.href);
    },
    [dentroDeAbaPrincipal, indiceAtual, router]
  );

  return { onTouchStart: aoIniciar, onTouchMove: aoMover, onTouchEnd: aoSoltar };
}
