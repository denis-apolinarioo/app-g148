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
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { registrarAcaoAdmin } from './adminLog';

const CONFIG_REF_PATH = ['config', 'appSettings'];

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
 * Salva (merge, não sobrescreve o documento inteiro) um ou mais campos nas
 * configurações gerais do app e registra a alteração no histórico auditável
 * de ações do admin.
 */
export async function salvarConfiguracoesApp(patch, admin) {
  const antes = await getConfiguracoesApp();
  await setDoc(doc(db, ...CONFIG_REF_PATH), patch, { merge: true });
  await registrarAcaoAdmin({
    admin,
    acao: 'editar_configuracoes_app',
    alvoTipo: 'config',
    alvoId: 'appSettings',
    valorAntes: antes,
    valorDepois: { ...antes, ...patch },
  });
}
