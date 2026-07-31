'use client';

import { useEffect, useState, useCallback } from 'react';

const CHAVE_STORAGE = 'g148_tema';

function aplicarTema(tema) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', tema === 'escuro');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', tema === 'escuro' ? '#17110B' : '#3F2C1C');
}

/**
 * Hook do modo claro/escuro. O tema inicial já foi aplicado por um script
 * embutido em app/layout.js, ANTES da 1ª pintura da tela (pra não piscar
 * claro->escuro ao abrir o app já preferindo escuro) — esse hook só lê o
 * que já está na tag <html> pra sincronizar o state do React, e cuida de
 * alternar/salvar a partir daí.
 */
export function useTema() {
  const [tema, setTema] = useState('claro');

  useEffect(() => {
    setTema(document.documentElement.classList.contains('dark') ? 'escuro' : 'claro');
  }, []);

  const alternar = useCallback(() => {
    setTema((atual) => {
      const novo = atual === 'escuro' ? 'claro' : 'escuro';
      aplicarTema(novo);
      try {
        window.localStorage.setItem(CHAVE_STORAGE, novo);
      } catch {
        // localStorage indisponível (ex.: aba anônima) — o tema ainda
        // funciona nessa sessão, só não fica lembrado na próxima.
      }
      return novo;
    });
  }, []);

  return [tema, alternar];
}
