// ============================================================================
// Compressão de imagem no navegador ANTES de subir pro Firebase Storage.
// Padrão: redimensiona pro máximo de 1920px no lado maior e mira ~1MB por
// arquivo, sem perda visível de qualidade numa tela de celular. Funciona
// mesmo em fotos originais de 100MB+ (câmeras modernas / HEIC), porque a
// maior parte da economia vem do redimensionamento, não da compressão bruta.
// ============================================================================
import imageCompression from 'browser-image-compression';

export async function comprimirImagem(arquivo) {
  const opcoes = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    initialQuality: 0.85,
  };

  try {
    return await imageCompression(arquivo, opcoes);
  } catch (err) {
    console.error('Erro ao comprimir imagem, enviando original:', err);
    return arquivo;
  }
}
