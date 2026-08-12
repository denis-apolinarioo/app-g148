'use client';

import { useEffect, useState } from 'react';

// ============================================================================
// Item 2 do Bloco A — indicador global de "sem conexão".
// ----------------------------------------------------------------------------
// ANTES: se a internet caía, as escutas em tempo real (onSnapshot) só faziam
// `console.error` — não existia nenhum aviso visual, então na prática o app
// parecia travado ou ficava em loading infinito.
//
// AGORA: um "pub-sub" simples em memória (sem depender de nenhuma lib
// externa) junta dois sinais de queda de conexão:
//   1) navigator.onLine / eventos 'online' e 'offline' do navegador;
//   2) qualquer onSnapshot do Firestore que caia em erro (ver
//      lib/firestore-helpers.js — cada `subscribeToX` agora chama
//      reportarConexaoOk()/reportarErroConexao()), indício de queda de
//      conexão em tempo real mesmo quando o navegador ainda se acha online.
// O componente components/ConexaoBanner.js usa o hook useConexao() abaixo
// pra mostrar/esconder o aviso. Isso também é base pro item 12 (fila
// offline), que vai reagir a este mesmo estado mais pra frente.
// ============================================================================

let offline = typeof navigator !== 'undefined' && 'onLine' in navigator ? !navigator.onLine : false;
const ouvintes = new Set();

function notificar() {
  ouvintes.forEach((cb) => cb(offline));
}

export function reportarErroConexao() {
  if (offline) return;
  offline = true;
  notificar();
}

export function reportarConexaoOk() {
  if (!offline) return;
  offline = false;
  notificar();
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', reportarConexaoOk);
  window.addEventListener('offline', reportarErroConexao);
}

/**
 * Versão sem hook — pra código fora de componente React (ex.: decidir na
 * hora, dentro de um handler, se enfileira uma ação offline ou tenta
 * direto). Ver lib/offlineQueue.js (item 16 do Bloco 8).
 */
export function estaOffline() {
  return offline;
}

/**
 * Registra um callback (fora de React) chamado toda vez que a conexão
 * volta (offline -> online). Devolve a função pra cancelar a escuta. Usado
 * pela fila offline (lib/offlineQueue.js) pra reprocessar sozinha assim que
 * a internet voltar, sem precisar nenhum componente estar "olhando" isso.
 */
export function aoReconectar(callback) {
  const ouvinte = (novoEstado) => {
    if (!novoEstado) callback();
  };
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

/**
 * Hook — true enquanto o app está sem conexão (banner deve aparecer).
 */
export function useConexao() {
  const [estaOffline, setEstaOffline] = useState(offline);

  useEffect(() => {
    setEstaOffline(offline);
    const ouvinte = (novoEstado) => setEstaOffline(novoEstado);
    ouvintes.add(ouvinte);
    return () => ouvintes.delete(ouvinte);
  }, []);

  return estaOffline;
}
