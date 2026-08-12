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
      gold: '#B8863B',
      goldSoft: '#D9B679',
    },
  },
];

// ----------------------------------------------------------------------------
// Item novo — 5 presets extras, criados junto com a seed inicial (protegido
// nasce FALSE em todos — dá pra editar E apagar pelo painel, diferente dos
// 2 originais acima). Cada um só define coresBase; `variaveis`/`ehEscuro`
// são calculados pelo MESMO gerador automático usado quando o Admin cria um
// preset pela UI (gerarPaletaCompleta) — ver garantirSeed abaixo.
const PRESETS_SEED_EXTRAS = [
  {
    id: 'gelo',
    nome: 'Gelo',
    icone: 'snowflake',
    ordem: 2,
    coresBase: { fundo: '#F3F7FA', cartao: '#FFFFFF', principal: '#43606E', destaque: '#7FB3D5' },
  },
  {
    id: 'meia_noite',
    nome: 'Meia-noite',
    icone: 'moon-star',
    ordem: 3,
    coresBase: { fundo: '#060810', cartao: '#12182A', principal: '#9DB4D4', destaque: '#5B9BD5' },
  },
  {
    id: 'verde_suave',
    nome: 'Verde suave',
    icone: 'leaf',
    ordem: 4,
    coresBase: { fundo: '#F1F8F0', cartao: '#FFFFFF', principal: '#6FA37A', destaque: '#D4A857' },
  },
  {
    id: 'azul_suave',
    nome: 'Azul suave',
    icone: 'droplet',
    ordem: 5,
    coresBase: { fundo: '#F0F6FB', cartao: '#FFFFFF', principal: '#5B87AD', destaque: '#D9A75C' },
  },
  {
    id: 'vermelho_suave',
    nome: 'Vermelho suave',
    icone: 'heart',
    ordem: 6,
    coresBase: { fundo: '#FBF1F1', cartao: '#FFFFFF', principal: '#B5686B', destaque: '#CB8F55' },
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
  // suave), verificados e criados INDIVIDUALMENTE, não escondidos atrás do
  // "if (snap.empty)" acima — assim quem já tinha o app rodando antes
  // desses 5 existirem (coleção já com Claro/Escuro, como em produção)
  // ganha eles automaticamente na próxima vez que alguém abrir a aba
  // Estética, sem apagar/recriar nada que o Admin já tenha configurado.
  // Cada um usa o MESMO gerador automático (gerarPaletaCompleta) que um
  // preset novo criado pela UI usaria — só as 4 cores-base são fixas aqui,
  // o resto da paleta (17 variáveis) é calculado, igual a qualquer outro.
  const idsExistentes = new Set(snap.empty ? PRESETS_SEED.map((p) => p.id) : snap.docs.map((d) => d.id));
  const faltando = PRESETS_SEED_EXTRAS.filter((p) => !idsExistentes.has(p.id));
  if (faltando.length === 0) return;

  await Promise.all(
    faltando.map(({ id, coresBase, ...dados }) => {
      const { variaveis, ehEscuro } = gerarPaletaCompleta(coresBase);
      return setDoc(doc(db, COLECAO, id), {
        ...dados,
        coresBase,
        variaveis,
        ehEscuro,
        protegido: false,
        ativo: true,
        criadoEm: serverTimestamp(),
      });
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
 */
export async function atualizarPreset(presetId, dados, admin) {
  const patch = { ...dados, atualizadoEm: serverTimestamp() };
  if (dados.coresBase) {
    const { variaveis, ehEscuro } = gerarPaletaCompleta(dados.coresBase);
    patch.variaveis = variaveis;
    patch.ehEscuro = ehEscuro;
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
