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
// - excluirConta: exclusão de conta (LGPD). Ver comentário detalhado logo
//   acima da função, mais abaixo neste arquivo.
// ============================================================================

// CORREÇÃO DE DEPLOY: firebase-functions 6.x moveu a API v1 (a sintaxe
// usada neste arquivo — functions.region(...).https.onCall(...),
// functions.pubsub.schedule(...) etc.) pra dentro do namespace
// 'firebase-functions/v1'. Sem isso, o deploy falha com "functions.region
// is not a function" — a raiz real de um erro anterior de timeout
// ("Cannot determine backend specification"), que só aparecia por causa da
// versão desatualizada do pacote no package.json (corrigido junto com isto).
const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();
const auth = admin.auth();

const FUSO = 'America/Sao_Paulo';

const TITULOS_POR_TIPO = {
  curtida: 'Nova curtida em posts',
  comentario: 'Novo comentário em posts',
  curtida_comentario: 'Nova curtida em comentário',
  mencao: 'Você foi mencionado',
  mensagem: 'Nova mensagem da G148',
  conquista: 'Nova conquista desbloqueada!',
  missao_nova: 'Nova missão disponível',
  missao_especial: 'Nova missão personalizada',
  pontos_admin: 'Você recebeu Pontos de Comunhão',
  dracma_admin: 'Você recebeu Dracmas',
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
  conquista: 'g148-conquistas',
  missao_nova: 'g148-missoes',
  missao_especial: 'g148-missoes',
  pontos_admin: 'g148-recompensas',
  dracma_admin: 'g148-recompensas',
};

// curtida_comentario ainda não tem um toggle próprio na tela de preferências
// (item 23) — pra não precisar de UI nova, segue o mesmo toggle de "curtida".
// mencao agora TEM toggle próprio ('mencao'), separado de "comentario".
const CATEGORIA_DE_PREFERENCIA_POR_TIPO = {
  curtida: 'curtida',
  curtida_comentario: 'curtida',
  comentario: 'comentario',
  mencao: 'mencao',
  mensagem: 'mensagem',
  conquista: 'conquista',
  missao_nova: 'missao_nova',
  missao_especial: 'missao_nova',
  pontos_admin: 'pontos',
  dracma_admin: 'pontos',
};

