// ============================================================================
// Cache de imagens em memória por sessão.
// ----------------------------------------------------------------------------
// Problema: toda vez que o usuário troca de aba ou volta ao feed, o browser
// recarrega as fotos de perfil e mídias do Firebase Storage do zero —
// causando o "piscado" de imagem e consumo desnecessário de banda.
//
// Solução: baixa a imagem uma vez, converte pra object URL local e guarda
// em memória. Da segunda vez em diante, retorna na hora sem rede.
// Funciona para fotos de perfil, imagens de posts e thumbnails.
// ============================================================================

const cache = new Map(); // url original -> object URL local
const emAndamento = new Map(); // url original -> Promise (evita downloads duplos simultâneos)

/**
 * Retorna uma URL local (blob) para a imagem. Se já baixou antes,
 * devolve do cache sem fazer nenhuma requisição de rede.
 */
export async function getCachedImageURL(url) {
  if (!url) return '';

  // Já está no cache — devolve na hora
  if (cache.has(url)) return cache.get(url);

  // Já está sendo baixada por outra chamada simultânea — aguarda a mesma Promise
  if (emAndamento.has(url)) return emAndamento.get(url);

  const promessa = (async () => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Falha ao carregar imagem');
      const blob = await response.blob();
      const localURL = URL.createObjectURL(blob);
      cache.set(url, localURL);
      return localURL;
    } catch {
      // Se falhar (sem rede, URL expirada), devolve a URL original
      // para o browser tentar carregar normalmente
      return url;
    } finally {
      emAndamento.delete(url);
    }
  })();

  emAndamento.set(url, promessa);
  return promessa;
}

/**
 * Invalida uma entrada do cache — chamar quando o usuário
 * troca a foto de perfil, para forçar o recarregamento.
 */
export function invalidarImagemCache(url) {
  if (!url) return;
  const local = cache.get(url);
  if (local) URL.revokeObjectURL(local);
  cache.delete(url);
}
