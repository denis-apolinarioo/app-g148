// ============================================================================
// Compressão de imagem no navegador ANTES de subir pro Firebase Storage.
// Padrão: redimensiona pro máximo de 1920px no lado maior e mira ~1MB por
// arquivo, sem perda visível de qualidade numa tela de celular.
//
// CORREÇÃO DE BUG (fotos grandes travando): a biblioteca
// browser-image-compression, quando usada com useWebWorker: true, tem um
// bug conhecido onde o worker pode travar silenciosamente em fotos grandes
// — nunca resolve nem rejeita a Promise, então a tela ficava "pensando"
// pra sempre. A correção usa 3 camadas, cada uma com timeout, garantindo
// que SEMPRE teremos um resultado:
//   1) Tenta comprimir com Web Worker, com timeout de 12s
//   2) Se falhar/travar, tenta sem Web Worker (thread principal), com
//      timeout de 15s
//   3) Se ainda assim falhar, faz um redimensionamento manual via Canvas
//      (não depende de biblioteca nenhuma, não trava)
// ============================================================================
import imageCompression from 'browser-image-compression';

const OPCOES_BASE = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  initialQuality: 0.85,
};

function comTimeout(promessa, ms) {
  return Promise.race([
    promessa,
    new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), ms)),
  ]);
}

/**
 * Redimensiona e comprime uma imagem manualmente via Canvas — usado como
 * último recurso. Não depende de bibliotecas externas, então não sofre do
 * bug de travamento do Web Worker. Sempre resolve (não trava).
 */
function comprimirViaCanvas(arquivo, maxLado = 1920, qualidade = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(arquivo);

    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;

      if (width > height && width > maxLado) {
        height = Math.round((height * maxLado) / width);
        width = maxLado;
      } else if (height > maxLado) {
        width = Math.round((width * maxLado) / height);
        height = maxLado;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('CANVAS_TOBLOB_FALHOU'));
            return;
          }
          resolve(new File([blob], arquivo.name, { type: 'image/jpeg' }));
        },
        'image/jpeg',
        qualidade
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('IMAGEM_INVALIDA'));
    };

    img.src = url;
  });
}

export async function comprimirImagem(arquivo) {
  // Arquivo já pequeno (ex.: já veio comprimido de outro app) — nem vale a
  // pena gastar tempo comprimindo de novo.
  if (arquivo.size <= 300 * 1024) {
    return arquivo;
  }

  // Camada 1: Web Worker (mais rápido, mas pode travar em fotos grandes)
  try {
    return await comTimeout(
      imageCompression(arquivo, { ...OPCOES_BASE, useWebWorker: true }),
      12000
    );
  } catch (err) {
    console.warn('Compressão via Web Worker falhou/travou, tentando sem worker:', err);
  }

  // Camada 2: mesma biblioteca, sem Web Worker (thread principal)
  try {
    return await comTimeout(
      imageCompression(arquivo, { ...OPCOES_BASE, useWebWorker: false }),
      15000
    );
  } catch (err) {
    console.warn('Compressão sem worker também falhou, usando Canvas manual:', err);
  }

  // Camada 3: redimensionamento manual via Canvas — sempre funciona
  try {
    return await comprimirViaCanvas(arquivo);
  } catch (err) {
    console.error('Todas as formas de compressão falharam, enviando original:', err);
    return arquivo;
  }
}
