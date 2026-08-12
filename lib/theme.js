'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { onSnapshot, collection, doc } from 'firebase/firestore';
import { db } from './firebase';
import { getTodosOsPresets } from './presetsEsteticaRepo';
import { variaveisParaRgbString, MAPA_VARIAVEIS_CSS } from './paletaGerador';

// Chave nova (guarda o preset inteiro, não só um id — precisa disso pro
// script anti-flash em app/layout.js aplicar a cor ANTES da 1ª pintura,
// sem poder esperar o Firestore responder). `g148_tema` é a chave ANTIGA
// (só 'claro'/'escuro') — migrada automaticamente na 1ª leitura, ninguém
// perde a preferência que já tinha por causa dessa atualização.
const CHAVE_CACHE = 'g148_preset_ativo';
const CHAVE_TEMA_ANTIGA = 'g148_tema';

/** Módulo-nível: guarda o último preset aplicado, pra useSincronizarBarrinha
 * conseguir reaplicar só a cor da barra de notificação (ver embaixo) sem
 * precisar reconsultar Firestore/localStorage a cada troca de rota. */
let ultimoPresetAplicado = null;

function lerCache() {
  if (typeof window === 'undefined') return null;
  try {
    const bruto = window.localStorage.getItem(CHAVE_CACHE);
    if (bruto) return JSON.parse(bruto);
    // Migração da chave antiga (só claro/escuro) — só roda 1 vez, na
    // primeira leitura depois dessa atualização.
    const antigo = window.localStorage.getItem(CHAVE_TEMA_ANTIGA);
    if (antigo === 'claro' || antigo === 'escuro') return { idEscolhidoManualmente: antigo };
  } catch {
    // localStorage indisponível — segue sem cache, usa o padrão do app.
  }
  return null;
}

function salvarCache(preset) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      CHAVE_CACHE,
      JSON.stringify({
        idEscolhidoManualmente: preset.idEscolhidoManualmente,
        preset: {
          id: preset.id,
          nome: preset.nome,
          icone: preset.icone,
          ehEscuro: preset.ehEscuro,
          variaveis: preset.variaveis,
        },
      })
    );
  } catch {
    // Sem espaço/permissão de localStorage — o app segue funcionando,
    // só não fica lembrado no próximo carregamento.
  }
}

/**
 * Aplica um preset na tela: escreve as variáveis CSS no <html> (é isso que
 * muda a cor do app inteiro, instantâneo, sem reload) + liga/desliga a
 * classe `dark` (color-scheme + variantes dos ícones em PNG) + ajusta a
 * barrinha de notificações (meta theme-color).
 */
export function aplicarPresetVisual(preset) {
  if (typeof document === 'undefined' || !preset?.variaveis) return;
  const root = document.documentElement;
  const rgb = variaveisParaRgbString(preset.variaveis);
  Object.entries(MAPA_VARIAVEIS_CSS).forEach(([chave, nomeVar]) => {
    if (rgb[chave]) root.style.setProperty(nomeVar, rgb[chave]);
  });
  root.classList.toggle('dark', !!preset.ehEscuro);
  ultimoPresetAplicado = preset;
  aplicarCorBarrinha(preset);
}

// CORREÇÃO DE BUG (linha fina embaixo da barra de notificação ao trocar de
// preset): no Android, a barra de status é pintada pelo navegador com base
// nesta tag, numa camada separada do conteúdo da página — só trocar o
// `content` de uma vez às vezes não é suficiente pro Chrome no Android
// perceber e repintar na hora. O valor é aplicado em 2 passos — um valor
// "de trânsito" (1 dígito hex de diferença, imperceptível) na hora, e o
// valor final 1 frame depois — pra forçar o navegador a notar a mudança e
// repintar mais rápido, sem nunca trocar o elemento <meta> em si (ele é
// gerenciado pelo Next por baixo dos panos, por causa do
// `viewport.themeColor` em app/layout.js).
function aplicarCorBarrinha(preset) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta || !preset?.variaveis?.cream) return;
  const corFinal = preset.variaveis.cream;
  // 1 dígito hex de diferença só pra forçar o Android a perceber a troca.
  const corTransitoria = corFinal.slice(0, -1) + (corFinal.slice(-1) === '0' ? '1' : '0');
  meta.setAttribute('content', corTransitoria);
  requestAnimationFrame(() => {
    meta.setAttribute('content', corFinal);
  });
}

