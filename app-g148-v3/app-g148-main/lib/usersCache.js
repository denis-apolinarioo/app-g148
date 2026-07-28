// ============================================================================
// CORREÇÃO DE BUG: nome/foto desatualizados em posts antigos.
// ----------------------------------------------------------------------------
// Antes, cada post guardava uma "cópia" do nome/foto do autor no momento em
// que foi criado (denormalização). Isso é rápido de ler, mas quebra assim
// que a pessoa troca de nome/foto: posts antigos continuam mostrando o dado
// velho, como se fosse outra pessoa.
//
// A correção: posts/comentários/orações guardam só o `autorId` (uid), e o
// nome/foto/username exibidos são sempre buscados "ao vivo" da coleção
// `users`. Para não multiplicar leituras no Firestore (ex.: 15 posts do
// mesmo autor no feed gerando 15 buscas repetidas), usamos um cache em
// memória por sessão: o mesmo uid só é buscado 1 vez, mesmo que apareça
// em vários posts na tela.
// ============================================================================
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

const cache = new Map(); // uid -> { nome, fotoURL, username }
const emAndamento = new Map(); // uid -> Promise (evita buscas duplicadas simultâneas)

export async function getUsuarioCache(uid) {
  if (!uid) return null;
  if (cache.has(uid)) return cache.get(uid);
  if (emAndamento.has(uid)) return emAndamento.get(uid);

  const promessa = (async () => {
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      const dados = snap.exists()
        ? {
            nome: snap.data().nome || 'Usuário',
            fotoURL: snap.data().fotoURL || '',
            username: snap.data().username || '',
          }
        : { nome: 'Usuário removido', fotoURL: '', username: '' };
      cache.set(uid, dados);
      return dados;
    } finally {
      emAndamento.delete(uid);
    }
  })();

  emAndamento.set(uid, promessa);
  return promessa;
}

/**
 * Chamado depois que o próprio usuário edita nome/foto, para que a tela
 * atual já reflita a mudança imediatamente, sem esperar um reload.
 */
export function atualizarUsuarioCache(uid, dados) {
  const atual = cache.get(uid) || {};
  cache.set(uid, { ...atual, ...dados });
}
