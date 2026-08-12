// ============================================================================
// Ajuste de pontos/Dracma das "ações básicas" (fora as missões e fora as
// categorias de post — hoje "postarNoFeed", "orarPorAlguem" e
// "abrirVersiculo") que o Admin pode alterar depois que o app já está no
// ar, sem precisar editar código.
//
// Cada ação básica guarda { pontua, pontos, daDracma, dracma } — MESMO
// formato usado pelas categorias de post (ver lib/categoriasAcaoRepo.js),
// pra manter a mesma linguagem em todo o painel Admin: "pontua"/"pontos"
// controla os Pontos de Comunhão, "daDracma"/"dracma" controla o Dracma,
// cada um pode ser ligado/desligado e configurado de forma independente.
//
// COMPATIBILIDADE — antes desta mudança, config/missionPoints guardava só
// um número solto por ação (ex.: `postarNoFeed: 5`), sempre pontuando,
// nunca dando Dracma. normalizarAcaoBasica() abaixo lê esse formato antigo
// sem quebrar nada; assim que o Admin salvar de novo, já grava no formato
// novo.
//
// ATUALIZAÇÃO: os pontos de CADA MISSÃO moram direto no documento da
// missão (coleção "missoes", campo `pontos` — ver lib/missionsRepo.js), já
// que o Admin edita a missão inteira pelo painel (aba "Missões"). Por isso
// esse arquivo não guarda "override de pontos de missão" — só o das 3
// ações básicas que não têm documento próprio.
// ============================================================================
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { PONTOS } from './constants';
import { registrarAcaoAdmin } from './adminLog';
import { reportarConexaoOk, reportarErroConexao } from './connectivity';

const CONFIG_REF_PATH = ['config', 'missionPoints'];

const ROTULOS_ACAO_BASICA = {
  postarNoFeed: 'Post no Feed',
  orarPorAlguem: 'Orar por alguém',
  abrirVersiculo: 'Abrir o Verso do Dia',
};

function padraoAcaoBasica(id) {
  return {
    pontua: true,
    pontos: PONTOS[id] || 0,
    daDracma: false,
    dracma: 0,
  };
}

/**
 * Aceita tanto o formato ANTIGO salvo em config/missionPoints (um número
 * solto = só pontos, sempre habilitado) quanto o NOVO ({pontua, pontos,
 * daDracma, dracma}). Sempre retorna o formato novo.
 */
function normalizarAcaoBasica(valorSalvo, id) {
  const padrao = padraoAcaoBasica(id);
  if (typeof valorSalvo === 'number') {
    return { ...padrao, pontua: true, pontos: valorSalvo };
  }
  if (valorSalvo && typeof valorSalvo === 'object') {
    return {
      pontua: valorSalvo.pontua ?? padrao.pontua,
      pontos: typeof valorSalvo.pontos === 'number' ? valorSalvo.pontos : padrao.pontos,
      daDracma: valorSalvo.daDracma ?? padrao.daDracma,
      dracma: typeof valorSalvo.dracma === 'number' ? valorSalvo.dracma : padrao.dracma,
    };
  }
  return padrao;
}

async function getOverridesSalvos() {
  try {
    const snap = await getDoc(doc(db, ...CONFIG_REF_PATH));
    return snap.exists() ? snap.data() : {};
  } catch (err) {
    console.error('Não foi possível carregar ajustes de pontos/Dracma, usando padrão:', err);
    return {};
  }
}

/**
 * Config completa (pontua/pontos/daDracma/dracma) de UMA ação básica.
 */
export async function getConfigAcaoBasica(id) {
  const overrides = await getOverridesSalvos();
  return normalizarAcaoBasica(overrides[id], id);
}

/**
 * Config completa das 3 ações básicas de uma vez — usado pelo painel Admin
 * (aba Ações) pra desenhar a tela sem precisar de 1 leitura por ação.
 */
export async function getConfigsAcoesBasicas() {
  const overrides = await getOverridesSalvos();
  return Object.keys(ROTULOS_ACAO_BASICA).reduce((acc, id) => {
    acc[id] = normalizarAcaoBasica(overrides[id], id);
    return acc;
  }, {});
}

