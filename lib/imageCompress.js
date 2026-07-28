/* eslint-disable */
import imageCompression from 'browser-image-compression';

const OPCOES_BASE = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  initialQuality: 0.8,
};

export async function comprimirImagem(arquivo) {
  if (!arquivo || arquivo.size <= 300 * 1024) {
    return arquivo;
  }

  try {
    // Tenta comprimir com um tempo limite de 10 segundos
    const compressPromise = imageCompression(arquivo, { ...OPCOES_BASE, useWebWorker: true });
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 10000));
    
    return await Promise.race([compressPromise, timeoutPromise]);
  } catch (err) {
    console.warn('Compressão falhou, tentando modo simples...');
    try {
      return await imageCompression(arquivo, { ...OPCOES_BASE, useWebWorker: false });
    } catch (e) {
      return arquivo; // Se tudo falhar, manda a original para não travar o usuário
    }
  }
}
