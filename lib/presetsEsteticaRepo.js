// ============================================================================
// PRESETS DE ESTÉTICA (cor do app) — mesmo padrão de lib/funcoesRepo.js /
// lib/categoriasAcaoRepo.js: o Admin cria, edita, ativa/desativa e apaga
// pelo painel (aba Estética).
//
// CAMPOS de cada documento (coleção `presetsEstetica`):
//   nome        — nome mostrado no seletor pessoal (Perfil) e no Admin
//   icone       — nome do ícone (lucide, kebab-case) escolhido via
//                 IconGalleryPicker — mesmo padrão de missao.icone
//   coresBase   — as 4 cores que a pessoa escolheu no seletor do Admin
//                 (fundo, cartao, principal, destaque) — guardadas pra dar
//                 pra reabrir o preset pra editar sem perder o que foi
//                 escolhido originalmente
//   variaveis   — o pacote INTEIRO de cores (17 chaves, ver
//                 lib/paletaGerador.js) já calculado a partir de coresBase —
//                 é isso que de fato é aplicado no app; fica salvo pronto
//                 pra não precisar recalcular a cada carregamento
//   ehEscuro    — true/false, decide a classe `dark` (ver lib/theme.js)
//   ativo       — só presets ativos aparecem no seletor pessoal (Perfil);
//                 os 2 presets originais (claro/escuro) nascem com
//                 protegido:true e não podem ser apagados, só desativados
//   protegido   — true só nos 2 presets originais — trava contra exclusão
//   ordem       — ordem de exibição no seletor e no painel Admin
// ============================================================================
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { slugify } from './slug';
import { registrarAcaoAdmin } from './adminLog';
import { gerarPaletaCompleta } from './paletaGerador';

const COLECAO = 'presetsEstetica';

// Os 2 presets que o app sempre teve — os valores aqui são os MESMOS que já
// estavam hard-codados no app antes da aba Estética existir (não passam
// pelo gerador automático: são reproduções exatas do que já existia, pra
// ninguém ver a cor do app mudar sozinha na 1ª vez que abrir depois dessa
// atualização). `coresBase` nos dois é só uma aproximação representativa
// (pra ter algo pra mostrar/editar no seletor de cores do Admin, se um dia
// quiser mexer) — quem manda de verdade é `variaveis`.
const PRESETS_SEED = [
  {
    id: 'claro',
    nome: 'Claro',
    icone: 'sun',
    ordem: 0,
    protegido: true,
    ehEscuro: false,
    coresBase: { fundo: '#FAF6EF', cartao: '#FFFDF9', principal: '#6B4A2F', destaque: '#B8863B' },
    variaveis: {
      cream: '#FAF6EF',
      creamSoft: '#F3ECE0',
      creamCard: '#FFFDF9',
      coffee50: '#F4EDE4',
      coffee100: '#E4D3BE',
      coffee200: '#CBAD8A',
      coffee300: '#AC8760',
      coffee400: '#8A6644',
      coffee500: '#6B4A2F',
      coffee600: '#543A25',
      coffee700: '#3F2C1C',
      coffee800: '#2C1F14',
      coffee900: '#1C140D',
      forte: '#3F2C1C',
      forte800: '#2C1F14',
      forte900: '#1C140D',
      textoForte: '#F9F7F6',
      gold: '#B8863B',
      goldSoft: '#D9B679',
    },
  },
  {
    id: 'escuro',
    nome: 'Escuro',
    icone: 'moon',
    ordem: 1,
    protegido: true,
    ehEscuro: true,
    coresBase: { fundo: '#0D0906', cartao: '#241A11', principal: '#CBB593', destaque: '#B8863B' },
    variaveis: {
      cream: '#0D0906',
      creamSoft: '#0D0906',
      creamCard: '#241A11',
      coffee50: '#241A11',
      coffee100: '#2F2216',
      coffee200: '#86714F',
      coffee300: '#9C8462',
      coffee400: '#B79C79',
      coffee500: '#CBB593',
      coffee600: '#DCCBAF',
      coffee700: '#E8DCC8',
      coffee800: '#F3ECE0',
      coffee900: '#F3ECE0',
      forte: '#3F2C1C',
      forte800: '#2C1F14',
      forte900: '#1C140D',
      textoForte: '#F9F8F6',
      gold: '#B8863B',
      goldSoft: '#D9B679',
    },
  },
];

