// ============================================================================
// Verificação e desbloqueio de conquistas. Roda de forma "silenciosa" depois
// de ações do usuário (ex.: depois de submeter uma missão) — nunca trava a
// tela esperando essa checagem.
//
// Cada conquista usa um ID de documento determinístico (uid_conquistaId),
// o que faz o desbloqueio ser automaticamente à prova de duplicidade: tentar
// desbloquear a mesma conquista duas vezes é uma operação segura (idempotente).
// ============================================================================
import {
  doc,
  getDoc,
  setDoc,
  getDocs,
  collection,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { CONQUISTAS } from './constants';

async function jaDesbloqueada(uid, achievementId) {
  const snap = await getDoc(doc(db, 'achievementsUnlocked', `${uid}_${achievementId}`));
  return snap.exists();
}

async function desbloquear(uid, achievementId) {
  const jaTem = await jaDesbloqueada(uid, achievementId);
  if (jaTem) return false;
  await setDoc(doc(db, 'achievementsUnlocked', `${uid}_${achievementId}`), {
    uid,
    achievementId,
    desbloqueadoEm: serverTimestamp(),
  });
  return true;
}

async function contarSubmissoes(uid, missaoId) {
  const q = query(
    collection(db, 'missionSubmissions'),
    where('uid', '==', uid),
    where('missaoId', '==', missaoId)
  );
  const snap = await getDocs(q);
  return snap.size;
}

async function contarPosts(uid) {
  const q = query(collection(db, 'posts'), where('autorId', '==', uid));
  const snap = await getDocs(q);
  return snap.size;
}

/**
 * Diz se o contadorTipo de uma conquista é relevante para checar agora,
 * dado o contexto da ação que acabou de acontecer. Streak é sempre checado
 * (pode avançar em qualquer ação), os demais só quando o contexto bate.
 */
function contadorRelevantePara(contadorTipo, contexto) {
  if (contadorTipo === 'streak') return true;
  if (contexto === 'missao_diaria' || contexto === 'leitura') {
    return contadorTipo.startsWith('missao:');
  }
  if (contexto === 'oracao') return contadorTipo === 'oracao';
  if (contexto === 'post') return contadorTipo === 'post';
  return false;
}

/**
 * Calcula o valor atual do contador de uma conquista, de acordo com seu
 * contadorTipo.
 */
async function calcularContador(contadorTipo, uid, streakAtual) {
  if (contadorTipo === 'streak') {
    return streakAtual;
  }
  if (contadorTipo.startsWith('missao:')) {
    const missaoId = contadorTipo.slice('missao:'.length);
    return contarSubmissoes(uid, missaoId);
  }
  if (contadorTipo === 'oracao') {
    const q = query(collection(db, 'pointsLog'), where('uid', '==', uid), where('tipo', '==', 'oracao'));
    const snap = await getDocs(q);
    return snap.size;
  }
  if (contadorTipo === 'post') {
    return contarPosts(uid);
  }
  return 0;
}

/**
 * Roda as checagens de conquista relevantes para o contexto informado.
 * `contexto` pode ser: 'missao_diaria', 'oracao', 'post', 'leitura'.
 * Retorna a lista de conquistas recém-desbloqueadas nesta chamada (para
 * eventualmente mostrar um aviso festivo na tela).
 *
 * Genérico sobre CONQUISTAS — cada conquista automática (contadorTipo !==
 * 'manual') é checada usando seu próprio contadorTipo/meta, em vez de um
 * bloco de if escrito à mão por conquista. Isso permite chegar a dezenas de
 * conquistas sem essa função crescer proporcionalmente.
 */
export async function verificarConquistas(uid, streakAtual, contexto) {
  const novas = [];

  const candidatas = CONQUISTAS.filter((c) => c.contadorTipo !== 'manual');

  for (const conquista of candidatas) {
    if (!contadorRelevantePara(conquista.contadorTipo, contexto)) continue;

    // eslint-disable-next-line no-await-in-loop
    const jaTem = await jaDesbloqueada(uid, conquista.id);
    if (jaTem) continue;

    // eslint-disable-next-line no-await-in-loop
    const valorAtual = await calcularContador(conquista.contadorTipo, uid, streakAtual);
    if (valorAtual >= conquista.meta) {
      // eslint-disable-next-line no-await-in-loop
      if (await desbloquear(uid, conquista.id)) novas.push(conquista.id);
    }
  }

  return novas;
}

export async function getConquistasDoUsuario(uid) {
  const q = query(collection(db, 'achievementsUnlocked'), where('uid', '==', uid));
  const snap = await getDocs(q);
  const idsDesbloqueados = snap.docs.map((d) => d.data().achievementId);
  return CONQUISTAS.filter((c) => idsDesbloqueados.includes(c.id));
}
