// ============================================================================
// NOTIFICAÇÕES PUSH — Bloco 10 (itens 18 a 26)
// ----------------------------------------------------------------------------
// Fica separado de firestore-helpers.js de propósito, igual points.js: é uma
// área isolada o bastante (e nova o bastante) pra merecer arquivo próprio.
//
// Envio de fato acontece na Cloud Function (functions/index.js), disparada
// quando algo novo cai em `mailbox` (curtida, comentário, mensagem). Este
// arquivo cuida só do lado do navegador: pedir permissão, guardar o token,
// aplicar preferências, e manter o badge do ícone em dia.
// ============================================================================
'use client';

import { getMessaging, getToken, deleteToken, onMessage, isSupported } from 'firebase/messaging';
import { doc, setDoc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import app, { db } from './firebase';

// Item 18/20 — chave pública VAPID. Gerada em: Firebase Console → ⚙️
// Configurações do projeto → aba "Cloud Messaging" → seção "Certificados
// push da Web" → "Gerar par de chaves". SEM essa chave real, getToken()
// nunca funciona — troque este valor antes de usar em produção.
const VAPID_KEY = 'BJi_9zB1hKtQJxxadV8cBD9ZmkkFMW05H-Kba_c84fVL7IWnL7CsNLc7BXFGecF8R0uUZDJRD25qKaG5ulBnEIE';

const CHAVE_TOKEN_LOCAL = 'g148_push_token';

export const CATEGORIAS_NOTIFICACAO = [
  { chave: 'mensagem', label: 'Mensagens da liderança' },
  { chave: 'curtida', label: 'Curtidas no Mural' },
  { chave: 'comentario', label: 'Comentários no Mural' },
];

let messagingInstancePromise = null;

// Só cria a instância de Messaging depois de confirmar suporte do
// navegador — em navegador sem suporte (ex.: Firefox iOS, navegadores bem
// antigos) isSupported() resolve false e a gente simplesmente desiste, sem
// quebrar o resto do app.
function obterMessaging() {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (!messagingInstancePromise) {
    messagingInstancePromise = isSupported()
      .then((suportado) => (suportado ? getMessaging(app) : null))
      .catch(() => null);
  }
  return messagingInstancePromise;
}

// Item 19 — iOS (Safari/WebKit) só entrega Web Push a partir do iOS 16.4, e
// SOMENTE quando o app está instalado na Tela de Início (modo standalone).
// Fora disso, Notification.requestPermission() é ignorado ou nem existe.
export function detectarPlataforma() {
  if (typeof window === 'undefined') {
    return { ios: false, standalone: false, suportado: false };
  }
  const ua = window.navigator.userAgent || '';
  const ios =
    /iPad|iPhone|iPod/.test(ua) ||
    (ua.includes('Macintosh') && navigator.maxTouchPoints > 1); // iPad moderno se identifica como Mac
  const standalone =
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    window.navigator.standalone === true;
  const suportado = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
  return { ios, standalone, suportado };
}

export function permissaoAtual() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission; // 'granted' | 'denied' | 'default'
}

// Item 18/20 — pede permissão ao navegador, obtém o token do FCM e salva em
// pushTokens/{token}, associado ao uid da pessoa logada.
export async function ativarNotificacoes(uid) {
  const { ios, standalone, suportado } = detectarPlataforma();
  if (!suportado) throw new Error('NAO_SUPORTADO');
  if (ios && !standalone) throw new Error('IOS_PRECISA_INSTALAR');

  const permissao = await Notification.requestPermission();
  if (permissao !== 'granted') throw new Error('PERMISSAO_NEGADA');

  const messaging = await obterMessaging();
  if (!messaging) throw new Error('NAO_SUPORTADO');

  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration,
  });
  if (!token) throw new Error('SEM_TOKEN');

  const plataforma = ios ? 'ios' : /Android/i.test(navigator.userAgent) ? 'android' : 'web';
  await setDoc(
    doc(db, 'pushTokens', token),
    {
      uid,
      plataforma,
      userAgent: navigator.userAgent,
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    },
    { merge: true }
  );

  localStorage.setItem(CHAVE_TOKEN_LOCAL, token);
  return token;
}

// Item 25 — remove o token deste aparelho (usado ao desativar manualmente
// e também no logout). Silencioso de propósito: erro aqui não deve travar
// nem a troca de preferência nem o logout.
export async function desativarNotificacoes() {
  const token = typeof window !== 'undefined' ? localStorage.getItem(CHAVE_TOKEN_LOCAL) : null;
  try {
    const messaging = await obterMessaging();
    if (messaging) await deleteToken(messaging).catch(() => {});
  } catch (err) {
    console.error('Erro ao invalidar token de push no FCM:', err);
  }
  if (token) {
    await deleteDoc(doc(db, 'pushTokens', token)).catch((err) =>
      console.error('Erro ao remover token de push do Firestore:', err)
    );
  }
  if (typeof window !== 'undefined') localStorage.removeItem(CHAVE_TOKEN_LOCAL);
}

// Chamado no logout (perfil/page.js) — mesma limpeza do item 25, mas nunca
// deve impedir a pessoa de sair da conta se algo der errado.
export async function limparTokenAoSair() {
  try {
    await desativarNotificacoes();
  } catch (err) {
    console.error('Erro ao limpar token de push no logout:', err);
  }
}

// Item 24 — badge do ícone do app sincronizado com o nº de não lidas no
// Correio. Suporte real hoje: Chrome/Edge desktop e Android; em quem não
// suporta, a chamada simplesmente não faz nada.
export function sincronizarBadge(contagem) {
  if (typeof navigator === 'undefined' || !('setAppBadge' in navigator)) return;
  try {
    if (contagem > 0) {
      navigator.setAppBadge(contagem).catch(() => {});
    } else if ('clearAppBadge' in navigator) {
      navigator.clearAppBadge().catch(() => {});
    }
  } catch {
    // Badging API não disponível nesse navegador — ignora.
  }
}

// Item 23 — preferências de notificação por categoria, guardadas direto no
// perfil (users/{uid}.notifPrefs). Ausência de uma chave = categoria ligada
// (padrão opt-out, não opt-in — ninguém perde aviso sem escolher perder).
export async function salvarPreferenciasNotificacao(uid, prefs) {
  await updateDoc(doc(db, 'users', uid), { notifPrefs: prefs });
}

// Item 26 — horário de silêncio: { ativo, inicio: 'HH:mm', fim: 'HH:mm' }.
export async function salvarHorarioSilencio(uid, quietHours) {
  await updateDoc(doc(db, 'users', uid), { notifQuietHours: quietHours });
}

// Item 21/22 — com o app ABERTO em primeiro plano, o Service Worker não
// entra em ação (é assim que o FCM funciona); quem recebe a mensagem é o
// próprio app, através deste listener. Usado só pra manter o badge exato
// na hora — o Correio em si já atualiza sozinho via onSnapshot.
export async function escutarPushEmPrimeiroPlano(callback) {
  const messaging = await obterMessaging();
  if (!messaging) return () => {};
  return onMessage(messaging, callback);
}
