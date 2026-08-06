'use client';

import { useState, useEffect } from 'react';

// Estilo WhatsApp: barrinhas finas e numerosas, centralizadas
// verticalmente (oscilam pra cima E pra baixo a partir do meio, em vez de
// só crescer de baixo pra cima).
const NUM_BARRAS = 45;
const PISO = 2;
const ALTURA_MAX = 25;

function ondaDecorativa() {
  return Array.from({ length: NUM_BARRAS }, (_, i) =>
    PISO + Math.round(Math.sin((i / (NUM_BARRAS - 1)) * Math.PI) * 15 + Math.sin((i / 6) * Math.PI) * 6)
  );
}

// Onda genérica — usada enquanto a onda real ainda não foi calculada, ou
// como último recurso se o cálculo falhar (arquivo não encontrado, Storage
// sem CORS liberado pro domínio, etc).
const BARRAS_PARADAS = ondaDecorativa();

// Cache em memória por sessão — cada áudio só é baixado e decodificado UMA
// VEZ (mesmo se o player desmontar/remontar, ex: sair do Feed e voltar).
const cacheOndas = new Map();

/**
 * Calcula a forma de onda REAL do áudio (estilo WhatsApp): baixa o
 * arquivo, decodifica com Web Audio API (decodeAudioData) e reduz pra
 * NUM_BARRAS picos representando o volume real de cada trecho.
 *
 * Importante: isso NÃO conecta o elemento <audio> a nada (não usa
 * createMediaElementSource) — é só leitura do arquivo em memória, então
 * nunca afeta o som da reprodução em si.
 *
 * Se falhar por qualquer motivo (áudio no Storage e o domínio de produção
 * ainda não está liberado no CORS do bucket, arquivo não encontrado, etc.)
 * cai pra onda genérica e NUNCA lança exceção pra fora — é assim que
 * evitamos o crash antigo de tela com vários players juntos (ver
 * histórico do bug do Perfil).
 */
async function calcularOndaReal(src) {
  if (cacheOndas.has(src)) return cacheOndas.get(src);
  try {
    const resp = await fetch(src);
    if (!resp.ok) throw new Error('fetch falhou');
    const buffer = await resp.arrayBuffer();
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctxTemp = new Ctx();
    const audioBuffer = await ctxTemp.decodeAudioData(buffer);
    ctxTemp.close().catch(() => {});

    const dados = audioBuffer.getChannelData(0);
    const tamanhoBloco = Math.floor(dados.length / NUM_BARRAS) || 1;
    const picos = [];
    let maiorPico = 0;
    for (let i = 0; i < NUM_BARRAS; i++) {
      const inicio = i * tamanhoBloco;
      let soma = 0;
      for (let j = 0; j < tamanhoBloco; j++) {
        soma += Math.abs(dados[inicio + j] || 0);
      }
      const media = soma / tamanhoBloco;
      picos.push(media);
      if (media > maiorPico) maiorPico = media;
    }
    const barras = picos.map((p) =>
      PISO + Math.round((maiorPico > 0 ? p / maiorPico : 0) * ALTURA_MAX)
    );
    cacheOndas.set(src, barras);
    return barras;
  } catch {
    cacheOndas.set(src, BARRAS_PARADAS);
    return BARRAS_PARADAS;
  }
}

/**
 * Forma de onda de um player de áudio — igual ao WhatsApp: a onda é
 * calculada UMA VEZ a partir do som real e fica parada, sem nenhuma
 * animação. O "progresso" (barra ficando escura + bolinha andando) é
 * controlado por fora, em cima das mesmas barras (ver AudioPlayer.js e
 * AudioRecorderButton.js) — este hook só entrega a forma da onda.
 */
export default function useAudioBars(audioRef, tocando, src) {
  const [barras, setBarras] = useState(() => cacheOndas.get(src) || BARRAS_PARADAS);

  useEffect(() => {
    if (!src) {
      setBarras(BARRAS_PARADAS);
      return;
    }
    if (cacheOndas.has(src)) {
      setBarras(cacheOndas.get(src));
      return;
    }
    setBarras(BARRAS_PARADAS);
    let cancelado = false;
    calcularOndaReal(src).then((resultado) => {
      if (!cancelado) setBarras(resultado);
    });
    return () => {
      cancelado = true;
    };
  }, [src]);

  return barras;
}
