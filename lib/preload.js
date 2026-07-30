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
 * Busca os posts mais recentes e já baixa (em paralelo) a foto de cada post
 * e os dados de cada autor, deixando tudo em cache antes do feed precisar.
 * Chamado uma vez, durante a splash screen — nunca lança erro pra fora,
 * porque é "best effort": se falhar, o feed simplesmente busca do zero
 * quando montar, sem nenhum prejuízo pro usuário.
 */
export async function preloadFeedInicial(quantidade = 15) {
  try {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), fbLimit(quantidade));
    const snap = await getDocs(q);
    const posts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const autorIds = new Set(posts.map((p) => p.autorId).filter(Boolean));
    const midiaURLs = posts.map((p) => p.midiaURL).filter(Boolean);

    await Promise.all([
      ...[...autorIds].map((uid) => getUsuarioCache(uid).catch(() => null)),
      ...midiaURLs.map((url) => getCachedImageURL(url).catch(() => null)),
    ]);

    feedPreCarregado = { posts, quando: Date.now() };
  } catch (err) {
    console.warn('Não foi possível pré-carregar o feed em segundo plano:', err);
  }
}
