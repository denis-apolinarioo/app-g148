// ============================================================================
// ARQUIVO CENTRAL DE CONFIGURAÇÃO DO APP
// ----------------------------------------------------------------------------
// Config "viva" do app: pontos de ações fora de missão, lista de conquistas,
// cores da marca, tags de função. Isso é o que permite recalibrar o jogo sem
// precisar reescrever telas.
//
// As MISSÕES não ficam mais aqui — hoje são um CRUD completo no Firestore
// (lib/missionsRepo.js), editável direto pelo painel Admin > aba Missões.
// O array que existia aqui antes da migração virou seed histórico, ver
// lib/seedMissoesLegado.js.
// ============================================================================

export const VERSICULO_TEMA = {
  referencia: 'Romanos 14:8',
  texto:
    'Porque, se vivemos, para o Senhor vivemos; e, se morremos, para o Senhor morremos. Portanto, quer vivamos, quer morramos, pertencemos ao Senhor.',
  versao: 'NAA',
};

// ----------------------------------------------------------------------------
// PONTOS — outras fontes (fora as missões)
// ----------------------------------------------------------------------------
export const PONTOS = {
  postarNoFeed: 5,
  orarPorAlguem: 5,
  streakBonusPorDia: 2, // bônus por dia consecutivo de pelo menos 1 missão cumprida
};

// ----------------------------------------------------------------------------
// CONQUISTAS / BADGES — lista inicial (expansível depois pelo painel admin)
// ----------------------------------------------------------------------------
export const CONQUISTAS = [
  {
    id: 'orador_absoluto',
    nome: 'Orador Absoluto',
    descricao: 'Cumpriu oração matinal e noturna por 30 dias seguidos.',
    icone: 'flame',
    contadorTipo: 'streak',
    meta: 30,
  },
  {
    id: 'madrugador_de_deus',
    nome: 'Madrugador de Deus',
    descricao: 'Completou o devocional matinal 7 dias seguidos.',
    icone: 'sunrise',
    contadorTipo: 'missao:devocional_matinal',
    meta: 7,
  },
  {
    id: 'coracao_missionario',
    nome: 'Coração Missionário',
    descricao: 'Completou 10 atividades missionárias.',
    icone: 'heart-handshake',
    contadorTipo: 'missao:atividade_missionaria',
    meta: 10,
  },
  {
    id: 'voz_do_louvor',
    nome: 'Voz do Louvor',
    descricao: 'Registrou 15 momentos de adoração.',
    icone: 'music',
    contadorTipo: 'missao:momento_adoracao',
    meta: 15,
  },
  {
    id: 'intercessor',
    nome: 'Intercessor',
    descricao: 'Orou por 20 pedidos de oração diferentes.',
    icone: 'hand-heart',
    contadorTipo: 'oracao',
    meta: 20,
  },
  {
    id: 'fiel_nas_pequenas_coisas',
    nome: 'Fiel nas Pequenas Coisas',
    descricao: 'Manteve uma sequência de 60 dias ativos no app.',
    icone: 'gem',
    contadorTipo: 'streak',
    meta: 60,
  },
  {
    id: 'primeira_palavra',
    nome: 'Primeira Palavra',
    descricao: 'Fez seu primeiro post no Feed.',
    icone: 'message-circle',
    contadorTipo: 'post',
    meta: 1,
  },
  {
    id: 'rato_de_biblioteca',
    nome: 'Rato de Biblioteca (versão gospel)',
    descricao: 'Concluiu 3 leituras de livro indicadas.',
    icone: 'book',
    contadorTipo: 'missao:leitura_livro',
    meta: 3,
  },
  {
    id: 'top_3',
    nome: 'Pódio da Temporada',
    descricao: 'Terminou uma temporada trimestral entre os 3 primeiros.',
    icone: 'trophy',
    contadorTipo: 'manual',
    meta: null,
  },
];

// ----------------------------------------------------------------------------
// CORES DA MARCA — espelha o tailwind.config.js, útil pra usar em SVG/canvas
// (ex: gerar imagem de conquista) onde classes Tailwind não chegam.
// ----------------------------------------------------------------------------
export const CORES = {
  creme: '#FAF6EF',
  cremeSoft: '#F3ECE0',
  cremeCard: '#FFFDF9',
  marromClaro: '#AC8760',
  marrom: '#6B4A2F',
  marromEscuro: '#3F2C1C',
  dourado: '#B8863B',
};

export const TAGS_FUNCAO = [
  'Membro',
  'Líder de Louvor',
  'Líder de Célula',
  'Intercessor(a)',
  'Mídia e Comunicação',
  'Recepção',
];
