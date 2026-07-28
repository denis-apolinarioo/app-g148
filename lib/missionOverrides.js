// ============================================================================
// Permite que o admin ajuste os pontos de qualquer missão DEPOIS que o app
// já estiver no ar, sem precisar editar código. Funciona como uma "camada
// por cima" dos valores padrão definidos em lib/constants.js:
//
// - Se não existe um ajuste salvo pra uma missão, usa o valor padrão do
//   constants.js normalmente.
// - Se o admin salvar um novo valor pelo Painel Admin, esse valor passa a
//   valer a partir daquele momento (os pontos já creditados no passado não
//   mudam retroativamente — só as próximas submissões).
//
// Tudo fica guardado em UM ÚNICO documento (config/missionPoints), o que
// deixa a leitura e a escrita simples e baratas (1 leitura/escrita, não uma
// por missão).
// ============================================================================
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { MISSOES_DIARIAS, MISSOES_SEMANAIS, MISSOES_MENSAIS, PONTOS } from './constants';

const CONFIG_REF_PATH = ['config', 'missionPoints'];

function todasAsMissoesPadrao() {
  return [...MISSOES_DIARIAS, ...MISSOES_SEMANAIS, ...MISSOES_MENSAIS];
}

/**
 * Retorna um objeto { missaoId: pontos } já mesclando os valores padrão do
 * constants.js com qualquer ajuste salvo pelo admin no Firestore.
 * ATUALIZAÇÃO: inclui também "postarNoFeed" (pontos por post espontâneo no
 * feed), que usa o mesmo documento de configuração — reaproveita a mesma
 * leitura/escrita, sem precisar de um documento novo.
 */
export async function getPontosEfetivos() {
  const padrao = { postarNoFeed: PONTOS.postarNoFeed };
  todasAsMissoesPadrao().forEach((m) => {
    padrao[m.id] = m.pontos;
  });

  try {
    const snap = await getDoc(doc(db, ...CONFIG_REF_PATH));
    const overrides = snap.exists() ? snap.data() : {};
    return { ...padrao, ...overrides };
  } catch (err) {
    console.error('Não foi possível carregar ajustes de pontos, usando padrão:', err);
    return padrao;
  }
}

/**
 * Retorna os pontos efetivos de UMA missão específica (usado no momento de
 * creditar pontos, pra garantir que o valor mais atual seja usado mesmo que
 * a tela não tenha recarregado a lista inteira).
 */
export async function getPontosEfetivosDeUmaMissao(missaoId, pontosPadrao) {
  try {
    const snap = await getDoc(doc(db, ...CONFIG_REF_PATH));
    if (snap.exists() && typeof snap.data()[missaoId] === 'number') {
      return snap.data()[missaoId];
    }
  } catch (err) {
    console.error('Não foi possível carregar ajuste de pontos, usando padrão:', err);
  }
  return pontosPadrao;
}

/**
 * Usado pelo Painel Admin para salvar um novo valor de pontos pra uma
 * missão específica. Só deve ser chamado por um usuário admin (a regra de
 * segurança do Firestore também exige isso, como dupla proteção).
 */
export async function salvarPontosDaMissao(missaoId, novoValor) {
  const atual = await getPontosEfetivos();
  await setDoc(doc(db, ...CONFIG_REF_PATH), { ...atual, [missaoId]: novoValor });
}

/**
 * Pontos efetivos (padrão OU ajustado pelo admin) de um post espontâneo no
 * feed. Reaproveita getPontosEfetivosDeUmaMissao — a chave "postarNoFeed"
 * fica salva no mesmo documento config/missionPoints das missões.
 */
export async function getPontosEfetivosPostarNoFeed() {
  return getPontosEfetivosDeUmaMissao('postarNoFeed', PONTOS.postarNoFeed);
}
