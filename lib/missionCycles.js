// ============================================================================
// NOVO MODELO DE PERÍODO DAS MISSÕES — substitui o antigo enum fixo
// `periodicidade: 'diaria' | 'semanal' | 'mensal'`.
//
// Agora cada missão tem:
//   - dataInicio           (string 'YYYY-MM-DD') — quando o 1º ciclo começa
//   - duracaoDias          (number, mínimo 1)     — quantos dias dura 1 ciclo
//   - repeteAutomaticamente (boolean)             — se um novo ciclo começa
//     automaticamente no dia seguinte ao fim do ciclo anterior, indefinidamente
//   - vezesPorPeriodo      (number, mínimo 1)     — quantas vezes dá pra
//     cumprir a missão DENTRO de cada ciclo
//
// Este arquivo só calcula QUAL é o ciclo atual de uma missão (ou se ela
// ainda não começou / já encerrou). Quem usa esse cálculo pra travar/liberar
// o envio é lib/points.js.
// ============================================================================
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { todayBrasilia } from './dateUtils';

function paraData(diaISO) {
  return new Date(`${diaISO}T00:00:00-03:00`);
}

function paraISO(data) {
  return data.toISOString().slice(0, 10);
}

/**
 * Calcula o ciclo atual de uma missão numa data de referência (padrão: hoje,
 * horário de Brasília). Retorna `null` quando a missão não está "aberta"
 * agora — seja porque `dataInicio` ainda não chegou, seja porque o ciclo
 * único já passou e `repeteAutomaticamente` é falso (nesse caso a missão
 * fica automaticamente indisponível, sem precisar o Admin desativar à mão).
 *
 * Quando aberta, retorna `{ cicloId, indiceCiclo }` — `cicloId` é a data
 * (YYYY-MM-DD) em que o ciclo atual começou, usada como parte do ID do
 * documento de submissão (mesmo papel que `hoje`/`semana`/`mes` tinham antes).
 */
export function calcularCicloAtual(missao, dataReferencia = todayBrasilia()) {
  if (!missao?.dataInicio || !missao?.duracaoDias) return null;

  const inicio = paraData(missao.dataInicio);
  const hoje = paraData(dataReferencia);
  const diffDias = Math.floor((hoje - inicio) / 86400000);

  if (diffDias < 0) return null; // ainda não começou

  const duracao = Math.max(1, Number(missao.duracaoDias) || 1);
  const indiceCiclo = Math.floor(diffDias / duracao);

  if (indiceCiclo > 0 && !missao.repeteAutomaticamente) return null; // já encerrou, não repete

  const inicioCiclo = new Date(inicio);
  inicioCiclo.setDate(inicioCiclo.getDate() + indiceCiclo * duracao);

  return { cicloId: paraISO(inicioCiclo), indiceCiclo };
}

/**
 * Status "amigável" de uma missão pra exibição na tela (usado pelo Admin,
 * que precisa ver todas — inclusive as que ainda não começaram ou já
 * encerraram — pra saber o que está acontecendo com cada uma).
 * Retorna: 'nao_iniciada' | 'ativa' | 'encerrada'.
 */
export function statusDaMissao(missao, dataReferencia = todayBrasilia()) {
  if (!missao?.dataInicio || !missao?.duracaoDias) return 'nao_iniciada';
  if (missao.dataInicio > dataReferencia) return 'nao_iniciada';
  const ciclo = calcularCicloAtual(missao, dataReferencia);
  return ciclo ? 'ativa' : 'encerrada';
}

/**
 * Quantas vezes o usuário já cumpriu a missão NO CICLO ATUAL, e se ainda
 * pode cumprir de novo. Usado na tela de Missões do usuário pra mostrar
 * "2/5 hoje" e travar o card quando o limite do período for atingido.
 * Se a missão não estiver aberta agora, volta `{ usadas: 0, limite: 0,
 * esgotada: true, cicloId: null }` — o card nem deveria estar sendo
 * mostrado nesse caso (ver getMissoesVisiveisAgora em missionsRepo.js).
 */
export async function statusDoCicloParaUsuario(uid, missao) {
  const ciclo = calcularCicloAtual(missao);
  if (!ciclo) return { usadas: 0, limite: 0, esgotada: true, cicloId: null };

  const limite = Math.max(1, Number(missao.vezesPorPeriodo) || 1);
  const q = query(
    collection(db, 'missionSubmissions'),
    where('uid', '==', uid),
    where('missaoId', '==', missao.id),
    where('cicloId', '==', ciclo.cicloId)
  );
  const snap = await getDocs(q);
  const usadas = snap.size;
  return { usadas, limite, esgotada: usadas >= limite, cicloId: ciclo.cicloId };
}

/**
 * Versão em lote de statusDoCicloParaUsuario, pra não disparar N consultas
 * sequenciais na tela de Missões — roda todas em paralelo e devolve um
 * objeto { missaoId: status }.
 */
export async function getStatusMissoesNoCiclo(uid, missoes) {
  const resultados = {};
  await Promise.all(
    missoes.map(async (missao) => {
      resultados[missao.id] = await statusDoCicloParaUsuario(uid, missao);
    })
  );
  return resultados;
}

/**
 * Botão "encaminhar" do MissionCard — busca os posts que a pessoa já gerou
 * cumprindo esta missão DENTRO do ciclo atual (mais recente primeiro), pra
 * levar direto pra eles em vez da pessoa precisar procurar no Feed/perfil.
 *
 * CORREÇÃO DE BUG: antes só entravam submissões que geraram post NO FEED
 * (`postId` preenchido) — uma missão com postaNoFeed:false nunca tinha
 * `postId`, então o botão "encaminhar" não fazia nada nela (não tinha post
 * pra abrir, e por isso o botão de voltar da tela de post individual nunca
 * chegava a entrar em cena). Agora TODA missão cumprida gera um post (ver
 * criarPostDeMissao em lib/points.js) — as que não postam no Feed geram um
 * com `missaoSemFeed:true` (não aparece em Feed/Busca/Perfil, sem
 * curtida/comentário — ver PostCard.js), mas ele ainda tem `postId`, então
 * ainda entra aqui: é só o que precisa pra "encaminhar" e depois apagar
 * (botão excluir do PostCard). O filtro abaixo continua existindo por
 * causa de submissões ANTIGAS (de antes desta correção), que ainda podem
 * ter `postId` vazio.
 */
export async function getSubmissoesDoCicloComPost(uid, missao) {
  const ciclo = calcularCicloAtual(missao);
  if (!ciclo) return [];

  const q = query(
    collection(db, 'missionSubmissions'),
    where('uid', '==', uid),
    where('missaoId', '==', missao.id),
    where('cicloId', '==', ciclo.cicloId)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((s) => s.postId)
    .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
}
