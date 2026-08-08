'use client';

import { useEffect, useState, useCallback } from 'react';

const CHAVE_STORAGE = 'g148_tema';

function aplicarTema(tema) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', tema === 'escuro');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', tema === 'escuro' ? '#0D0906' : '#FAF6EF');
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
    const escuro = document.documentElement.classList.contains('dark');
    setTema(escuro ? 'escuro' : 'claro');
    // Corrige a barrinha de notificações caso ela ainda esteja com a cor
    // errada (ex.: script anti-flash de uma versão antiga em cache) —
    // sem isso, a cor só se acertava quando a pessoa clicava no toggle.
    aplicarTema(escuro ? 'escuro' : 'claro');
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

/**
 * Hook só-leitura do tema atual ('claro' | 'escuro') — pra componentes que
 * não mexem no tema, só precisam saber qual variante de cor mostrar (ex.:
 * ícones customizados em PNG, que não recebem cor automaticamente via
 * currentColor como os ícones de fonte/lib). Reage na hora se o tema for
 * trocado em outra parte da tela (aba Perfil), via MutationObserver na
 * classe `dark` do <html> — não precisa trocar de aba pra atualizar.
 */
export function useTemaAtual() {
  const [escuro, setEscuro] = useState(false);

  useEffect(() => {
    const atualizar = () => setEscuro(document.documentElement.classList.contains('dark'));
    atualizar();
    const observer = new MutationObserver(atualizar);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return escuro ? 'escuro' : 'claro';
}
