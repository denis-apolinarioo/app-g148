'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';

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

/**
 * Resincroniza a barrinha de notificações (meta theme-color) a cada troca
 * de rota. Causa raiz do bug "fica branca ao sair do Perfil": o Next.js
 * reaplica a metadata estática da página (viewport.themeColor, sempre o
 * valor claro) toda vez que navega entre as abas — sobrescrevendo por
 * baixo dos panos o valor que a gente tinha ajustado via JS, mesmo sem
 * nada de errado no nosso código. Chamado uma vez no layout raiz do app
 * (app/(app)/layout.js), que envolve todas as telas, então corrige
 * sozinho depois de cada navegação, instantâneo, sem precisar de nenhuma
 * tela específica (como o Perfil) pra "consertar".
 */
export function useSincronizarBarrinha() {
  const pathname = usePathname();
  useEffect(() => {
    const escuro = document.documentElement.classList.contains('dark');
    aplicarTema(escuro ? 'escuro' : 'claro');
  }, [pathname]);
}
