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
//
// CORREÇÃO DE BUG (envio de foto grande "não vai" no Correio): as 3 camadas
// acima cobrem o worker travar, mas tinham uma lacuna — se a foto for de um
// formato que o navegador não consegue DECODIFICAR (ex.: .heic do iPhone
// fora do Safari), a Camada 3 (Canvas) também falha, porque ela depende de
// `<img>` conseguir abrir o arquivo pra desenhar no canvas. Antes, esse
// caso caía num último `catch` que devolvia o arquivo ORIGINAL sem
// comprimir — se esse original passasse de 15MB (o limite do
// storage.rules pra pasta correio/), o upload subsequente (uploadBytes)
// era rejeitado, o erro subia caladinho até o botão "Enviar" do Correio, e
// o admin só via o carregando parar sem nenhuma mensagem — exatamente
// "clico e não vai a lugar nenhum". Agora: só devolve o original sem
// comprimir se ele já for pequeno o bastante pra caber no limite do
// Storage com folga; do contrário, lança um erro com uma mensagem que a
// tela pode mostrar (ver handleEnviar em AbaCorreio.js), em vez de tentar
// subir um arquivo que já se sabe que vai ser recusado.
// ============================================================================
import imageCompression from 'browser-image-compression';

const OPCOES_BASE = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  initialQuality: 0.85,
};

// Item 3 do Bloco A — versão menor, só pra aparecer nas LISTAS (Feed,
// Correio). A imagem em tamanho cheio (OPCOES_BASE acima) continua sendo
// gerada normalmente pra tela cheia — aqui é só uma segunda versão extra.
//
// AJUSTE DE QUALIDADE 2 (feedback: thumbnail comprimindo demais / feia no
// Feed e no Perfil): os valores de 800px/qualidade 0.75/teto 300KB ainda
// deixavam artefato de compressão visível (blocos/borrão), principalmente
// em fotos com mais detalhe (rosto, texto). Como o app é pra uma
// comunidade pequena (25-50 pessoas, ver decisão de arquitetura), não tem
// necessidade de espremer o arquivo tão pequeno — subiu pra 1280px e
// qualidade 0.85 (mesma qualidade da imagem em tela cheia, só menor em
// resolução), teto de 0.6MB. Ainda fica sensivelmente mais leve que a
// versão cheia (1920px/1MB), mas sem o aspecto "pixelado".
const OPCOES_THUMB = {
  maxSizeMB: 0.6,
  maxWidthOrHeight: 1280,
  initialQuality: 0.85,
};

// Teto de segurança pra devolver um arquivo SEM comprimir quando todas as
// camadas de compressão falham — abaixo do limite de 15MB do storage.rules,
// com folga (upload de mídia varia um pouco de tamanho real por causa de
// metadados). Bem acima disso, mais vale avisar a pessoa do que tentar subir
// um arquivo que o Storage já vai recusar de qualquer jeito.
const LIMITE_SEGURO_SEM_COMPRIMIR = 10 * 1024 * 1024;

function comTimeout(promessa, ms) {
  return Promise.race([
    promessa,
    new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), ms)),
  ]);
}

