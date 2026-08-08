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
import { doc, getDoc, getDocs, collection } from 'firebase/firestore';
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

// ============================================================================
// CORREÇÃO DE BUG: @menção em posts/comentários (TextoComLinks) ficava em
// negrito e clicável pra QUALQUER "@algumacoisa", mesmo sem nenhum usuário
// com esse username existir — o link só caía numa tela de "não encontrado".
// Agora só vira link/negrito quando o username realmente existe. Pra isso
// sem disparar uma leitura da coleção inteira de `users` a cada @menção
// exibida na tela, os usernames válidos ficam num único cache em memória
// (buscado 1 vez por sessão, igual ao cache por uid acima).
// ============================================================================
let usernamesCache = null; // Set<string> (username em minúsculo) ou null se ainda não buscou
let usernamesEmAndamento = null;

export async function getUsernamesValidosCache() {
  if (usernamesCache) return usernamesCache;
  if (usernamesEmAndamento) return usernamesEmAndamento;

  usernamesEmAndamento = (async () => {
    try {
      const snap = await getDocs(collection(db, 'users'));
      const set = new Set();
      snap.docs.forEach((d) => {
        const username = d.data().username;
        if (username) set.add(username.toLowerCase());
      });
      usernamesCache = set;
      return set;
    } finally {
      usernamesEmAndamento = null;
    }
  })();

  return usernamesEmAndamento;
}

/**
 * Chamado depois que alguém cria conta ou troca de @username, pra esse
 * username entrar no cache na hora — sem isso, a pessoa só ficaria
 * "mencionável" (negrito/clicável) na próxima vez que o app recarregasse.
 */
export function adicionarUsernameValidoCache(username) {
  if (usernamesCache && username) usernamesCache.add(username.toLowerCase());
}
