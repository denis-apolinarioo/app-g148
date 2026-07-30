// ============================================================================
// Ajuste de pontos de "outras ações" (fora as missões — hoje "postarNoFeed"
// e "orarPorAlguem") que o Admin pode alterar depois que o app já está no
// ar, sem precisar editar código.
//
// ATUALIZAÇÃO: os pontos de CADA MISSÃO agora moram direto no documento da
// missão (coleção "missoes", campo `pontos` — ver lib/missionsRepo.js), já
// que o Admin edita a missão inteira pelo painel (aba "Missões"). Por isso
// esse arquivo não guarda mais "override de pontos de missão" — só o de
// ações que não são missão e não têm documento próprio (hoje: "postarNoFeed"
// e "orarPorAlguem").
// ============================================================================
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { PONTOS } from './constants';
import { getTodasAsMissoes } from './missionsRepo';

const CONFIG_REF_PATH = ['config', 'missionPoints'];

/**
 * Retorna um objeto { missaoId: pontos } com o valor de pontos de cada
 * missão (lido direto da coleção "missoes") + "postarNoFeed" (que pode ter
 * um ajuste salvo pelo Admin no Firestore). Usado pra exibir o "+N pontos"
 * na tela de Missões.
 */
export async function getPontosEfetivos() {
  const missoes = await getTodasAsMissoes();
  const padrao = { postarNoFeed: PONTOS.postarNoFeed, orarPorAlguem: PONTOS.orarPorAlguem };
  missoes.forEach((m) => {
    padrao[m.id] = m.pontos;
  });

  try {
    const snap = await getDoc(doc(db, ...CONFIG_REF_PATH));
    const overrides = snap.exists() ? snap.data() : {};
    // "postarNoFeed" e "orarPorAlguem" podem vir de overrides agora — pontos
    // de missão já vêm direto do documento dela (não existe mais override
    // separado pra missão).
    return {
      ...padrao,
      postarNoFeed: overrides.postarNoFeed ?? padrao.postarNoFeed,
      orarPorAlguem: overrides.orarPorAlguem ?? padrao.orarPorAlguem,
    };
  } catch (err) {
    console.error('Não foi possível carregar ajustes de pontos, usando padrão:', err);
    return padrao;
  }
}

/**
 * Pontos efetivos de "postarNoFeed" (padrão do constants.js OU ajuste
 * salvo pelo Admin). Único uso restante de override neste arquivo.
 */
export async function getPontosEfetivosPostarNoFeed() {
  try {
    const snap = await getDoc(doc(db, ...CONFIG_REF_PATH));
    if (snap.exists() && typeof snap.data().postarNoFeed === 'number') {
      return snap.data().postarNoFeed;
    }
  } catch (err) {
    console.error('Não foi possível carregar ajuste de pontos, usando padrão:', err);
  }
  return PONTOS.postarNoFeed;
}

/**
 * Pontos efetivos de "orarPorAlguem" (padrão do constants.js OU ajuste
 * salvo pelo Admin). Mesmo formato de getPontosEfetivosPostarNoFeed().
 */
export async function getPontosEfetivosOrarPorAlguem() {
  try {
    const snap = await getDoc(doc(db, ...CONFIG_REF_PATH));
    if (snap.exists() && typeof snap.data().orarPorAlguem === 'number') {
      return snap.data().orarPorAlguem;
    }
  } catch (err) {
    console.error('Não foi possível carregar ajuste de pontos, usando padrão:', err);
  }
  return PONTOS.orarPorAlguem;
}

/**
 * Usado pelo Painel Admin pra salvar um novo valor de "postarNoFeed" ou
 * "orarPorAlguem" (a chave é genérica — o Admin manda `missaoId` como
 * 'postarNoFeed' ou 'orarPorAlguem'). Só deve ser chamado por um usuário
 * admin (a regra de segurança do Firestore também exige isso, como dupla
 * proteção).
 */
export async function salvarPontosDaMissao(missaoId, novoValor) {
  const snap = await getDoc(doc(db, ...CONFIG_REF_PATH));
  const atual = snap.exists() ? snap.data() : {};
  await setDoc(doc(db, ...CONFIG_REF_PATH), { ...atual, [missaoId]: novoValor });
}
