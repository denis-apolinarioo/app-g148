'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';

const CHAVE_STORAGE = 'g148_tema';

function aplicarTema(tema) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', tema === 'escuro');

  // CORREÇÃO DE BUG (linha fina embaixo da barra de notificação ao trocar
  // de tema): no Android, a barra de status é pintada pelo navegador com
  // base nesta tag, numa camada separada do conteúdo da página. Ao reabrir
  // o app, um script no <head> já ajusta o `content` dela ANTES da 1ª
  // pintura, então tudo nasce sincronizado. Mas com o app já aberto, só
  // trocar o `content` de uma vez só às vezes não é suficiente pro Chrome
  // no Android perceber e repintar a barra na hora — some casos, ela
  // demora um instante, e nesse intervalo aparece uma linha fina onde a
  // cor antiga (barra) encontra a cor nova (conteúdo).
  //
  // IMPORTANTE: a tag em si (o elemento <meta>) NUNCA é removida/recriada
  // — ela é gerenciada pelo Next.js por baixo dos panos (por causa do
  // `viewport.themeColor` em app/layout.js), então mexer só no atributo
  // `content` dela é seguro; trocar o elemento por um novo não é (quebra
  // o app na próxima vez que o Next tentar atualizar essa tag sozinho).
  // Em vez disso, o valor é aplicado em 2 passos — um valor "de trânsito"
  // na hora, e o valor final 1 frame depois — pra forçar o navegador a
  // notar a mudança e repintar mais rápido, sem nunca tocar no elemento.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  const corFinal = tema === 'escuro' ? '#0D0906' : '#FAF6EF';
  // Passo 1: aplica um valor "quase idêntico" à cor final (1 dígito hex de
  // diferença — visualmente imperceptível) só pra forçar o Android a notar
  // que ALGO mudou nessa tag. Passo 2, no próximo frame: aplica a cor final
  // de verdade. Duas mudanças de `content` em vez de uma só ajuda o Chrome
  // a não "perder" a atualização.
  //
  // ANTES esse passo 1 limpava o valor (content=''), o que fazia o Android
  // cair numa cor padrão (perto do branco) por 1 frame — só que esse branco
  // transitório batia muito mais feio contra o fundo escuro (indo
  // escuro→claro) do que contra o fundo claro (indo claro→escuro), por
  // isso a linha só aparecia numa direção. Usando um valor quase idêntico
  // em vez de vazio, nunca aparece uma cor errada de verdade — em nenhuma
  // das 2 direções.
  const corTransitoria = tema === 'escuro' ? '#0D0907' : '#FAF6EE';
  meta.setAttribute('content', corTransitoria);
  requestAnimationFrame(() => {
    meta.setAttribute('content', corFinal);
  });
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
    // Liga a transição sincronizada (ver globals.css) só durante a troca,
    // e desliga logo depois — assim ela não fica ativa o tempo todo
    // interferindo em outras trocas de cor do app (ex.: curtir um post).
    const html = document.documentElement;
    html.classList.add('tema-transicionando');
    window.clearTimeout(html.__temaTransicaoTimeout);
    html.__temaTransicaoTimeout = window.setTimeout(() => {
      html.classList.remove('tema-transicionando');
    }, 170);

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
