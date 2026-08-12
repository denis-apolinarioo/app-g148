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

/** Compara duas coresBase (fundo/cartao/principal/destaque) — usado só pra
 * decidir se garantirSeed() precisa escrever alguma coisa (ver comentário
 * grande lá dentro sobre o loop que isso corrigiu). */
function coresBaseIguais(a, b) {
  if (!a || !b) return false;
  return (
    (a.fundo || '').toUpperCase() === (b.fundo || '').toUpperCase() &&
    (a.cartao || '').toUpperCase() === (b.cartao || '').toUpperCase() &&
    (a.principal || '').toUpperCase() === (b.principal || '').toUpperCase() &&
    (a.destaque || '').toUpperCase() === (b.destaque || '').toUpperCase()
  );
}

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
      // Item novo — modo claro nunca teve ajuste de borda no app original
      // (só o escuro tinha essa correção manual), então aqui é igual à
      // escala normal (mesmos valores de coffee100/200/300/400/700).
      borda100: '#E4D3BE',
      borda200: '#CBAD8A',
      borda300: '#AC8760',
      borda400: '#8A6644',
      borda700: '#3F2C1C',
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
      // Item novo — valores EXATOS extraídos do app antigo (antes da
      // Estética virar múltiplos presets), onde o modo escuro tinha essa
      // correção manual de borda (mais clara que a escala normal nesses
      // degraus, que aqui é escura — pensada pra fundo, não pra borda).
      borda100: '#3A2A1B',
      borda200: '#4A3624',
      borda300: '#5C4530',
      borda400: '#6E5238',
      borda700: '#8A6644',
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
    // Branco 100% neutro, "sem nada" — pedido explícito do Denis depois de
    // ver a 1ª versão (que tinha o azul do Instagram como destaque):
    // NENHUMA cor, nem no destaque — tudo cinza/preto/branco puro, sem
    // saturação nenhuma em lugar nenhum. `destaque` mais escuro que
    // `principal` de propósito: dá pra badge/selo/streak continuarem
    // "aparecendo" por CONTRASTE de valor (mais escuro = mais forte),
    // sem depender de matiz nenhum pra isso.
    coresBase: { fundo: '#FAFAFA', cartao: '#FFFFFF', principal: '#8E8E8E', destaque: '#1A1A1A' },
  },
  {
    id: 'meia_noite',
    nome: 'Meia-noite',
    icone: 'moon-star',
    ordem: 3,
    // Preto 100% neutro, mesma lógica do Gelo (zero saturação em tudo) —
    // só invertendo pro extremo escuro. `destaque` mais claro que
    // `principal`, mesmo raciocínio: contraste de valor, não de matiz.
    coresBase: { fundo: '#000000', cartao: '#0A0A0A', principal: '#8E8E8E', destaque: '#F5F5F5' },
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

  // Item novo — restaura Claro/Escuro pros valores originais se alguém
  // editou a cor deles pelo painel (o botão de apagar já era bloqueado por
  // "protegido", mas o de editar cor não). Mesma checagem seguro/idempotente
  // de baixo (só escreve se for DIFERENTE do original) — sem isso, viraria
  // o mesmo loop de escrita descrito no comentário grande logo abaixo.
  const existentesBase = snap.empty ? [] : snap.docs;
  await Promise.all(
    PRESETS_SEED.filter((p) => {
      const atual = existentesBase.find((d) => d.id === p.id)?.data();
      return atual && !coresBaseIguais(atual.coresBase, p.coresBase);
    }).map(({ id, ...dados }) => setDoc(doc(db, COLECAO, id), dados, { merge: true }))
  );

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
  // fábrica".
  //
  // BUG CORRIGIDO (app travando/tema piscando sem parar): esta função
  // escrevia (setDoc com merge) os 5 extras TODA VEZ que era chamada,
  // mesmo quando as cores já estavam certinhas — e usePresetAtivo()
  // (lib/theme.js) tem um onSnapshot ouvindo esta MESMA coleção, que
  // chama getTodosOsPresets() -> garantirSeed() de novo a cada mudança.
  // Resultado: escreve -> dispara o onSnapshot -> chama garantirSeed() de
  // novo -> escreve nos MESMOS 5 documentos de novo (o
  // "gerenciadoPeloApp !== false" nunca ficava false sozinho) -> dispara
  // o onSnapshot de novo... um loop infinito de leitura+escrita, sem
  // nunca parar — daí o app travado e a cor "piscando" (o tema sendo
  // reaplicado a cada volta). A correção: só escreve se o documento não
  // existir AINDA ou se as cores realmente forem diferentes das que já
  // estão salvas — depois da 1ª sincronização, chamadas seguintes não
  // encontram mais nada pra fazer e não escrevem nada, quebrando o loop.
  const existentesPorId = new Map((snap.empty ? [] : snap.docs).map((d) => [d.id, d.data()]));
  const paraSincronizar = PRESETS_SEED_EXTRAS.filter((p) => {
    const docExistente = existentesPorId.get(p.id);
    if (!docExistente) return true;
    if (docExistente.gerenciadoPeloApp === false) return false;
    return !coresBaseIguais(docExistente.coresBase, p.coresBase);
  });
  if (paraSincronizar.length === 0) return;

  await Promise.all(
    paraSincronizar.map(({ id, coresBase, ...dados }) => {
      const { variaveis, ehEscuro } = gerarPaletaCompleta(coresBase);
      const jaExistia = existentesPorId.has(id);
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
          // criadoEm só na criação — escrever de novo a cada sincronização
          // faria o valor mudar toda vez (mesmo com o resto idêntico),
          // reintroduzindo o loop que este comentário está explicando.
          ...(jaExistia ? {} : { criadoEm: serverTimestamp() }),
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
