// ============================================================================
// Upload de arquivos (foto / áudio) para o Firebase Storage.
// IMPORTANTE: isso só funciona com o projeto Firebase no plano Blaze
// (com cartão cadastrado, conforme decidido). No plano Spark, o Storage
// fica indisponível e essas chamadas vão falhar.
// ============================================================================
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';
import { comprimirImagem } from './imageCompress';

/**
 * Envia uma foto (já comprimida) para o Storage, dentro de uma pasta por
 * usuário, e retorna a URL pública de download.
 */
export async function uploadFoto(uid, arquivo) {
  const comprimida = await comprimirImagem(arquivo);
  const nomeArquivo = `${Date.now()}_${arquivo.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
  const caminho = `fotos/${uid}/${nomeArquivo}`;
  const storageRef = ref(storage, caminho);
  await uploadBytes(storageRef, comprimida, { contentType: comprimida.type || 'image/jpeg' });
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
  await uploadBytes(storageRef, blob, { contentType: 'audio/webm' });
  return getDownloadURL(storageRef);
}

/**
 * Envia a foto de perfil, em uma pasta separada e com nome fixo por usuário
 * (assim, trocar a foto de perfil substitui a anterior em vez de acumular
 * arquivos antigos ocupando espaço à toa).
 */
export async function uploadFotoPerfil(uid, arquivo) {
  const comprimida = await comprimirImagem(arquivo);
  const storageRef = ref(storage, `perfil/${uid}/foto.jpg`);
  await uploadBytes(storageRef, comprimida, { contentType: comprimida.type || 'image/jpeg' });
  return getDownloadURL(storageRef);
}
