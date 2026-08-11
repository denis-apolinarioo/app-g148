// ============================================================================
// Upload de arquivos (foto / áudio) para o Firebase Storage.
// IMPORTANTE: isso só funciona com o projeto Firebase no plano Blaze
// (com cartão cadastrado, conforme decidido). No plano Spark, o Storage
// fica indisponível e essas chamadas vão falhar.
//
// CACHE: por padrão, o Firebase Storage NÃO define um Cache-Control longo
// nos arquivos enviados, então o navegador rebaixa a imagem toda vez que
// ela é exibida (entrar no app, trocar de aba, etc.) — isso gera consumo
// extra de download (e de custo no Firebase) e deixa a UI lenta/piscando.
// Por isso, toda foto/áudio novo é enviado com `cacheControl` explícito.
// ============================================================================
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';
import { comprimirImagem, comprimirThumbnail } from './imageCompress';

// Arquivos de posts/áudio têm nome único (timestamp no caminho), então o
// conteúdo daquela URL nunca muda: pode cachear "para sempre" (1 ano,
// o teto de boas práticas de HTTP) e marcar como immutable.
const CACHE_CONTROL_IMUTAVEL = 'public, max-age=31536000, immutable';

/**
 * Item 3 do Bloco A — sobe a versão reduzida (thumbnail) de uma foto, na
 * mesma pasta do usuário, com o prefixo "thumb_" no nome do arquivo pra não
 * misturar com o arquivo em tamanho cheio (ver correção logo abaixo sobre
 * por que não usa subpasta). Se a compressão da thumbnail falhar por
 * completo (ver comprimirThumbnail), não sobe nada e retorna ''.
 */
