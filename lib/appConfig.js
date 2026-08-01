// ============================================================================
// Central de configurações do app (item 11 do Bloco 4) — ponto único de
// leitura/escrita pra configurações gerais do app que não são "pontos de
// missão" (isso já mora em lib/missionOverrides.js, na aba Ações).
// ----------------------------------------------------------------------------
// Guardado em config/appSettings, reaproveitando a regra que já existe pra
// coleção `config` inteira no firestore.rules (leitura liberada pra quem
// está logado, escrita só admin) — não precisa de nenhuma alteração manual
// no Firebase Console.
//
// Hoje não existe nenhuma configuração de verdade ainda — isso é só a base
// (ler, salvar e registrar no histórico de ações do admin) que o item 12º
// vai usar pra guardar as primeiras opções de verdade.
// ============================================================================
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { registrarAcaoAdmin } from './adminLog';

const CONFIG_REF_PATH = ['config', 'appSettings'];

// Item 12 do Bloco 5 — chave da 1ª configuração de verdade guardada aqui:
// liga/desliga, pra todo mundo, a função de bloquear/desbloquear usuário
// (item 18). Some do documento até o Admin mexer no toggle pela 1ª vez, por
// isso o padrão (quando a chave ainda não existe) é `true` — mantém o
// comportamento de hoje, ninguém perde a função sem o Admin desligar.
export const CHAVE_BLOQUEIO_USUARIO_ATIVO = 'bloqueioUsuarioAtivo';

/**
 * Retorna o documento de configurações gerais do app (objeto vazio se ainda
 * não existir nenhuma configuração salva).
 */
export async function getConfiguracoesApp() {
  try {
    const snap = await getDoc(doc(db, ...CONFIG_REF_PATH));
    return snap.exists() ? snap.data() : {};
  } catch (err) {
    console.error('Não foi possível carregar as configurações do app:', err);
    return {};
  }
}

/**
 * Igual getConfiguracoesApp(), mas em tempo real — usado pelo toggle do
 * item 12, pra que ligar/desligar no Admin valha na hora pra todo mundo que
 * já está com o app aberto, sem precisar recarregar a página.
 */
export function subscribeToConfiguracoesApp(callback) {
  const ref = doc(db, ...CONFIG_REF_PATH);
  return onSnapshot(
    ref,
    (snap) => callback(snap.exists() ? snap.data() : {}),
    (err) => {
      console.error('Não foi possível acompanhar as configurações do app:', err);
      callback({});
    }
  );
}

/**
 * Salva (merge, não sobrescreve o documento inteiro) um ou mais campos nas
 * configurações gerais do app e registra a alteração no histórico auditável
 * de ações do admin.
 */
export async function salvarConfiguracoesApp(patch, admin) {
  const antes = await getConfiguracoesApp();
  await setDoc(doc(db, ...CONFIG_REF_PATH), patch, { merge: true });

  // BUGFIX: antes isso gravava o objeto de configurações INTEIRO como
  // valorAntes/valorDepois (ex.: {bloqueioUsuarioAtivo: true}). O React não
  // consegue renderizar um objeto direto como filho — isso é o que quebrava
  // a aba Histórico com "Minified React error #31" assim que essa ação
  // aparecia na lista. Agora, quando só um campo muda (o caso de hoje, o
  // toggle de bloqueio), grava o valor simples desse campo (true/false).
  // Se um dia mudar mais de um campo de uma vez, cai no JSON.stringify —
  // ainda um texto simples, nunca um objeto.
  const chaves = Object.keys(patch);
  const umCampoSo = chaves.length === 1;
  const valorAntes = umCampoSo ? antes[chaves[0]] ?? null : JSON.stringify(antes);
  const valorDepois = umCampoSo ? patch[chaves[0]] : JSON.stringify({ ...antes, ...patch });

  await registrarAcaoAdmin({
    admin,
    acao: 'editar_configuracoes_app',
    alvoTipo: 'config',
    alvoId: umCampoSo ? chaves[0] : 'appSettings',
    valorAntes,
    valorDepois,
    detalhes: umCampoSo ? '' : `Campos alterados: ${chaves.join(', ')}`,
  });
}
