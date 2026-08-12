// ============================================================================
// "Planando como Águia" — dias seguidos no TOPO do ranking. ATUALIZAÇÃO
// CONQUISTAS: antes só existia a faixa de 1º lugar; agora o mesmo mecanismo
// também acompanha Top 3 e Top 10, nas 3 faixas ao mesmo tempo.
// ----------------------------------------------------------------------------
// LIMITAÇÃO CONHECIDA E ACEITA: o pedido original era "3 dias seguidos, 72h
// consecutivas, zera se sair mesmo 1 segundo". Sem Cloud Functions/cron (o
// app não usa), não tem como vigiar a posição da pessoa o tempo todo — só dá
// pra checar quando ALGUÉM abre a tela de Ranking. Este arquivo implementa
// uma aproximação por DIA (fuso Brasília): se a pessoa está numa faixa hoje e
// também esteve nela ontem (ou já é a mesma checagem de hoje), o contador
// sobe; se não está mais, zera. Não é "nem 1 segundo fora", é "esteve na
// faixa em algum momento de cada um dos últimos N dias". Pra virar precisão
// de segundo de verdade, precisaria de um job rodando no servidor 24h — se
// um dia quiser isso, é só pedir.
// ============================================================================
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { todayBrasilia } from './dateUtils';
import { verificarConquistas } from './achievements';

function diaAnterior(dataStr) {
  const [ano, mes, dia] = dataStr.split('-').map(Number);
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Calcula o novo valor de UMA faixa (1º, Top 3 ou Top 10) a partir do estado
 * salvo — mesma lógica de sempre (ver histórico deste arquivo), só extraída
 * pra reutilizar nas 3 faixas sem repetir o mesmo código 3 vezes. Retorna
 * `mudou: false` quando não há nada novo pra gravar (já contou hoje, ou já
 * estava zerado e continua fora da faixa) — evita um updateDoc à toa.
 */
function calcularNovaFaixa(dentroDaFaixa, diasAtual, ultimoDia, hoje) {
  if (!dentroDaFaixa) {
    if (diasAtual > 0 || ultimoDia) return { dias: 0, ultimoDia: null, mudou: true };
    return { dias: diasAtual, ultimoDia, mudou: false };
  }
  if (ultimoDia === hoje) return { dias: diasAtual, ultimoDia, mudou: false }; // já contou hoje
  const seguidoDeOntem = ultimoDia === diaAnterior(hoje);
  return { dias: seguidoDeOntem ? diasAtual + 1 : 1, ultimoDia: hoje, mudou: true };
}

/**
 * Chamada pela tela de Ranking (app/(app)/ranking/page.js) toda vez que ela
 * carrega, informando a POSIÇÃO (1 = primeiro lugar) da pessoa logada AGORA.
 * Atualiza as 3 faixas (1º, Top 3, Top 10) num update só (quando alguma
 * muda) e dispara a checagem de conquistas relacionadas.
 *
 * Nome antigo desta função era `atualizarStreakTop1(uid, estaEm1Lugar)`
 * (recebia um booleano, só cuidava do 1º lugar) — renomeada e com a
 * assinatura trocada pra posição (número) por causa do Top 3/Top 10 novos;
 * o único call site (app/(app)/ranking/page.js) foi atualizado junto.
 */
export async function atualizarStreaksRanking(uid, posicao) {
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  const dados = snap.data() || {};
  const hoje = todayBrasilia();

  const top1 = calcularNovaFaixa(posicao === 1, dados.top1DiasSeguidos || 0, dados.top1UltimoDia || null, hoje);
  const top3 = calcularNovaFaixa(posicao >= 1 && posicao <= 3, dados.top3DiasSeguidos || 0, dados.top3UltimoDia || null, hoje);
  const top10 = calcularNovaFaixa(posicao >= 1 && posicao <= 10, dados.top10DiasSeguidos || 0, dados.top10UltimoDia || null, hoje);

  const camposMudados = {};
  if (top1.mudou) {
    camposMudados.top1DiasSeguidos = top1.dias;
    camposMudados.top1UltimoDia = top1.ultimoDia;
  }
  if (top3.mudou) {
    camposMudados.top3DiasSeguidos = top3.dias;
    camposMudados.top3UltimoDia = top3.ultimoDia;
  }
  if (top10.mudou) {
    camposMudados.top10DiasSeguidos = top10.dias;
    camposMudados.top10UltimoDia = top10.ultimoDia;
  }

  if (Object.keys(camposMudados).length > 0) {
    await updateDoc(userRef, camposMudados);
  }

  // Só vale a pena checar conquista quando a pessoa está em alguma das 3
  // faixas agora — caindo fora de todas elas, nenhuma checagem pode
  // desbloquear coisa nova (só zera, o que já foi gravado acima).
  if (posicao >= 1 && posicao <= 10) {
    try {
      await verificarConquistas(uid, 0, 'ranking_top1');
    } catch (err) {
      console.error('Erro ao checar conquista de ranking:', err);
    }
  }
}