// Item novo — pra onde a notificação leva ao ser tocada. Antes era sempre
// '/correio'; agora cada tipo pode abrir direto no lugar que faz sentido
// (ex.: conquista abre o perfil já com o emblema em destaque). O Service
// Worker (public/firebase-messaging-sw.js) já sabia ler essa URL do payload
// — só não recebia nada além de '/correio' até agora.
function montarUrlDestino(tipo, msg) {
  if (tipo === 'conquista') {
    return `/perfil?conquista=${encodeURIComponent(msg.achievementId || '')}`;
  }
  if (tipo === 'missao_nova' || tipo === 'missao_especial') return '/missoes';
  if (tipo === 'pontos_admin') return '/perfil';
  if (tipo === 'dracma_admin') return '/carteira';
  return '/correio';
}

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

    // Item novo — mensagem do Correio com pontos/dracmas anexados (o usuário
    // precisa abrir e clicar em "Receber" pra ganhar). Continua sendo tipo
    // 'mensagem' no banco (não muda nada da lógica de envio existente), mas
    // pra notificação em si merece um título e categoria de preferência
    // próprios, senão fica indistinguível de uma mensagem comum.
    const temRecompensaAnexada =
      tipo === 'mensagem' && ((Number(msg.pontosAnexados) || 0) > 0 || (Number(msg.dracmasAnexados) || 0) > 0);

    // Item 23 — preferência por categoria (padrão: tudo ligado, só desliga
    // se a pessoa explicitamente marcou false).
    const prefs = usuario.notifPrefs || {};
    const categoriaPref = temRecompensaAnexada
      ? 'correio_recompensa'
      : CATEGORIA_DE_PREFERENCIA_POR_TIPO[tipo] || tipo;
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

    const titulo = temRecompensaAnexada ? 'Você recebeu uma recompensa no Correio!' : TITULOS_POR_TIPO[tipo] || 'G148';
    const textoBase = (msg.texto || '').slice(0, 120);
    const corpo = msg.remetenteNome ? `${msg.remetenteNome}: ${textoBase}` : textoBase || 'Toque para ver.';
    const urlDestino = montarUrlDestino(tipo, msg);

    const resposta = await messaging.sendEachForMulticast({
      tokens,
      notification: { title: titulo, body: corpo },
      data: {
        // Item 21 — deep link: o Service Worker usa essa URL pra abrir a
        // tela certa ao tocar na notificação.
        url: urlDestino,
        tipo,
        mailboxId: context.params.messageId,
        badgeCount: String(naoLidasSnap.size),
      },
      webpush: {
        notification: {
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-badge-monochrome.png',
          tag: temRecompensaAnexada ? 'g148-recompensas' : TAG_POR_TIPO[tipo] || 'g148-geral',
          renotify: true,
        },
        fcmOptions: { link: urlDestino },
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

// ============================================================================
// EXCLUSÃO DE CONTA (LGPD)
// ----------------------------------------------------------------------------
// Callable — chamada pelo app via httpsCallable('excluirConta'), tanto pela
// própria pessoa (área Perfil → "Excluir minha conta") quanto pelo Admin
// (aba Usuários → "Excluir conta"). Precisa ser uma Function (não dá pra
// fazer isso só no navegador da pessoa) por três motivos:
//   1) Apagar posts/comentários/orações DE OUTRAS PESSOAS que a pessoa
//      curtiu ou comentou — isso o navegador dela não tem (e não deveria
//      ter) permissão de fazer.
//   2) Apagar o login da pessoa no Firebase Auth — senão ela continua
//      conseguindo entrar depois de "excluída".
//   3) Ficar imune a queda de conexão no meio do processo — se cair, dá pra
//      rodar de novo (todos os passos abaixo são idempotentes: apagar algo
//      que já não existe mais não dá erro).
//
// DECISÃO DE PRODUTO (conversada com o usuário): posts, comentários (tanto
// os que a pessoa criou quanto os dela em posts de outras pessoas) e
// pedidos de oração NÃO são apagados — ficam, só o autor vira anônimo
// (functions abaixo apagam users/{uid}, e o app já resolve nome/foto/
// username em tempo real via lib/usersCache.js, que já tinha o fallback
// "Usuário removido" pronto pra quando o doc do usuário não existe mais —
// nada precisa mudar nas telas). Curtidas idem: o uid continua no array
// `curtidas` do post/comentário (mantendo a contagem certa), só some da
// lista de "quem curtiu" (LikesListModal.js já filtra usuário sem perfil).
//
// O que É apagado de vez: o perfil, o PIN da carteira, os tokens de push,
// as submissões de missão e as conquistas desbloqueadas — nada disso faz
// sentido manter associado a uma conta que não existe mais.
//
// O que fica mas anonimizado (sem apagar o documento): pointsLog, dracmaLog,
// acoesLog, mailbox, prayers/interacoes — são histórico/auditoria e, no caso
// do dracmaLog, também o extrato de QUEM RECEBEU uma transferência dela;
// apagar quebraria o saldo/extrato de outras pessoas. Trocamos só o que
// identifica a pessoa (nome/foto, quando o documento guarda isso) — o uid
// em si fica (não tem como restaurar o extrato de quem recebeu sem ele), e
// como o perfil já não existe mais, esse uid não abre pra lugar nenhum.
//
// Campos "congelados" de nome/foto/username em posts/comentários/prayers
// (autorNome/autorFoto/autorUsername, gravados na hora da criação como
// fallback de exibição — ver lib/firestore-helpers.js) são limpos também,
// por completude: mesmo não aparecendo na tela (o app sempre busca o nome
// ATUAL via useUsuarioAtual/getUsuarioCache, nunca lê esses campos direto),
// o dado real não deveria continuar gravado ali depois que a pessoa pediu
// pra sumir.
// ============================================================================

const LIMITE_BATCH = 400; // folga sobre o teto de 500 do Firestore

async function commitEmLotes(refs, transformar) {
  for (let i = 0; i < refs.length; i += LIMITE_BATCH) {
    const fatia = refs.slice(i, i + LIMITE_BATCH);
    const batch = db.batch();
    fatia.forEach((ref) => transformar(batch, ref));
    await batch.commit();
  }
}

exports.excluirConta = functions
  .region('southamerica-east1')
  .https.onCall(async (data, context) => {
  // BLINDAGEM: tudo dentro de 1 try/catch geral, cobrindo também a parte de
  // cima (checagem de admin, busca do alvo) que antes ficava FORA das
  // proteções de etapa() lá embaixo. Motivo: o Firebase troca qualquer erro
  // que não seja um HttpsError por um "INTERNAL" genérico e SEM mensagem
  // nenhuma pro navegador (só loga o real nos Registros do Cloud Functions)
  // — então um erro nessa parte de cima (ex.: falha ao consultar o Firestore
  // pra checar se quem chamou é admin) sempre aparecia como o texto
  // genérico no app, não importa quantos detalhes a gente adicionasse lá
  // embaixo. Esse try/catch garante que TODO erro daqui pra baixo vira um
  // HttpsError com mensagem de verdade antes de sair da function.
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Você precisa estar logado.');
    }
    const solicitanteUid = context.auth.uid;
    const alvoUid = data && data.uid ? String(data.uid) : solicitanteUid;

    // Só a própria pessoa (excluindo a própria conta) ou um Admin (excluindo
    // qualquer conta) podem chamar isto.
    if (alvoUid !== solicitanteUid) {
      let solicitanteSnap;
      try {
        solicitanteSnap = await db.collection('users').doc(solicitanteUid).get();
      } catch (err) {
        console.error(`[excluirConta] Falhou ao checar se quem chamou é admin (uid=${solicitanteUid}):`, err);
        throw new Error(`Falha ao checar permissão de Admin: ${(err && err.message) || err}`);
      }
      if (!solicitanteSnap.exists || !solicitanteSnap.data().isAdmin) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Só é possível excluir a própria conta, ou ser Admin pra excluir a de outra pessoa.'
        );
      }
    }

    const alvoRef = db.collection('users').doc(alvoUid);
    let alvoSnap;
    try {
      alvoSnap = await alvoRef.get();
    } catch (err) {
      console.error(`[excluirConta] Falhou ao buscar a conta alvo (uid=${alvoUid}):`, err);
      throw new Error(`Falha ao buscar a conta a excluir: ${(err && err.message) || err}`);
    }
    if (!alvoSnap.exists) {
      // Idempotente: se já não existe mais (ex.: 2ª tentativa depois de uma
      // falha no meio), não é erro — só confirma que já está feito.
      return { ok: true, jaEstavaExcluido: true };
    }
    const usernameAlvo = alvoSnap.data() ? alvoSnap.data().username : null;

    // DIAGNÓSTICO: cada etapa é isolada com seu próprio try/catch e log —
    // se uma etapa específica falhar (ex.: falta de permissão do IAM numa
    // API, índice do Firestore ainda propagando), o erro aparece nos
    // Registros do Cloud Functions com o nome exato da etapa. A mensagem
    // detalhada some no cliente se a gente jogar isso como HttpsError code
    // 'internal' (ver comentário grande lá embaixo, no catch geral) — por
    // isso aqui usamos um Error comum, não HttpsError, e deixamos o catch
    // geral no final decidir como devolver isso pro app.
    async function etapa(nome, fn) {
      try {
        await fn();
      } catch (err) {
        console.error(`[excluirConta] Falhou na etapa "${nome}" (uid=${alvoUid}):`, err);
        throw new Error(`Falha ao excluir conta na etapa "${nome}": ${(err && err.message) || err}`);
      }
    }

    // --- 1) Anonimiza os campos "congelados" de nome/foto/username -------
    // Posts e comentários (subcoleção de cada post) criados pela pessoa.
    await etapa('anonimizar posts', async () => {
      const postsSnap = await db.collection('posts').where('autorId', '==', alvoUid).get();
      await commitEmLotes(postsSnap.docs.map((d) => d.ref), (batch, ref) =>
        batch.update(ref, { autorNome: 'Usuário removido', autorFoto: '', autorUsername: '' })
      );
    });
    // Comentários da pessoa em posts de QUALQUER autor — precisa varrer a
    // subcoleção de cada post (Firestore não tem "collection group" nativo
    // sem index dedicado; usamos collectionGroup, que já cobre isso sem
    // precisar listar post por post).
    await etapa('anonimizar comentários', async () => {
      const comentariosSnap = await db
        .collectionGroup('comentarios')
        .where('autorId', '==', alvoUid)
        .get();
      await commitEmLotes(comentariosSnap.docs.map((d) => d.ref), (batch, ref) =>
        batch.update(ref, { autorNome: 'Usuário removido', autorFoto: '' })
      );
    });
    // Pedidos de oração da pessoa.
    await etapa('anonimizar pedidos de oração', async () => {
      const prayersSnap = await db.collection('prayers').where('autorId', '==', alvoUid).get();
      await commitEmLotes(prayersSnap.docs.map((d) => d.ref), (batch, ref) =>
        batch.update(ref, { autorNome: 'Usuário removido', autorFoto: '', autorUsername: '' })
      );
    });

    // --- 2) Apaga de vez o que só faz sentido existir com a conta ativa ---
    await etapa('apagar submissões de missão', async () => {
      const submissoesSnap = await db.collection('missionSubmissions').where('uid', '==', alvoUid).get();
      await commitEmLotes(submissoesSnap.docs.map((d) => d.ref), (batch, ref) => batch.delete(ref));
    });

    await etapa('apagar tokens de push', async () => {
      const pushTokensSnap = await db.collection('pushTokens').where('uid', '==', alvoUid).get();
      await commitEmLotes(pushTokensSnap.docs.map((d) => d.ref), (batch, ref) => batch.delete(ref));
    });

    await etapa('apagar segredo da carteira e conquistas', async () => {
      await db.collection('walletSecrets').doc(alvoUid).delete();
      await db.collection('achievementsUnlocked').doc(alvoUid).delete();
    });

    // --- 3) Apaga o perfil em si -------------------------------------------
    await etapa('apagar perfil', async () => {
      await alvoRef.delete();
      // O username reservado (coleção `usernames`, ver lib/firestore-helpers.js
      // -> getUserByUsername) também precisa sumir, senão ninguém mais
      // consegue registrar esse @ de novo.
      if (usernameAlvo) {
        await db.collection('usernames').doc(String(usernameAlvo).toLowerCase()).delete().catch((err) => {
          console.error(`[excluirConta] Não foi possível apagar username reservado (uid=${alvoUid}):`, err);
        });
      }
    });

    // --- 4) Apaga o login (Firebase Auth) ----------------------------------
    // Sem isso, a pessoa continuaria conseguindo entrar (o app trataria
    // como "perfil sumiu", mas o login em si continuaria válido).
    await etapa('apagar login (Firebase Auth)', async () => {
      await auth.deleteUser(alvoUid).catch((err) => {
        // 'auth/user-not-found' é ok (idempotente); qualquer outro erro aqui
        // sobe pro chamador, porque significa que a conta de login ainda
        // existe e a pessoa ainda consegue entrar.
        if (err.code !== 'auth/user-not-found') throw err;
      });
    });

    return { ok: true, jaEstavaExcluido: false };
  } catch (err) {
    // ATENÇÃO — pegadinha real do Firebase: um HttpsError com código
    // 'internal' (ou 'unknown') tem a MENSAGEM apagada pelo próprio SDK
    // antes de chegar no navegador, por segurança — o cliente sempre vê só
    // o texto genérico "INTERNAL", não importa o que a gente escreva aqui.
    // É a causa raiz de por que nenhuma mensagem detalhada nunca apareceu,
    // mesmo com a etapa() e o try/catch geral certos. Erros "esperados"
    // (não logado, sem permissão) continuam sendo HttpsError normal — esses
    // códigos ('unauthenticated', 'permission-denied' etc.) NÃO são
    // filtrados e chegam com a mensagem certinha. Só as falhas internas
    // inesperadas (Error comum, lançado pela etapa() e pelos try/catch
    // acima) é que precisam sair por um caminho diferente: devolver um
    // resultado normal (200, sem lançar erro nenhum) com `ok:false` e o
    // texto do erro dentro. O client (lib/excluirContaRepo.js) já sabe ler
    // esse formato e transformar em erro de novo, com a mensagem intacta.
    if (err instanceof functions.https.HttpsError) throw err;
    console.error(`[excluirConta] Erro inesperado:`, err);
    return { ok: false, erro: (err && err.message) || String(err) };
  }
  });
