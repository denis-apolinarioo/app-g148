// ============================================================================
// Cache de imagens PERSISTENTE (sobrevive a fechar/reabrir o app).
// ----------------------------------------------------------------------------
// ANTES: o cache era só um Map em memória — funcionava enquanto a aba
// ficava aberta, mas era zerado toda vez que o app era fechado/reaberto
// (comum em PWA no celular, o sistema mata a aba em segundo plano o tempo
// todo). Resultado: fotos de perfil, posts e correio baixavam de novo do
// Firebase Storage quase toda vez que a pessoa abria o app — consumindo
// mais dados, deixando a UI mais lenta e "piscando" imagem.
//
// AGORA: usamos o Cache Storage do navegador (a mesma API que Service
// Workers usam pra funcionar offline) — ele grava em disco, não em memória,
// e continua lá depois de fechar o app/navegador. Só é limpo se o sistema
// operacional precisar liberar espaço, ou se o usuário limpar dados do app.
//
// Por que isso é seguro (não vai mostrar imagem desatualizada): cada
// arquivo enviado pelo app tem uma URL que só muda quando o conteúdo muda
// de verdade —
//   - posts/áudio/correio: nome do arquivo tem timestamp único (ver
//     lib/storage.js) → a URL de uma foto de post nunca é reaproveitada
//     por outra foto diferente;
//   - foto de perfil: o caminho é fixo, mas a URL salva no Firestore leva
//     um parâmetro `?v=timestamp` que muda a cada troca de foto (ver
//     uploadFotoPerfil em lib/storage.js).
// Como o cache é indexado pela URL exata, uma URL nova (por ter mudado o
// conteúdo) é sempre um cache-miss — nunca mostra a imagem antiga.
// ============================================================================

const NOME_CACHE = 'g148-imagens-v1';

const cache = new Map(); // url original -> object URL local (válido enquanto a aba está aberta)
const emAndamento = new Map(); // url original -> Promise (evita downloads duplos simultâneos)

// Cache Storage não existe em todo ambiente (ex.: durante SSR no servidor).
// Se não tiver, a função ainda funciona — só cai de volta pro comportamento
// antigo (cache em memória por sessão) em vez de quebrar.
async function abrirCacheStorage() {
  if (typeof caches === 'undefined') return null;
  try {
    return await caches.open(NOME_CACHE);
  } catch {
    return null;
  }
}

/**
 * Retorna uma URL local (blob) para a imagem. Se já baixou antes — nesta
 * sessão OU em qualquer sessão anterior, graças ao Cache Storage — devolve
 * sem fazer nenhuma requisição de rede.
 */
export async function getCachedImageURL(url) {
  if (!url) return '';

  // Já resolvida nesta sessão — devolve na hora
  if (cache.has(url)) return cache.get(url);

  // Já está sendo baixada por outra chamada simultânea — aguarda a mesma Promise
  if (emAndamento.has(url)) return emAndamento.get(url);

  const promessa = (async () => {
    try {
      const cacheStorage = await abrirCacheStorage();

      // 1) já existe no disco de uma sessão anterior?
      const respostaCacheada = cacheStorage ? await cacheStorage.match(url) : null;
      if (respostaCacheada) {
        const blob = await respostaCacheada.blob();
        const localURL = URL.createObjectURL(blob);
        cache.set(url, localURL);
        return localURL;
      }

      // 2) não tinha — baixa da rede e já grava no disco pra próxima vez
      const response = await fetch(url);
      if (!response.ok) throw new Error('Falha ao carregar imagem');

      if (cacheStorage) {
        // clona porque um Response só pode ser lido uma vez (uma cópia vai
        // pro disco, a outra vira o blob usado agora)
        await cacheStorage.put(url, response.clone()).catch(() => {
          // se a gravação falhar (ex.: quota de armazenamento do dispositivo
          // cheia), segue o app funcionando normal, só sem persistir essa
          // imagem específica
        });
      }

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
 * Invalida uma entrada do cache (memória E disco) — chamar quando o
 * usuário troca a foto de perfil, para forçar o recarregamento.
 * Na prática, como a foto de perfil já muda de URL a cada troca (parâmetro
 * `?v=`), isso é mais uma garantia extra do que algo estritamente
 * necessário — mas não custa manter limpo.
 */
export async function invalidarImagemCache(url) {
  if (!url) return;
  const local = cache.get(url);
  if (local) URL.revokeObjectURL(local);
  cache.delete(url);

  const cacheStorage = await abrirCacheStorage();
  if (cacheStorage) await cacheStorage.delete(url).catch(() => {});
}
