// ============================================================================
// Pré-carregamento em segundo plano — usado pela splash screen (app/page.js)
// pra já deixar o feed "quente" (posts + fotos + autores em cache) enquanto
// a animação de abertura ainda está na tela. Quando o FeedPage monta de
// verdade, ele confere esse cache primeiro (getFeedPreCarregado) em vez de
// começar do zero — se o preload já terminou, o feed aparece pronto na hora.
//
// Reaproveita os mesmos caches que o app já usa (imageCache.js — persistente
// em disco — e usersCache.js — em memória), então não duplica nada: só
// "esquenta" eles mais cedo.
// ============================================================================
import { collection, getDocs, orderBy, limit as fbLimit, query } from 'firebase/firestore';
import { db } from './firebase';
import { getCachedImageURL } from './imageCache';
import { getUsuarioCache } from './usersCache';

let feedPreCarregado = null; // { posts, quando }
const VALIDADE_MS = 30000; // depois disso, considera o preload velho demais e deixa o feed buscar de novo

/**
 * Retorna os posts pré-carregados, se ainda estiverem "frescos" (dentro de
 * VALIDADE_MS). Retorna null se não tem nada pré-carregado ainda, ou se já
 * passou tempo demais desde o preload (nesse caso o feed busca normalmente).
 */
export function getFeedPreCarregado() {
  if (!feedPreCarregado) return null;
  if (Date.now() - feedPreCarregado.quando > VALIDADE_MS) return null;
  return feedPreCarregado.posts;
}

/**
 * Busca a lista de usuários (mesma consulta que a tela de Ranking usa) e já
 * baixa a foto de perfil de todo mundo em paralelo, deixando tudo em cache.
 * Como o Ranking e a tela de Perfil (foto do próprio usuário) leem da mesma
 * coleção `users`, esse único preload já esquenta as duas telas de uma vez.
 * Comunidade pequena (25-50 pessoas) — baixar todo mundo de uma vez é barato.
 * Mesma filosofia "best effort" do preloadFeedInicial: nunca lança erro pra
 * fora; se falhar, cada tela busca normalmente quando for aberta.
 */
export async function preloadAvataresComunidade() {
  try {
    const q = query(collection(db, 'users'), orderBy('pontos', 'desc'));
    const snap = await getDocs(q);
    const fotos = snap.docs.map((d) => d.data().fotoURL).filter(Boolean);

    await Promise.all(fotos.map((url) => getCachedImageURL(url).catch(() => null)));
  } catch (err) {
    console.warn('Não foi possível pré-carregar os avatares da comunidade:', err);
  }
}