// ----------------------------------------------------------------------------
// Item novo — 5 presets extras, criados/sincronizados junto com a seed
// inicial (protegido nasce FALSE em todos — dá pra editar E apagar pelo
// painel, diferente dos 2 originais acima). Cada um só define coresBase;
// `variaveis`/`ehEscuro` são calculados pelo MESMO gerador automático usado
// quando o Admin cria um preset pela UI (gerarPaletaCompleta) — ver
// garantirSeed abaixo.
//
// REDESENHADOS (2ª versão — 1ª ficou "sem capricho"/sem contraste): Gelo e
// Meia-noite viraram um par de propósito só (branco/preto BEM neutros,
// quase sem matiz nenhum, tipo Instagram — não são mais tons de azul).
// Verde/Azul/Vermelho suave seguem a MESMA receita de proporção do preset
// "Claro" original (fundo h/52%sat/96%luz, cartão quase branco, principal
// 39%sat/30%luz, destaque na MESMA família de matiz do principal, só mais
// claro/saturado) — mesma "fórmula" que já dava certo no marrom, só
// trocando o matiz — em vez de misturar matizes diferentes sem critério
// dentro do mesmo preset, que foi o que ficou "fora de lógica" na 1ª
// versão.
const PRESETS_SEED_EXTRAS = [
  {
    id: 'gelo',
    nome: 'Gelo',
    icone: 'snowflake',
    ordem: 2,
    // Branco neutro "sem nada", tipo Instagram claro — principal quase sem
    // saturação (cinza puro), destaque no azul característico do IG.
    coresBase: { fundo: '#FAFAFA', cartao: '#FFFFFF', principal: '#262626', destaque: '#0095F6' },
  },
  {
    id: 'meia_noite',
    nome: 'Meia-noite',
    icone: 'moon-star',
    ordem: 3,
    // Preto neutro "sem nada", tipo Instagram escuro — mesma dupla
    // principal/destaque do Gelo (cinza puro + azul do IG), só invertendo
    // o fundo pro extremo escuro.
    coresBase: { fundo: '#000000', cartao: '#0A0A0A', principal: '#EFEFEF', destaque: '#0095F6' },
  },
  {
    id: 'verde_suave',
    nome: 'Verde suave',
    icone: 'leaf',
    ordem: 4,
    coresBase: { fundo: '#EFFAF3', cartao: '#FBFEFC', principal: '#2F6A43', destaque: '#3CB966' },
  },
  {
    id: 'azul_suave',
    nome: 'Azul suave',
    icone: 'droplet',
    ordem: 5,
    coresBase: { fundo: '#EFF6FA', cartao: '#FBFDFE', principal: '#2F516A', destaque: '#3C85B9' },
  },
  {
    id: 'vermelho_suave',
    nome: 'Vermelho suave',
    icone: 'heart',
    ordem: 6,
    coresBase: { fundo: '#FAEFF0', cartao: '#FEFBFB', principal: '#6A2F34', destaque: '#B93C46' },
  },
];

async function garantirSeed() {
  const snap = await getDocs(collection(db, COLECAO));

  if (snap.empty) {
    await Promise.all(
      PRESETS_SEED.map(({ id, ...dados }) =>
        setDoc(doc(db, COLECAO, id), { ...dados, ativo: true, criadoEm: serverTimestamp() })
      )
    );
  }

  // Item novo — 5 presets extras (Gelo, Meia-noite, Verde/Azul/Vermelho
  // suave), verificados INDIVIDUALMENTE, não escondidos atrás do
  // "if (snap.empty)" acima — assim quem já tinha o app rodando antes
  // desses 5 existirem (coleção já com Claro/Escuro, como em produção)
  // ganha eles automaticamente na próxima vez que alguém abrir a aba
  // Estética, sem apagar/recriar nada que o Admin já tenha configurado.
  //
  // `gerenciadoPeloApp: true` marca "essas cores ainda são as de fábrica,
  // pode sincronizar à vontade" — criado com esse valor aqui, e desligado
  // (false) por atualizarPreset() assim que alguém editar a cor pelo
  // painel (ver comentário lá). Documento que JÁ existia antes desse
  // campo existir (sem o campo, `undefined`) conta como "ainda de
  // fábrica" — é exatamente o caso do Denis agora: os 5 já foram criados
  // numa sessão anterior com uma cor que ele pediu pra refazer, ainda sem
  // esse campo, e por isso ainda elegíveis pra sincronizar as cores novas.
  const existentesPorId = new Map((snap.empty ? [] : snap.docs).map((d) => [d.id, d.data()]));
  const paraSincronizar = PRESETS_SEED_EXTRAS.filter((p) => {
    const doc = existentesPorId.get(p.id);
    return !doc || doc.gerenciadoPeloApp !== false;
  });
  if (paraSincronizar.length === 0) return;

  await Promise.all(
    paraSincronizar.map(({ id, coresBase, ...dados }) => {
      const { variaveis, ehEscuro } = gerarPaletaCompleta(coresBase);
      return setDoc(
        doc(db, COLECAO, id),
        {
          ...dados,
          coresBase,
          variaveis,
          ehEscuro,
          protegido: false,
          gerenciadoPeloApp: true,
          ativo: true,
          criadoEm: serverTimestamp(),
        },
        { merge: true }
      );
    })
  );
}

