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
 * Roda as checagens de conquista relevantes para o contexto informado.
 * `contexto` pode ser: 'missao_diaria', 'oracao', 'post', 'leitura'.
 * Retorna a lista de conquistas recém-desbloqueadas nesta chamada (para
 * eventualmente mostrar um aviso festivo na tela).
 */
export async function verificarConquistas(uid, streakAtual, contexto) {
  const novas = [];

  if (streakAtual >= 30) {
    if (await desbloquear(uid, 'orador_absoluto')) novas.push('orador_absoluto');
  }
  if (streakAtual >= 60) {
    if (await desbloquear(uid, 'fiel_nas_pequenas_coisas')) novas.push('fiel_nas_pequenas_coisas');
  }

  if (contexto === 'missao_diaria') {
    const missionarias = await contarSubmissoes(uid, 'atividade_missionaria');
    if (missionarias >= 10) {
      if (await desbloquear(uid, 'coracao_missionario')) novas.push('coracao_missionario');
    }
    const adoracoes = await contarSubmissoes(uid, 'momento_adoracao');
    if (adoracoes >= 15) {
      if (await desbloquear(uid, 'voz_do_louvor')) novas.push('voz_do_louvor');
    }
  }

  if (contexto === 'oracao') {
    const q = query(collection(db, 'pointsLog'), where('uid', '==', uid), where('tipo', '==', 'oracao'));
    const snap = await getDocs(q);
    if (snap.size >= 20) {
      if (await desbloquear(uid, 'intercessor')) novas.push('intercessor');
    }
  }

  if (contexto === 'post') {
    const totalPosts = await contarPosts(uid);
    if (totalPosts >= 1) {
      if (await desbloquear(uid, 'primeira_palavra')) novas.push('primeira_palavra');
    }
  }

  if (contexto === 'leitura') {
    const leituras = await contarSubmissoes(uid, 'leitura_livro');
    if (leituras >= 3) {
      if (await desbloquear(uid, 'rato_de_biblioteca')) novas.push('rato_de_biblioteca');
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