/**
 * Versão "ao vivo" de getConfigsAcoesBasicas — escuta o documento único
 * config/missionPoints via onSnapshot em vez de buscar uma vez, pro painel
 * Admin (aba Ações > Ações Básicas) refletir mudanças na hora, sem
 * sair-e-voltar. Retorna a função de cancelar a escuta.
 */
export function subscribeAConfigsAcoesBasicas(callback) {
  return onSnapshot(
    doc(db, ...CONFIG_REF_PATH),
    (snap) => {
      reportarConexaoOk();
      const overrides = snap.exists() ? snap.data() : {};
      callback(
        Object.keys(ROTULOS_ACAO_BASICA).reduce((acc, id) => {
          acc[id] = normalizarAcaoBasica(overrides[id], id);
          return acc;
        }, {})
      );
    },
    (err) => {
      console.error('[subscribeAConfigsAcoesBasicas] Erro na escuta em tempo real:', err);
      reportarErroConexao();
    }
  );
}

/**
 * Pontos efetivos concedidos por uma ação básica agora mesmo (0 se o Admin
 * desligou "Pontua" pra ela). Usado por lib/points.js.
 */
async function getPontosEfetivosAcaoBasica(id) {
  const config = await getConfigAcaoBasica(id);
  return config.pontua ? Number(config.pontos) || 0 : 0;
}

/**
 * Dracma efetivo concedido por uma ação básica agora mesmo (0 se o Admin
 * não ligou "Dá Dracma" pra ela). Usado por lib/points.js.
 */
async function getDracmaEfetivoAcaoBasica(id) {
  const config = await getConfigAcaoBasica(id);
  return config.daDracma ? Number(config.dracma) || 0 : 0;
}

export const getPontosEfetivosPostarNoFeed = () => getPontosEfetivosAcaoBasica('postarNoFeed');
export const getDracmaEfetivoPostarNoFeed = () => getDracmaEfetivoAcaoBasica('postarNoFeed');

export const getPontosEfetivosOrarPorAlguem = () => getPontosEfetivosAcaoBasica('orarPorAlguem');
export const getDracmaEfetivoOrarPorAlguem = () => getDracmaEfetivoAcaoBasica('orarPorAlguem');

export const getPontosEfetivosAbrirVersiculo = () => getPontosEfetivosAcaoBasica('abrirVersiculo');
export const getDracmaEfetivoAbrirVersiculo = () => getDracmaEfetivoAcaoBasica('abrirVersiculo');

/**
 * Usado pelo Painel Admin (aba Ações) pra salvar a config nova de uma ação
 * básica ('postarNoFeed' | 'orarPorAlguem' | 'abrirVersiculo'). Só deve ser
 * chamado por um usuário admin (a regra de segurança do Firestore também
 * exige isso, como dupla proteção).
 */
export async function salvarConfigAcaoBasica(id, novaConfig, admin) {
  const snap = await getDoc(doc(db, ...CONFIG_REF_PATH));
  const atual = snap.exists() ? snap.data() : {};
  const valorAntes = normalizarAcaoBasica(atual[id], id);

  const config = {
    pontua: !!novaConfig.pontua,
    pontos: novaConfig.pontua ? Number(novaConfig.pontos) || 0 : 0,
    daDracma: !!novaConfig.daDracma,
    dracma: novaConfig.daDracma ? Number(novaConfig.dracma) || 0 : 0,
  };

  await setDoc(doc(db, ...CONFIG_REF_PATH), { ...atual, [id]: config });

  if (admin) {
    const descrever = (c) =>
      [c.pontua ? `${c.pontos} ponto(s)` : null, c.daDracma ? `${c.dracma} Dracma` : null]
        .filter(Boolean)
        .join(' + ') || 'não pontua nem dá Dracma';

    await registrarAcaoAdmin({
      admin,
      acao: 'ajustar_pontos_acao',
      alvoTipo: 'config',
      alvoId: id,
      valorAntes: descrever(valorAntes),
      valorDepois: descrever(config),
      detalhes: ROTULOS_ACAO_BASICA[id] || id,
    });
  }

  return config;
}