/**
 * Redimensiona e comprime uma imagem manualmente via Canvas — usado como
 * último recurso. Não depende de bibliotecas externas, então não sofre do
 * bug de travamento do Web Worker. Sempre resolve (não trava) — mas ainda
 * pode REJEITAR se o navegador simplesmente não souber abrir o arquivo
 * (formato não suportado, ex.: .heic fora do Safari), ver img.onerror.
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

/**
 * CORREÇÃO DE BUG (Correio: mandar imagem "não vai"): a tela de post do
 * Feed sempre passa a foto pela tela de recorte (ImageCropper.js) antes de
 * publicar — e o recorte, por conta própria, já redesenha a imagem num
 * canvas de no máximo 1600px (ver LADO_MAXIMO_TRABALHO nesse arquivo) antes
 * de qualquer outra coisa. Ou seja: quando comprimirImagem() roda pra um
 * post do Feed, ela já recebe uma imagem pequena, quase sempre resolvendo
 * na Camada 1 sem esforço.
 *
 * O Correio (AbaCorreio.js) não tem tela de recorte — a foto crua da
 * câmera/galeria (podendo vir com 4000px+ e vários MB) ia direto pra
 * comprimirImagem(), bem mais sujeita a bater o bug conhecido do Web
 * Worker travando silenciosamente em fotos grandes. Como o envio do
 * Correio é otimista (o botão mostra "Enviado!" quase na hora, revertendo
 * sozinho depois de 2s), quando isso trava e as 3 camadas de timeout
 * demoram até uns 27s pra desistir de vez, o erro final aparece tarde
 * demais pra pessoa notar — parece que "não vai" mesmo sem nenhum aviso.
 *
 * Esta função reduz a foto JÁ AO SER ESCOLHIDA no Correio (antes mesmo de
 * anexar), pro mesmo tamanho de trabalho que o recorte do Feed usa sem
 * querer — assim, quando o envio de verdade chamar comprimirImagem(), ela
 * já recebe uma imagem pequena, exatamente como no Feed.
 */
export async function reduzirImagemAoAnexar(arquivo) {
  if (arquivo.size <= 300 * 1024) return arquivo;
  try {
    return await comprimirViaCanvas(arquivo, 1920, 0.9);
  } catch {
    // Se nem isso conseguir abrir a imagem, deixa passar o arquivo original
    // — comprimirImagem() no envio (ver AbaCorreio.js) trata o erro final e
    // mostra a mensagem certa pra pessoa, como já fazia antes desta correção.
    return arquivo;
  }
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

  // Camada 3: redimensionamento manual via Canvas — sempre que consegue
  // pelo menos ABRIR a imagem, funciona e não trava.
  try {
    return await comprimirViaCanvas(arquivo);
  } catch (err) {
    console.error('Todas as formas de compressão falharam:', err);
    // Nenhuma camada conseguiu comprimir. Se o arquivo original ainda
    // couber com folga no limite do Storage, deixa passar sem comprimir
    // (melhor que travar o envio à toa). Se for grande demais, não adianta
    // fingir que vai dar certo — lança um erro com mensagem legível pra
    // tela mostrar, em vez de deixar o upload falhar caladinho lá na frente.
    if (arquivo.size <= LIMITE_SEGURO_SEM_COMPRIMIR) {
      return arquivo;
    }
    throw new Error(
      'Não foi possível comprimir esta imagem (formato não suportado ou arquivo grande demais). Tente salvá-la como JPEG/PNG antes de enviar.'
    );
  }
}

/**
 * Item 3 do Bloco A — gera a versão reduzida (thumbnail) usada nas listas.
 * Mesma estratégia de 3 camadas com timeout da compressão normal, só que
 * mirando um arquivo bem menor (até 800px, teto de 300KB — ver comentário
 * de OPCOES_THUMB acima pro raciocínio dos valores).
 */
export async function comprimirThumbnail(arquivo) {
  try {
    return await comTimeout(
      imageCompression(arquivo, { ...OPCOES_THUMB, useWebWorker: true }),
      12000
    );
  } catch (err) {
    console.warn('Compressão de thumbnail via Web Worker falhou/travou, tentando sem worker:', err);
  }

  try {
    return await comTimeout(
      imageCompression(arquivo, { ...OPCOES_THUMB, useWebWorker: false }),
      15000
    );
  } catch (err) {
    console.warn('Compressão de thumbnail sem worker também falhou, usando Canvas manual:', err);
  }

  try {
    return await comprimirViaCanvas(arquivo, OPCOES_THUMB.maxWidthOrHeight, OPCOES_THUMB.initialQuality);
  } catch (err) {
    console.error('Todas as formas de compressão de thumbnail falharam:', err);
    // Diferente de comprimirImagem, aqui não faz sentido devolver o arquivo
    // original (é grande demais pra servir de thumbnail) — quem chamar deve
    // tratar null como "sem thumbnail desta vez, usa a imagem cheia mesmo".
    return null;
  }
}
