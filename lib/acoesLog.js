// ============================================================================
// FASE 2 — Log central de ações.
// ----------------------------------------------------------------------------
// Toda vez que o app registra uma ação ligada a uma categoria configurável
// (lib/categoriasAcaoRepo.js), a gravação passa por aqui: credita pontos e/ou
// Dracma conforme a categoria (respeitando o limite, se houver) e grava UMA
// entrada em `acoesLog` — o registro que permite contar qualquer categoria
// nova automaticamente, inclusive pra conquistas (ver contadorTipo
// 'categoria:<id>' em lib/achievements.js).
//
// Mesmas duas proteções de sempre (ver comentário no topo de lib/points.js):
// 1) toda alteração de pontos/Dracma usa runTransaction / creditarDracma
//    (que já é transacional), evitando race condition;
// 2) o limite por período é reforçado consultando o próprio acoesLog — a
//    entrada é gravada mesmo quando a ação já passou do limite (com
//    pontosGanhos/dracmaGanho zerados), pra que o contador de "quantas vezes
//    fez essa categoria" (achievements) sempre reflita o total real de
//    ações, não só as que pontuaram.
//
// LIMITAÇÃO CONHECIDA E ACEITA: igual ao resto do app (ver pointsLog/
// dracmaLog), a checagem de limite lê o histórico e decide no cliente antes
// de gravar — não é uma trava atômica de banco. Pra uma comunidade pequena e
// de confiança, o risco de alguém burlar isso enviando requisições em
// paralelo é aceito (mesmo padrão já usado em todo o resto do app).
//
// Consulta por período SEM índice composto: como o resto do projeto já
// decidiu (ver comentário no topo de lib/points.js/lib/dracma.js sobre
// evitar índices compostos), a contagem por categoria+período busca só por
// `uid` (índice simples, sempre disponível) e filtra categoria/período no
// cliente — a coleção é pequena por pessoa, então isso não vira gargalo.
// ============================================================================
import { doc, addDoc, collection, runTransaction, serverTimestamp, increment, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { getCategoriaAcaoPorId } from './categoriasAcaoRepo';
import { creditarDracma } from './dracma';
import { todayBrasilia, currentWeekId, currentMonthId } from './dateUtils';

function periodoIdAtual(limitePeriodo) {
  if (limitePeriodo === 'dia') return todayBrasilia();
  if (limitePeriodo === 'semana') return currentWeekId();
  if (limitePeriodo === 'mes') return currentMonthId();
  return 'sempre';
}

/**
 * Conta quantas vezes `uid` já fez a categoria `categoriaId` dentro do
 * período atual (de acordo com `limitePeriodo`). Usado só pra checar limite
 * — ver `contarAcoesCategoriaTotal` abaixo pra contagem total (conquistas).
 */
async function contarAcoesNoPeriodo(uid, categoriaId, limitePeriodo) {
  const alvo = periodoIdAtual(limitePeriodo);
  const q = query(collection(db, 'acoesLog'), where('uid', '==', uid));
  const snap = await getDocs(q);
  return snap.docs.filter((d) => {
    const dados = d.data();
    return dados.categoriaId === categoriaId && dados.periodoId === alvo;
  }).length;
}

/**
 * Contagem TOTAL (todo o histórico, ignorando período) de quantas vezes
 * `uid` fez a categoria `categoriaId` — usada pelo contadorTipo
 * 'categoria:<id>' de lib/achievements.js.
 */
export async function contarAcoesCategoriaTotal(uid, categoriaId) {
  const q = query(collection(db, 'acoesLog'), where('uid', '==', uid));
  const snap = await getDocs(q);
  return snap.docs.filter((d) => d.data().categoriaId === categoriaId).length;
}

/**
 * Registra uma ação ligada a uma categoria configurável. Chamada depois que
 * a ação em si já aconteceu (ex.: o post já foi criado) — nunca trava a
 * criação por causa de uma categoria mal configurada ou apagada: se a
 * categoria não existir mais ou estiver inativa, a ação é registrada mesmo
 * assim (sem pontuar), pra manter o histórico consistente.
 *
 * `origemTipo`/`origemId` identificam de onde veio a ação (ex.: 'post' e o
 * ID do post) — guardados só pra auditoria/rastreio, não afetam a lógica.
 *
 * Retorna { pontosGanhos, dracmaGanho, limiteAtingido } — quem chama usa
 * isso pra, por exemplo, gravar pontosGanhos/dracmaGanho no próprio post
 * (permite desfazer exatamente esse valor se o post for apagado depois,
 * mesmo padrão de pontuarPostFeed em lib/points.js).
 */
export async function registrarAcaoCategoria(uid, categoriaId, origemTipo, origemId) {
  const categoria = await getCategoriaAcaoPorId(categoriaId);

  if (!categoria || categoria.ativa === false) {
    return { pontosGanhos: 0, dracmaGanho: 0, limiteAtingido: false };
  }

  let limiteAtingido = false;
  if (categoria.temLimite) {
    const quantidadeNoPeriodo = await contarAcoesNoPeriodo(uid, categoriaId, categoria.limitePeriodo);
    limiteAtingido = quantidadeNoPeriodo >= (Number(categoria.limiteQtd) || 1);
  }

  const pontosGanhos = !limiteAtingido && categoria.pontua ? Number(categoria.pontos) || 0 : 0;
  const dracmaGanho = !limiteAtingido && categoria.daDracma ? Number(categoria.dracma) || 0 : 0;

  if (pontosGanhos > 0) {
    const userRef = doc(db, 'users', uid);
    const logRef = doc(collection(db, 'pointsLog'));
    await runTransaction(db, async (transaction) => {
      transaction.update(userRef, { pontos: increment(pontosGanhos) });
      transaction.set(logRef, {
        uid,
        tipo: 'categoria',
        valor: pontosGanhos,
        descricao: categoria.nome,
        referenciaId: origemId || null,
        createdAt: serverTimestamp(),
      });
    });
  }

  if (dracmaGanho > 0) {
    await creditarDracma(uid, dracmaGanho, 'categoria', categoria.nome, origemId || null);
  }

  await addDoc(collection(db, 'acoesLog'), {
    uid,
    categoriaId,
    categoriaNome: categoria.nome,
    origemTipo: origemTipo || null,
    origemId: origemId || null,
    periodoId: categoria.temLimite ? periodoIdAtual(categoria.limitePeriodo) : null,
    pontosGanhos,
    dracmaGanho,
    createdAt: serverTimestamp(),
  });

  return { pontosGanhos, dracmaGanho, limiteAtingido };
}
