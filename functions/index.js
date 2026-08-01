// ============================================================================
// CLOUD FUNCTIONS — App G148 (Bloco 10: notificações push)
// ----------------------------------------------------------------------------
// Como publicar (fora do fluxo normal de "arrastar o zip no GitHub" —
// veja o aviso no início da resposta que entregou este bloco):
//   1) npm install -g firebase-tools   (se ainda não tiver)
//   2) firebase login
//   3) na raiz do projeto: firebase deploy --only functions
//
// O QUE ESTE ARQUIVO FAZ:
// - enviarPushMailbox: dispara uma notificação push toda vez que um
//   documento novo é criado na coleção `mailbox` (curtida, comentário ou
//   mensagem — é o mesmo caminho que já alimenta o Correio no app, ver
//   `notificarInteracao` e `sendMailMessage` em lib/firestore-helpers.js).
//   Respeita as preferências por categoria (item 23) e o horário de
//   silêncio (item 26) da pessoa, e limpa tokens mortos depois do envio
//   (item 25).
// - limparTokensAntigos: apaga, uma vez por semana, tokens que não são
//   renovados há muito tempo (aparelho desinstalou o app, trocou de
//   celular etc.) — reforço do item 25 além da limpeza reativa.
// ============================================================================

const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();

const FUSO = 'America/Sao_Paulo';

const TITULOS_POR_TIPO = {
  curtida: 'Nova curtida em posts',
  comentario: 'Novo comentário em posts',
  curtida_comentario: 'Nova curtida em comentário',
  mencao: 'Você foi mencionado',
  mensagem: 'Nova mensagem da G148',
};

// Item 22 — agrupamento: curtida/comentário caem sob a mesma "tag" (viram
// uma coisa só se se acumularem antes de a pessoa abrir), mensagens da
// liderança ficam separadas pra não se perderem no meio de curtidas.
const TAG_POR_TIPO = {
  curtida: 'g148-social',
  comentario: 'g148-social',
  curtida_comentario: 'g148-social',
  mencao: 'g148-social',
  mensagem: 'g148-mensagens',
};

// curtida_comentario e mencao são "subtipos" que ainda não têm um toggle
// próprio na tela de preferências (item 23) — pra não precisar de UI nova,
// eles respeitam o toggle da categoria mais parecida: curtida em comentário
// segue o mesmo toggle de "curtida", menção segue o mesmo toggle de
// "comentario" (é dentro de um comentário que ela acontece).
const CATEGORIA_DE_PREFERENCIA_POR_TIPO = {
  curtida: 'curtida',
  curtida_comentario: 'curtida',
  comentario: 'comentario',
  mencao: 'comentario',
  mensagem: 'mensagem',
};

/**
 * Item 26 — horário de silêncio. `quietHours` vem de users/{uid}.notifQuietHours
 * = { ativo, inicio: 'HH:mm', fim: 'HH:mm' }. Sempre calculado no fuso de
 * Brasília, não no fuso do servidor da função.
 */
function dentroDoHorarioDeSilencio(quietHours) {
  if (!quietHours || !quietHours.ativo || !quietHours.inicio || !quietHours.fim) return false;

  const agora = new Intl.DateTimeFormat('en-GB', {
    timeZone: FUSO,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date());

  const paraMinutos = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  };

  const minutosAgora = paraMinutos(agora);
  const inicio = paraMinutos(quietHours.inicio);
  const fim = paraMinutos(quietHours.fim);

  if (inicio === fim) return false; // janela zerada = nunca em silêncio
  if (inicio < fim) {
    return minutosAgora >= inicio && minutosAgora < fim;
  }
  // Janela cruza a meia-noite (ex.: 22:00 → 07:00)
  return minutosAgora >= inicio || minutosAgora < fim;
}

