// ============================================================================
// FASE 2 — Log central de ações.
// ----------------------------------------------------------------------------
// Toda vez que o app registra uma ação ligada a uma categoria configurável
// (lib/categoriasAcaoRepo.js), a gravação passa por aqui: credita pontos e/ou
// Dracma conforme a categoria (respeitando o limite de CADA UM, se houver) e
// grava UMA entrada em `acoesLog` — o registro que permite contar qualquer
// categoria nova automaticamente, inclusive pra conquistas (ver contadorTipo
// 'categoria:<id>' em lib/achievements.js) e pra busca "quem fez o quê" na
// aba Ações do painel Admin.
//
// LIMITE INDEPENDENTE PONTOS x DRACMA — cada categoria pode ter um teto de
// vezes/período diferente pra pontos e pra Dracma (ex.: pontua toda vez, mas
// só dá Dracma 1x por semana). Pra isso funcionar sem precisar de um campo
// de período por moeda em cada entrada, toda entrada do log guarda os TRÊS
// "IDs de período" de quando foi criada (dia/semana/mês) — contarNoPeriodo()
// abaixo escolhe qual campo olhar de acordo com o período configurado em
// CADA limite (pontos e Dracma podem escolher períodos diferentes um do
// outro sem conflito).
//
// Mesmas duas proteções de sempre (ver comentário no topo de lib/points.js):
// 1) toda alteração de pontos/Dracma usa runTransaction / creditarDracma
//    (que já é transacional), evitando race condition;
// 2) o limite por período é reforçado consultando o próprio acoesLog — a
//    entrada é gravada mesmo quando a ação já passou do limite (com
//    pontosGanhos/dracmaGanho zerados), pra que o contador de "quantas vezes
//    fez essa categoria" (achievements, busca por pessoa) sempre reflita o
//    total real de ações, não só as que pontuaram.
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
// cliente — a coleção é pequena por pessoa, então isso não vira gargalo. A
// MESMA leitura (uma vez só) é reaproveitada pra checar o limite de pontos
// E de Dracma, em vez de ler o Firestore duas vezes.
//
// COMPATIBILIDADE: entradas gravadas antes dessa mudança não têm
// periodoDia/periodoSemana/periodoMes (só o antigo `periodoId`) — elas
// simplesmente não entram na contagem de limites por período novos (mas
// continuam contando pro total histórico, usado por
// contarAcoesCategoriaTotal). Como qualquer limite por período reseta a
// cada novo dia/semana/mês, isso não muda nada pra quem já estava usando o
// app — não precisou de nenhum botão de migração pra isso.
// ============================================================================
import { doc, addDoc, collection, runTransaction, serverTimestamp, increment, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { getCategoriaAcaoPorId } from './categoriasAcaoRepo';
import { creditarDracma } from './dracma';
import { todayBrasilia, currentWeekId, currentMonthId } from './dateUtils';

const CAMPO_POR_PERIODO = {
  dia: 'periodoDia',
  semana: 'periodoSemana',
  mes: 'periodoMes',
};

function periodoIdAtual(tipoPeriodo) {
  if (tipoPeriodo === 'dia') return todayBrasilia();
  if (tipoPeriodo === 'semana') return currentWeekId();
  if (tipoPeriodo === 'mes') return currentMonthId();
  return 'sempre';
}

/**
 * Conta, dentro de uma lista de entradas do acoesLog já buscada (todas de
 * um mesmo `uid`), quantas são da categoria `categoriaId` e caem no período
 * atual de acordo com `tipoPeriodo` ('dia' | 'semana' | 'mes' | 'sempre').
 */
function contarNoPeriodo(entradas, categoriaId, tipoPeriodo) {
  if (tipoPeriodo === 'sempre' || !tipoPeriodo) {
    return entradas.filter((e) => e.categoriaId === categoriaId).length;
  }
  const campo = CAMPO_POR_PERIODO[tipoPeriodo];
  const alvo = periodoIdAtual(tipoPeriodo);
  return entradas.filter((e) => e.categoriaId === categoriaId && e[campo] === alvo).length;
}

/**
 * Contagem TOTAL (todo o histórico, ignorando período) de quantas vezes
 * `uid` fez a categoria `categoriaId` — usada pelo contadorTipo
 * 'categoria:<id>' de lib/achievements.js.
 *
 * ATUALIZAÇÃO CONQUISTAS — `desde` (Date opcional) filtra só ações a partir
 * dali, usado pelos modos "Obtido Durante o Período"/"A Partir do
 * Lançamento" de uma conquista com múltiplos contadores. Parâmetro
 * opcional: chamada sem ele continua contando o histórico inteiro, igual
 * sempre funcionou.
 */
export async function contarAcoesCategoriaTotal(uid, categoriaId, desde = null) {
  const q = query(collection(db, 'acoesLog'), where('uid', '==', uid));
  const snap = await getDocs(q);
  return snap.docs.filter((d) => {
    const dados = d.data();
    if (dados.categoriaId !== categoriaId) return false;
    if (desde && !(dados.createdAt?.toDate?.() >= desde)) return false;
    return true;
  }).length;
}

/**
 * Busca TODAS as ações de categoria de `uid`, já agrupadas por categoria
 * (quantas vezes usou cada uma e quando foi a última vez) — base da busca
 * "por pessoa" em Admin > Ações > Ações específicas.
 */
export async function buscarAcoesPorUsuarioAgrupado(uid) {
  const q = query(collection(db, 'acoesLog'), where('uid', '==', uid));
  const snap = await getDocs(q);

  const porCategoria = {};
  snap.docs.forEach((d) => {
    const dados = d.data();
    const chave = dados.categoriaId;
    if (!chave) return;
    if (!porCategoria[chave]) {
      porCategoria[chave] = {
        categoriaId: chave,
        categoriaNome: dados.categoriaNome || chave,
        quantidade: 0,
        ultimaData: null,
      };
    }
    porCategoria[chave].quantidade += 1;
    const dataAtual = dados.createdAt?.toMillis?.() || 0;
    const dataGuardada = porCategoria[chave].ultimaData?.toMillis?.() || 0;
    if (dataAtual >= dataGuardada) porCategoria[chave].ultimaData = dados.createdAt;
  });

  return Object.values(porCategoria).sort((a, b) => b.quantidade - a.quantidade);
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
 * Retorna { pontosGanhos, dracmaGanho, pontosLimiteAtingido,
 * dracmaLimiteAtingido } — quem chama usa isso pra, por exemplo, gravar
 * pontosGanhos/dracmaGanho no próprio post (permite desfazer exatamente
 * esse valor se o post for apagado depois, mesmo padrão de pontuarPostFeed
 * em lib/points.js).
 */
export async function registrarAcaoCategoria(uid, categoriaId, origemTipo, origemId) {
  const categoria = await getCategoriaAcaoPorId(categoriaId);

  if (!categoria || categoria.ativa === false) {
    return { pontosGanhos: 0, dracmaGanho: 0, pontosLimiteAtingido: false, dracmaLimiteAtingido: false };
  }

  // Uma leitura só do histórico do usuário, reaproveitada pros dois limites
  // (pontos e Dracma) em vez de consultar o Firestore duas vezes.
  const q = query(collection(db, 'acoesLog'), where('uid', '==', uid));
  const snap = await getDocs(q);
  const entradas = snap.docs.map((d) => d.data());

  let pontosLimiteAtingido = false;
  if (categoria.pontosTemLimite) {
    const quantidade = contarNoPeriodo(entradas, categoriaId, categoria.pontosLimitePeriodo);
    pontosLimiteAtingido = quantidade >= (Number(categoria.pontosLimiteQtd) || 1);
  }

  let dracmaLimiteAtingido = false;
  if (categoria.dracmaTemLimite) {
    const quantidade = contarNoPeriodo(entradas, categoriaId, categoria.dracmaLimitePeriodo);
    dracmaLimiteAtingido = quantidade >= (Number(categoria.dracmaLimiteQtd) || 1);
  }

  const pontosGanhos = !pontosLimiteAtingido && categoria.pontua ? Number(categoria.pontos) || 0 : 0;
  const dracmaGanho = !dracmaLimiteAtingido && categoria.daDracma ? Number(categoria.dracma) || 0 : 0;

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
    periodoDia: todayBrasilia(),
    periodoSemana: currentWeekId(),
    periodoMes: currentMonthId(),
    pontosGanhos,
    dracmaGanho,
    pontosLimiteAtingido,
    dracmaLimiteAtingido,
    createdAt: serverTimestamp(),
  });

  return { pontosGanhos, dracmaGanho, pontosLimiteAtingido, dracmaLimiteAtingido };
}
