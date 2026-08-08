// ============================================================================
// EXCLUSÃO DE CONTA (LGPD) — lado do client.
// A exclusão de verdade roda numa Cloud Function (functions/index.js ->
// excluirConta), porque precisa apagar/anonimizar dado de OUTRAS pessoas
// (curtidas, comentários) e apagar o login da pessoa no Firebase Auth —
// nada disso o navegador dela tem permissão de fazer sozinho. Ver o
// comentário grande em cima da function pra entender exatamente o que é
// apagado de vez e o que fica anonimizado.
// ============================================================================

import { httpsCallable } from 'firebase/functions';
import { functionsInstance } from '@/lib/firebase';

/**
 * Exclui uma conta (LGPD). Sem `uid`, exclui a PRÓPRIA conta de quem está
 * chamando; com `uid`, só funciona se quem chama for Admin (a Cloud
 * Function confere isso de novo no servidor — o app nunca confia só na
 * checagem do lado do client).
 *
 * Depois de chamar isto com sucesso pra própria conta, a sessão local
 * (Firebase Auth) fica "furada" — o login já não existe mais no servidor.
 * Quem chama deve deslogar (signOut) logo em seguida; ver uso em
 * app/(app)/perfil/page.js.
 */
export async function excluirConta(uid) {
  const chamar = httpsCallable(functionsInstance, 'excluirConta');
  const resultado = await chamar(uid ? { uid } : {});
  return resultado.data;
}
