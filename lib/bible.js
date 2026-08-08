// ============================================================================
// Versículo diário — busca na API pública "Midvash" (api.midvash.com),
// gratuita, sem chave/cadastro, com a versão NAA disponível.
//
// Estratégia em 3 camadas, pra nunca deixar a tela quebrada:
// 1) Olha se já existe um versículo salvo em cache pra HOJE no Firestore
//    (dailyVerseCache/{data}) — assim só é feita 1 chamada à API por dia
//    no total (não 1 por pessoa que abrir o app), e some se a API cair
//    depois de já ter funcionado hoje cedo.
// 2) Se não tem cache, busca na API um versículo da lista curada abaixo,
//    escolhido de forma determinística pelo dia do ano (todo mundo vê o
//    mesmo versículo no mesmo dia — bom pra devocional em grupo).
// 3) Se a API falhar, cai pra lista local `VERSICULOS_FALLBACK`, que
//    sempre funciona mesmo sem internet/API disponível.
// ============================================================================
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { todayBrasilia } from './dateUtils';

const API_BASE = 'https://api.midvash.com/v1';
const VERSAO = 'naa';

// Lista curada de referências (livros sem numeração, pra evitar ambiguidade
// de slug tipo "1corinthians" vs "1-corinthians"). Pode crescer à vontade.
const REFERENCIAS_ROTATIVAS = [
  { livro: 'john', capitulo: 3, versiculo: 16, label: 'João 3:16' },
  { livro: 'psalms', capitulo: 23, versiculo: 1, label: 'Salmos 23:1' },
  { livro: 'proverbs', capitulo: 3, versiculo: 5, label: 'Provérbios 3:5' },
  { livro: 'philippians', capitulo: 4, versiculo: 13, label: 'Filipenses 4:13' },
  { livro: 'romans', capitulo: 8, versiculo: 28, label: 'Romanos 8:28' },
  { livro: 'joshua', capitulo: 1, versiculo: 9, label: 'Josué 1:9' },
  { livro: 'isaiah', capitulo: 41, versiculo: 10, label: 'Isaías 41:10' },
  { livro: 'psalms', capitulo: 46, versiculo: 1, label: 'Salmos 46:1' },
  { livro: 'matthew', capitulo: 6, versiculo: 33, label: 'Mateus 6:33' },
  { livro: 'galatians', capitulo: 6, versiculo: 9, label: 'Gálatas 6:9' },
  { livro: 'james', capitulo: 1, versiculo: 5, label: 'Tiago 1:5' },
  { livro: 'ephesians', capitulo: 2, versiculo: 8, label: 'Efésios 2:8' },
  { livro: 'psalms', capitulo: 34, versiculo: 8, label: 'Salmos 34:8' },
  { livro: 'colossians', capitulo: 3, versiculo: 23, label: 'Colossenses 3:23' },
  { livro: 'hebrews', capitulo: 11, versiculo: 1, label: 'Hebreus 11:1' },
];

// Fallback local — usado somente se a API estiver fora do ar. Mantém o app
// funcionando sempre, mesmo sem internet pra API externa.
const VERSICULOS_FALLBACK = [
  {
    referencia: 'Romanos 14:8',
    texto:
      'Porque, se vivemos, para o Senhor vivemos; e, se morremos, para o Senhor morremos. Portanto, quer vivamos, quer morramos, pertencemos ao Senhor.',
  },
  {
    referencia: 'Josué 1:9',
    texto:
      'Não foi isso que eu ordenei a você? Seja forte e corajoso! Não se apavore, nem se desanime, porque o Senhor, o seu Deus, estará com você por onde quer que você andar.',
  },
  {
    referencia: 'Filipenses 4:13',
    texto: 'Tudo posso naquele que me fortalece.',
  },
  {
    referencia: 'Salmos 46:1',
    texto: 'Deus é o nosso refúgio e a nossa fortaleza, socorro bem presente na angústia.',
  },
  {
    referencia: 'Provérbios 3:5',
    texto:
      'Confie no Senhor de todo o coração e não se apoie no seu próprio entendimento.',
  },
];

function escolherReferenciaDoDia() {
  const hoje = todayBrasilia();
  const diaDoAno = Number(hoje.replaceAll('-', ''));
  const indice = diaDoAno % REFERENCIAS_ROTATIVAS.length;
  return REFERENCIAS_ROTATIVAS[indice];
}

function escolherFallbackDoDia() {
  const hoje = todayBrasilia();
  const diaDoAno = Number(hoje.replaceAll('-', ''));
  const indice = diaDoAno % VERSICULOS_FALLBACK.length;
  return VERSICULOS_FALLBACK[indice];
}

async function buscarNaAPI() {
  const ref = escolherReferenciaDoDia();
  const url = `${API_BASE}/${VERSAO}/${ref.livro}/${ref.capitulo}/${ref.versiculo}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000); // não deixa a tela travar esperando

  try {
    const resposta = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!resposta.ok) throw new Error(`API respondeu ${resposta.status}`);
    const json = await resposta.json();
    if (!json?.data?.text) throw new Error('Formato inesperado da API');
    return {
      referencia: ref.label,
      texto: json.data.text,
      versao: 'NAA',
      fonte: 'api',
    };
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

/**
 * Retorna o versículo do dia, usando cache no Firestore para evitar bater
 * na API toda vez que alguém abre o app. Sempre retorna algo válido (nunca
 * `null`), mesmo com API indisponível.
 */
export async function getVersiculoDoDia() {
  const hoje = todayBrasilia();
  const cacheRef = doc(db, 'dailyVerseCache', hoje);

  try {
    const cacheSnap = await getDoc(cacheRef);
    if (cacheSnap.exists()) {
      return cacheSnap.data();
    }
  } catch (err) {
    console.error('Erro ao ler cache do versículo:', err);
    // segue o fluxo mesmo assim, tenta buscar na API
  }

  let versiculo;
  try {
    versiculo = await buscarNaAPI();
  } catch (err) {
    console.error('API bíblica indisponível, usando fallback local:', err);
    const fb = escolherFallbackDoDia();
    versiculo = { referencia: fb.referencia, texto: fb.texto, versao: 'NAA', fonte: 'fallback' };
  }

  try {
    await setDoc(cacheRef, { ...versiculo, data: hoje, cacheadoEm: serverTimestamp() });
  } catch (err) {
    console.error('Não foi possível salvar cache do versículo (não bloqueia a exibição):', err);
  }

  return versiculo;
}
