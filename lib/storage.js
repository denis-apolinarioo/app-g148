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
import { comprimirImagem } from './imageCompress';

// Arquivos de posts/áudio têm nome único (timestamp no caminho), então o
// conteúdo daquela URL nunca muda: pode cachear "para sempre" (1 ano,
// o teto de boas práticas de HTTP) e marcar como immutable.
const CACHE_CONTROL_IMUTAVEL = 'public, max-age=31536000, immutable';

/**
 * Envia uma foto (já comprimida) para o Storage, dentro de uma pasta por
 * usuário, e retorna a URL pública de download.
 */
export async function uploadFoto(uid, arquivo) {
  const comprimida = await comprimirImagem(arquivo);
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
  const comprimida = await comprimirImagem(arquivo);
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
 * Item 35 — Envio de foto pelo Correio (usada pelo Admin ao anexar uma
 * imagem a uma mensagem).
 */
export async function uploadFotoCorreio(uid, arquivo) {
  const comprimida = await comprimirImagem(arquivo);
  const nomeArquivo = `${Date.now()}_${arquivo.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
  const caminho = `correio/${uid}/${nomeArquivo}`;
  const storageRef = ref(storage, caminho);
  await uploadBytes(storageRef, comprimida, {
    contentType: comprimida.type || 'image/jpeg',
    cacheControl: CACHE_CONTROL_IMUTAVEL,
  });
  return getDownloadURL(storageRef);
}