/**
 * Hook principal — usado pela tela de Perfil pra desenhar o seletor de
 * preset. O preset inicial já foi aplicado por um script embutido em
 * app/layout.js, ANTES da 1ª pintura (lendo o cache do localStorage) —
 * este hook busca a lista completa/atualizada no Firestore, confirma se o
 * preset aplicado ainda é válido (pode ter sido desativado pelo Admin
 * nesse meio tempo, ou o Admin pode ter mudado o preset padrão) e cuida de
 * trocar/salvar a escolha pessoal.
 */
export function usePresetAtivo() {
  const [presetsDisponiveis, setPresetsDisponiveis] = useState(null);
  const [presetAtivoId, setPresetAtivoId] = useState(null);

  useEffect(() => {
    let presetPadraoId = 'claro';

    function resolverPresetAtivo(ativos) {
      if (!ativos.length) return;
      const cache = lerCache();
      const idPreferido = cache?.idEscolhidoManualmente;
      const aindaValido = idPreferido && ativos.some((p) => p.id === idPreferido);
      const padrao = ativos.find((p) => p.id === presetPadraoId) || ativos[0];
      const escolhido = (aindaValido && ativos.find((p) => p.id === idPreferido)) || padrao;
      setPresetAtivoId(escolhido.id);
      aplicarPresetVisual(escolhido);
      salvarCache({ ...escolhido, idEscolhidoManualmente: aindaValido ? idPreferido : escolhido.id });
    }

    let ultimosAtivos = [];
    const unsubPresets = onSnapshot(collection(db, 'presetsEstetica'), () => {
      getTodosOsPresets().then((todos) => {
        const ativos = todos.filter((p) => p.ativo !== false);
        ultimosAtivos = ativos;
        setPresetsDisponiveis(ativos);
        resolverPresetAtivo(ativos);
      });
    });
    // Preset padrão escolhido pelo Admin (aba Estética > "Usar como
    // padrão do app") — só decide pra quem AINDA NÃO escolheu um preset
    // manualmente no próprio aparelho (ver idEscolhidoManualmente acima).
    const unsubConfig = onSnapshot(doc(db, 'config', 'appSettings'), (snap) => {
      presetPadraoId = snap.exists() && snap.data().presetPadraoId ? snap.data().presetPadraoId : 'claro';
      if (ultimosAtivos.length) resolverPresetAtivo(ultimosAtivos);
    });
    return () => {
      unsubPresets();
      unsubConfig();
    };
  }, []);

  const trocarPreset = useCallback(
    (id) => {
      const alvo = presetsDisponiveis?.find((p) => p.id === id);
      if (!alvo) return;
      const trocar = () => {
        aplicarPresetVisual(alvo);
        setPresetAtivoId(alvo.id);
        salvarCache({ ...alvo, idEscolhidoManualmente: alvo.id });
      };
      // Mesma técnica de fade suave (View Transitions API) que já existia
      // na troca claro/escuro — cross-fade de opacidade, roda na GPU, sem
      // travar o Android recalculando estilo de centenas de nós.
      if (typeof document !== 'undefined' && document.startViewTransition) {
        document.startViewTransition(trocar);
      } else {
        trocar();
      }
    },
    [presetsDisponiveis]
  );

  return { presetAtivoId, presetsDisponiveis, trocarPreset };
}

/**
 * Resincroniza a barrinha de notificações a cada troca de rota — o Next
 * reaplica a metadata estática (viewport.themeColor, sempre o valor do
 * preset "Claro") toda vez que navega entre abas, sobrescrevendo por baixo
 * dos panos o valor ajustado via JS. Chamado uma vez no layout raiz do app
 * (app/(app)/layout.js).
 */
export function useSincronizarBarrinha() {
  const pathname = usePathname();
  useEffect(() => {
    if (ultimoPresetAplicado) aplicarCorBarrinha(ultimoPresetAplicado);
  }, [pathname]);
}
