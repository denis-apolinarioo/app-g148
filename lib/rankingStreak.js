// ============================================================================
// "Planando como Águia" — dias seguidos em 1º lugar no ranking.
// ----------------------------------------------------------------------------
// LIMITAÇÃO CONHECIDA E ACEITA: o pedido original era "3 dias seguidos, 72h
// consecutivas, zera se sair mesmo 1 segundo". Sem Cloud Functions/cron (o
// app não usa), não tem como vigiar a posição da pessoa o tempo todo — só dá
// pra checar quando ALGUÉM abre a tela de Ranking. Este arquivo implementa
// uma aproximação por DIA (fuso Brasília): se a pessoa está em 1º hoje e
// também esteve em 1º ontem (ou já é a mesma checagem de hoje), o contador
// sobe; se não está em 1º, zera. Não é "nem 1 segundo fora", é "esteve em 1º
// em algum momento de cada um dos últimos N dias". Pra virar precisão de
// segundo de verdade, precisaria de um job rodando no servidor 24h — se um
// dia quiser isso, é só pedir.
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
 * Chamada pela tela de Ranking (app/(app)/ranking/page.js) toda vez que ela
 * carrega, informando se a pessoa logada está em 1º lugar AGORA.
 */
export async function atualizarStreakTop1(uid, estaEm1Lugar) {
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  const dados = snap.data() || {};
  const diasAtual = dados.top1DiasSeguidos || 0;
  const ultimoDia = dados.top1UltimoDia || null;
  const hoje = todayBrasilia();

  if (!estaEm1Lugar) {
    // Caiu do 1º lugar — zera, mas só escreve se realmente havia algo pra zerar.
    if (diasAtual > 0 || ultimoDia) {
      await updateDoc(userRef, { top1DiasSeguidos: 0, top1UltimoDia: null });
    }
    return;
  }

  if (ultimoDia === hoje) return; // já contou hoje, nada a fazer

  const seguidoDeOntem = ultimoDia === diaAnterior(hoje);
  const novoValor = seguidoDeOntem ? diasAtual + 1 : 1;

  await updateDoc(userRef, { top1DiasSeguidos: novoValor, top1UltimoDia: hoje });

  try {
    await verificarConquistas(uid, 0, 'ranking_top1');
  } catch (err) {
    console.error('Erro ao checar conquista de ranking:', err);
  }
}