async function uploadThumbnail(uid, arquivo, pastaBase) {
  const thumb = await comprimirThumbnail(arquivo);
  if (!thumb) return '';
  // CORREÇÃO DE BUG (upload de foto quebrado): antes o caminho era
  // `${pastaBase}/${uid}/thumbs/${nomeArquivo}` — uma subpasta extra
  // (3 níveis depois de "fotos"/"correio"). O storage.rules publicado só
  // libera exatamente 2 níveis (`{uid}/{fileName}`), então esse caminho
  // sempre batia "permissão negada" no Storage — e como o upload da foto
  // cheia e da thumbnail rodam juntos com Promise.all (ver
  // uploadFotoComThumb/uploadFotoCorreioComThumb), a chamada inteira
  // falhava e a publicação de foto no Feed/Correio nem saía do lugar.
  // Corrigido mantendo a thumbnail no mesmo nível do arquivo original (só
  // com o prefixo "thumb_" no nome), sem precisar editar regra nenhuma no
  // Firebase Console.
  const nomeArquivo = `thumb_${Date.now()}_${arquivo.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
  const caminho = `${pastaBase}/${uid}/${nomeArquivo}`;
  const storageRef = ref(storage, caminho);
  await uploadBytes(storageRef, thumb, {
    contentType: thumb.type || 'image/jpeg',
    cacheControl: CACHE_CONTROL_IMUTAVEL,
  });
  return getDownloadURL(storageRef);
}

/**
 * Item 3 do Bloco A — igual a uploadFoto, mas também gera e sobe a
 * thumbnail, retornando os dois tamanhos. Usada onde a foto pode aparecer
 * numa lista (Feed, Correio — ver CreatePostSheet.js e AbaCorreio.js).
 * Se a thumbnail falhar, `thumbURL` volta vazia — quem usa deve cair de
 * volta pra `url` (tamanho cheio) nesse caso.
 *
 * Roda em SEQUÊNCIA (não em paralelo) — ver o comentário completo em
 * uploadFotoCorreioComThumb abaixo sobre por que duas checagens
 * concorrentes no mesmo Blob podiam derrubar o upload inteiro.
 */
export async function uploadFotoComThumb(uid, arquivo) {
  const url = await uploadFoto(uid, arquivo);
  let thumbURL = '';
  try {
    thumbURL = await uploadThumbnail(uid, arquivo, 'fotos');
  } catch (err) {
    console.warn('Não foi possível gerar a miniatura do post, seguindo só com a foto cheia:', err);
  }
  return { url, thumbURL };
}

/**
 * Envia uma foto (já comprimida) para o Storage, dentro de uma pasta por
 * usuário, e retorna a URL pública de download.
 */
export async function uploadFoto(uid, arquivo) {
  // jaVerificado: true — este arquivo sempre vem do ImageCropper (ver
  // handleCortado em CreatePostSheet.js), que já desenhou a imagem num
  // canvas pra gerar o Blob. Não precisa reconfirmar que abre. Ver
  // raciocínio completo em uploadFotoCorreioComThumb, mais abaixo.
  const comprimida = await comprimirImagem(arquivo, { jaVerificado: true });
  const nomeArquivo = `${Date.now()}_${arquivo.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
  const caminho = `fotos/${uid}/${nomeArquivo}`;
  const storageRef = ref(storage, caminho);
  await uploadBytes(storageRef, comprimida, {
    contentType: comprimida.type || 'image/jpeg',
    cacheControl: CACHE_CONTROL_IMUTAVEL,
  });
  return getDownloadURL(storageRef);
}

/**
 * Envia um áudio (gravação de oração/relato) para o Storage. Áudio já é
 * naturalmente leve (formato do MediaRecorder do navegador), então não
 * passa por compressão adicional.
 */
export async function uploadAudio(uid, blob) {
  const nomeArquivo = `${Date.now()}_audio.webm`;
  const caminho = `audios/${uid}/${nomeArquivo}`;
  const storageRef = ref(storage, caminho);
  await uploadBytes(storageRef, blob, {
    contentType: blob.type || 'audio/webm',
    cacheControl: CACHE_CONTROL_IMUTAVEL,
  });
  return getDownloadURL(storageRef);
}

/**
 * Envia a foto de perfil, em uma pasta separada e com nome fixo por usuário
 * (assim, trocar a foto de perfil substitui a anterior em vez de acumular
 * arquivos antigos ocupando espaço à toa).
 *
 * Como o caminho é sempre o mesmo (perfil/{uid}/foto.jpg), a URL de
 * download não muda quando a pessoa troca de foto — por isso não dá pra
 * usar cache "immutable" aqui, senão quem já tinha a foto antiga em cache
 * nunca veria a nova. Em vez disso: cache de 1 dia (ainda evita reload a
 * cada troca de tela) + um parâmetro `v` com o timestamp do upload anexado
 * na própria URL salva no Firestore, que força o navegador a buscar de
 * novo assim que a foto realmente muda.
 */
export async function uploadFotoPerfil(uid, arquivo) {
  // jaVerificado: true — vem do ImageCropper (corte 1:1 fixo em
  // app/(app)/perfil/editar/page.js). Ver raciocínio completo em
  // uploadFotoCorreioComThumb, mais abaixo.
  const comprimida = await comprimirImagem(arquivo, { jaVerificado: true });
  const storageRef = ref(storage, `perfil/${uid}/foto.jpg`);
  await uploadBytes(storageRef, comprimida, {
    contentType: comprimida.type || 'image/jpeg',
    cacheControl: 'public, max-age=86400',
  });
  const url = await getDownloadURL(storageRef);
  const separador = url.includes('?') ? '&' : '?';
  return `${url}${separador}v=${Date.now()}`;
}

/**
 * Imagem circular de uma conquista, escolhida pelo Admin no painel
 * (app/(app)/admin/_components/AbaConquistas.js). Nome fixo por conquista
 * (igual ao padrão de uploadFotoPerfil) — trocar a imagem substitui a
 * anterior em vez de acumular arquivos antigos. `conquistaId` é o ID do
 * documento da conquista (gerado antes de subir a imagem, ver
 * lib/conquistasRepo.js).
 */
export async function uploadImagemConquista(conquistaId, arquivo) {
  // jaVerificado: true — vem do ImageCropper (corte 1:1 fixo em
  // AbaConquistas.js). Ver raciocínio completo em
  // uploadFotoCorreioComThumb, mais abaixo.
  const comprimida = await comprimirImagem(arquivo, { jaVerificado: true });
  const storageRef = ref(storage, `conquistas/${conquistaId}/imagem.jpg`);
  await uploadBytes(storageRef, comprimida, {
    contentType: comprimida.type || 'image/jpeg',
    cacheControl: 'public, max-age=86400',
  });
  const url = await getDownloadURL(storageRef);
  const separador = url.includes('?') ? '&' : '?';
  return `${url}${separador}v=${Date.now()}`;
}

/**
 * Item 35 — Envio de foto pelo Correio (usada pelo Admin ao anexar uma
 * imagem a uma mensagem).
 */
export async function uploadFotoCorreio(uid, arquivo) {
  // jaVerificado: true — vem do ImageCropper (ver handleCortado em
  // AbaCorreio.js). Ver raciocínio completo em uploadFotoCorreioComThumb,
  // logo abaixo.
  const comprimida = await comprimirImagem(arquivo, { jaVerificado: true });
  const nomeArquivo = `${Date.now()}_${arquivo.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
  const caminho = `correio/${uid}/${nomeArquivo}`;
  const storageRef = ref(storage, caminho);
  await uploadBytes(storageRef, comprimida, {
    contentType: comprimida.type || 'image/jpeg',
    cacheControl: CACHE_CONTROL_IMUTAVEL,
  });
  return getDownloadURL(storageRef);
}

/**
 * Item 3 do Bloco A — igual a uploadFotoCorreio, mas também gera e sobe a
 * thumbnail (mesma lógica de uploadFotoComThumb, só que na pasta correio/).
 *
 * CORREÇÃO DE BUG GRAVE (Correio: foto "nem vai" desde que passou a usar o
 * mesmo recorte do Feed): esta função rodava uploadFotoCorreio (foto cheia)
 * e uploadThumbnail (miniatura) em PARALELO com Promise.all, cada uma
 * chamando sua própria verificação "o navegador consegue abrir este
 * arquivo?" (arquivoAbreComoImagem, em lib/imageCompress.js) sobre o MESMO
 * Blob ao mesmo tempo. Antes da correção do recorte, o arquivo que chegava
 * aqui era grande (foto crua da câmera) e sempre passava pelas 3 camadas de
 * compressão de verdade, então essa checagem paralela nunca era exercitada
 * de fato. Agora que o ImageCropper já entrega um Blob pequeno (gerado por
 * canvas.toBlob), comprimirImagem/comprimirThumbnail pulam direto pra essa
 * checagem — e cada uma cria sua própria Image() + Object URL sobre o MESMO
 * Blob, ao mesmo tempo. Em navegadores mobile (especialmente dentro de
 * WebViews), duas decodificações concorrentes do mesmo Blob recém-criado
 * por canvas.toBlob podem disputar recurso e uma delas falhar
 * silenciosamente — Promise.all rejeita assim que a PRIMEIRA falha,
 * cancelando o upload inteiro. Como o envio é otimista (tela já limpou,
 * "Enviado!" já apareceu), isso passava despercebido: a mensagem de texto
 * às vezes nem chegava a ser criada (o catch em handleEnviar aborta antes
 * de chamar sendMailMessage) e a pessoa só via o toast de erro, se prestasse
 * atenção a tempo.
 *
 * Correção: roda em SEQUÊNCIA, não em paralelo — sobe a foto cheia primeiro
 * (mais importante), só depois gera e sobe a thumbnail. Elimina qualquer
 * disputa sobre o mesmo Blob. Também: se a geração da thumbnail falhar por
 * qualquer motivo, NÃO derruba o upload da foto cheia — a mensagem sai
 * mesmo assim, só sem a miniatura otimizada (mesmo comportamento de
 * fallback que comprimirThumbnail já tinha, mas que o Promise.all
 * atrapalhava ao propagar a falha pra cima).
 */
export async function uploadFotoCorreioComThumb(uid, arquivo) {
  const url = await uploadFotoCorreio(uid, arquivo);
  let thumbURL = '';
  try {
    thumbURL = await uploadThumbnail(uid, arquivo, 'correio');
  } catch (err) {
    console.warn('Não foi possível gerar a miniatura do Correio, seguindo só com a foto cheia:', err);
  }
  return { url, thumbURL };
}