exports.enviarPushMailbox = functions
  .region('southamerica-east1')
  .firestore.document('mailbox/{messageId}')
  .onCreate(async (snap, context) => {
    const msg = snap.data() || {};
    const destinatarioId = msg.destinatarioId;

    if (!destinatarioId || destinatarioId === msg.remetenteId) return null;

    const tipo = Object.keys(TITULOS_POR_TIPO).includes(msg.tipo) ? msg.tipo : 'mensagem';

    const usuarioSnap = await db.collection('users').doc(destinatarioId).get();
    if (!usuarioSnap.exists) return null;
    const usuario = usuarioSnap.data() || {};

    // Item 23 — preferência por categoria (padrão: tudo ligado, só desliga
    // se a pessoa explicitamente marcou false).
    const prefs = usuario.notifPrefs || {};
    const categoriaPref = CATEGORIA_DE_PREFERENCIA_POR_TIPO[tipo] || tipo;
    if (prefs[categoriaPref] === false) return null;

    // Item 26 — horário de silêncio. O Correio continua recebendo a
    // mensagem normalmente (já foi criada); só o push fica de fora.
    if (dentroDoHorarioDeSilencio(usuario.notifQuietHours)) return null;

    const tokensSnap = await db.collection('pushTokens').where('uid', '==', destinatarioId).get();
    if (tokensSnap.empty) return null;
    const tokens = tokensSnap.docs.map((d) => d.id);

    // Item 24 — badge sincronizado: manda a contagem atual de não lidas
    // junto do payload, pro Service Worker conseguir atualizar o badge do
    // ícone mesmo com o app fechado (ver public/firebase-messaging-sw.js).
    const naoLidasSnap = await db
      .collection('mailbox')
      .where('destinatarioId', '==', destinatarioId)
      .where('lida', '==', false)
      .get();

    const titulo = TITULOS_POR_TIPO[tipo] || 'G148';
    const textoBase = (msg.texto || '').slice(0, 120);
    const corpo = msg.remetenteNome ? `${msg.remetenteNome}: ${textoBase}` : textoBase || 'Toque para ver.';

    const resposta = await messaging.sendEachForMulticast({
      tokens,
      notification: { title: titulo, body: corpo },
      data: {
        // Item 21 — deep link: o Service Worker usa essa URL pra abrir a
        // tela certa ao tocar na notificação.
        url: '/correio',
        tipo,
        mailboxId: context.params.messageId,
        badgeCount: String(naoLidasSnap.size),
      },
      webpush: {
        notification: {
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-badge-monochrome.png',
          tag: TAG_POR_TIPO[tipo] || 'g148-geral',
          renotify: true,
        },
        fcmOptions: { link: '/correio' },
      },
    });

    // Item 25 — limpeza de token: qualquer token que o FCM rejeitar como
    // não registrado/inválido é removido na hora, sem esperar o job semanal.
    const tokensParaRemover = [];
    resposta.responses.forEach((r, i) => {
      if (r.success) return;
      const codigo = r.error && r.error.code;
      if (
        codigo === 'messaging/registration-token-not-registered' ||
        codigo === 'messaging/invalid-registration-token' ||
        codigo === 'messaging/invalid-argument'
      ) {
        tokensParaRemover.push(tokens[i]);
      }
    });

    if (tokensParaRemover.length) {
      const batch = db.batch();
      tokensParaRemover.forEach((token) => batch.delete(db.collection('pushTokens').doc(token)));
      await batch.commit();
    }

    return null;
  });

// Item 25 (reforço) — uma vez por semana, apaga tokens que não são
// renovados há mais de 60 dias (aparelho parado, app desinstalado sem
// nunca abrir de novo pra disparar o cleanup reativo acima).
exports.limparTokensAntigos = functions
  .region('southamerica-east1')
  .pubsub.schedule('every 168 hours')
  .timeZone(FUSO)
  .onRun(async () => {
    const limite = admin.firestore.Timestamp.fromMillis(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const snap = await db.collection('pushTokens').where('atualizadoEm', '<', limite).get();
    if (snap.empty) return null;

    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    return null;
  });
