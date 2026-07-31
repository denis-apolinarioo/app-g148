// ============================================================================
// SERVICE WORKER — Notificações push (Bloco 10)
// ----------------------------------------------------------------------------
// Este arquivo PRECISA morar em /public (raiz do site publicado), porque o
// navegador só aceita registrar um Service Worker com escopo = pasta onde
// o próprio arquivo está. Ele roda separado do resto do app — não pode usar
// import/require de módulos do projeto, por isso a config do Firebase está
// duplicada aqui (os mesmos valores de lib/firebase.js; não são segredo,
// ver comentário lá).
// ============================================================================
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyDbFZGOcB7bBGQo7pvzApga-ueS9c-HPbQ',
  authDomain: 'app-g148.firebaseapp.com',
  projectId: 'app-g148',
  storageBucket: 'app-g148.firebasestorage.app',
  messagingSenderId: '768487606718',
  appId: '1:768487606718:web:ff5e969846a6e9a8a811ef',
});

const messaging = firebase.messaging();

// Item 18/19 — chega aqui quando o push vem com o app fechado, minimizado,
// ou em outra aba (em primeiro plano quem trata é lib/push.js, direto no app).
messaging.onBackgroundMessage((payload) => {
  const dados = payload.data || {};
  const titulo = (payload.notification && payload.notification.title) || 'G148';
  const corpo = (payload.notification && payload.notification.body) || '';

  // Item 24 — badge sincronizado, mesmo com o app fechado (suporte real
  // hoje é limitado a Chrome/Edge em desktop e Android; navegadores sem a
  // Badging API simplesmente ignoram isso, sem quebrar nada).
  if (dados.badgeCount !== undefined && 'setAppBadge' in self.navigator) {
    const contagem = Number(dados.badgeCount) || 0;
    if (contagem > 0) {
      self.navigator.setAppBadge(contagem).catch(() => {});
    } else if ('clearAppBadge' in self.navigator) {
      self.navigator.clearAppBadge().catch(() => {});
    }
  }

  // Item 22 — agrupamento: mesma `tag` substitui/acumula a notificação
  // anterior da mesma categoria em vez de empilhar uma por uma.
  self.registration.showNotification(titulo, {
    body: corpo,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: dados.tipo === 'mensagem' ? 'g148-mensagens' : 'g148-social',
    renotify: true,
    data: { url: dados.url || '/correio' },
  });
});

// Item 21 — deep link: ao tocar na notificação, foca uma aba já aberta do
// app (navegando pra tela certa) ou abre uma nova, em vez de sempre cair
// na tela inicial.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/correio';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((listaDeAbas) => {
      for (const aba of listaDeAbas) {
        try {
          const abaUrl = new URL(aba.url);
          if (abaUrl.origin === self.location.origin) {
            if ('navigate' in aba) aba.navigate(url);
            return aba.focus();
          }
        } catch (err) {
          // aba.url inválida — ignora e segue tentando as outras
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
      return undefined;
    })
  );
});