/** Busca TODOS os presets (ativos ou não), ordenados pelo campo `ordem`. */
export async function getTodosOsPresets() {
  await garantirSeed();
  const snap = await getDocs(collection(db, COLECAO));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
}

/** Só os presets ativos — usado no seletor pessoal (Perfil). */
export async function getPresetsAtivos() {
  const todos = await getTodosOsPresets();
  return todos.filter((p) => p.ativo !== false);
}

export async function criarPreset(dados, admin) {
  const todos = await getTodosOsPresets();
  const idsExistentes = new Set(todos.map((p) => p.id));

  let base = slugify(dados.nome) || 'preset';
  let idFinal = base;
  let contador = 2;
  while (idsExistentes.has(idFinal)) {
    idFinal = `${base}_${contador}`;
    contador += 1;
  }

  const maiorOrdem = todos.reduce((max, p) => Math.max(max, p.ordem ?? 0), -1);
  const { variaveis, ehEscuro } = gerarPaletaCompleta(dados.coresBase);

  await setDoc(doc(db, COLECAO, idFinal), {
    nome: dados.nome,
    icone: dados.icone || 'palette',
    coresBase: dados.coresBase,
    variaveis,
    ehEscuro,
    ativo: dados.ativo ?? true,
    protegido: false,
    ordem: dados.ordem ?? maiorOrdem + 1,
    criadoEm: serverTimestamp(),
  });

  if (admin) {
    await registrarAcaoAdmin({
      admin,
      acao: 'criar_preset_estetica',
      alvoTipo: 'presetsEstetica',
      alvoId: idFinal,
      detalhes: dados.nome || idFinal,
    });
  }

  return idFinal;
}

/**
 * Atualiza um preset. Se `dados.coresBase` vier junto, recalcula a paleta
 * inteira (`variaveis`/`ehEscuro`) a partir dela — recalcula sempre que as
 * cores-base mudam, nunca guarda os dois fora de sincronia. Pra só
 * ativar/desativar ou renomear (sem mexer em cor), passe só `nome`/`ativo`
 * que a paleta já calculada continua igual.
 *
 * Editar a COR de um dos 5 presets extras (Gelo, Meia-noite, Verde/Azul/
 * Vermelho suave) desliga `gerenciadoPeloApp` — sem isso, a próxima vez
 * que alguém abrisse a aba Estética, garantirSeed() (acima) reescreveria a
 * cor "de fábrica" por cima da escolha do Admin.
 */
export async function atualizarPreset(presetId, dados, admin) {
  const patch = { ...dados, atualizadoEm: serverTimestamp() };
  if (dados.coresBase) {
    const { variaveis, ehEscuro } = gerarPaletaCompleta(dados.coresBase);
    patch.variaveis = variaveis;
    patch.ehEscuro = ehEscuro;
    patch.gerenciadoPeloApp = false;
  }

  await updateDoc(doc(db, COLECAO, presetId), patch);

  if (admin) {
    await registrarAcaoAdmin({
      admin,
      acao: 'editar_preset_estetica',
      alvoTipo: 'presetsEstetica',
      alvoId: presetId,
      detalhes: dados.nome || presetId,
    });
  }
}

/** Apaga o preset. Bloqueado pros 2 presets originais (protegido:true) —
 * confira isso na UI antes de chamar (o botão de apagar nem aparece). */
export async function apagarPreset(presetId, admin, nomePreset) {
  await deleteDoc(doc(db, COLECAO, presetId));

  if (admin) {
    await registrarAcaoAdmin({
      admin,
      acao: 'excluir_preset_estetica',
      alvoTipo: 'presetsEstetica',
      alvoId: presetId,
      detalhes: nomePreset || presetId,
    });
  }
}
