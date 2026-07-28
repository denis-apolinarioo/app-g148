// ============================================================================
// ARQUIVO CENTRAL DE CONFIGURAÇÃO DO APP
// ----------------------------------------------------------------------------
// Todo mundo que for alterar pontos, textos de missão, ou lista de conquistas
// deve mexer SÓ aqui. Nenhuma outra parte do código tem número de ponto ou
// texto de missão "fixo" — tudo lê daqui. Isso é o que permite recalibrar o
// jogo (pontos, perguntas, se pede foto) sem precisar reescrever telas.
// ============================================================================

export const VERSICULO_TEMA = {
  referencia: 'Romanos 14:8',
  texto:
    'Porque, se vivemos, para o Senhor vivemos; e, se morremos, para o Senhor morremos. Portanto, quer vivamos, quer morramos, pertencemos ao Senhor.',
  versao: 'NAA',
};

// ----------------------------------------------------------------------------
// MISSÕES DIÁRIAS — resetam 00:00h horário de Brasília
// ----------------------------------------------------------------------------
// tipo: 'check' (confirmação simples via pop-up) | 'texto' (campo curto,
//        sem foto) | 'reflexao' (pergunta(s) + foto opcional)
// postaNoFeed: se a resposta desta missão vira post automático no feed
export const MISSOES_DIARIAS = [
  {
    id: 'oracao_matinal',
    titulo: 'Oração Matinal',
    tipo: 'check',
    icone: 'sunrise',
    perguntaConfirmacao:
      'Você confirma perante Deus que realizou a oração durante a manhã?',
    pontos: 10,
    postaNoFeed: false,
  },
  {
    id: 'oracao_noturna',
    titulo: 'Oração Noturna',
    tipo: 'check',
    icone: 'moon',
    perguntaConfirmacao:
      'Você confirma perante Deus que realizou a oração durante a noite?',
    pontos: 10,
    postaNoFeed: false,
  },
  {
    id: 'oracao_especial',
    titulo: 'Oração Especial',
    tipo: 'texto',
    icone: 'hand-heart',
    campos: [
      { chave: 'motivo', label: 'Fiz uma oração especial por:', tipo: 'texto-curto' },
    ],
    permiteFoto: false,
    pontos: 15,
    postaNoFeed: true,
  },
  {
    id: 'devocional_matinal',
    titulo: 'Devocional Matinal',
    tipo: 'reflexao',
    icone: 'book-open',
    campos: [
      { chave: 'trecho', label: 'Qual trecho da Bíblia você leu hoje?', tipo: 'texto-curto' },
      {
        chave: 'reflexao',
        label: 'O que Deus falou com você através desse texto?',
        tipo: 'texto-longo',
      },
    ],
    permiteFoto: true,
    pontos: 20,
    postaNoFeed: true,
  },
  {
    id: 'devocional_noturno',
    titulo: 'Devocional Noturno',
    tipo: 'reflexao',
    icone: 'book-open',
    campos: [
      { chave: 'trecho', label: 'Qual trecho da Bíblia você leu hoje?', tipo: 'texto-curto' },
      {
        chave: 'reflexao',
        label: 'Olhando pra hoje, onde você viu Deus agindo?',
        tipo: 'texto-longo',
      },
    ],
    permiteFoto: true,
    pontos: 20,
    postaNoFeed: true,
  },
  {
    id: 'momento_adoracao',
    titulo: 'Momento de Adoração',
    tipo: 'reflexao',
    icone: 'music',
    campos: [
      { chave: 'musica', label: 'Qual foi a música usada no seu momento de adoração?', tipo: 'link' },
      { chave: 'reflexao', label: 'O que você refletiu com este louvor?', tipo: 'texto-longo' },
    ],
    permiteFoto: true,
    pontos: 20,
    postaNoFeed: true,
  },
  {
    id: 'atividade_missionaria',
    titulo: 'Atividade Missionária',
    tipo: 'reflexao',
    icone: 'heart-handshake',
    campos: [
      {
        chave: 'reflexao',
        label: 'O que você fez hoje para impactar a vida de alguém para Cristo?',
        tipo: 'texto-longo',
      },
    ],
    permiteFoto: true,
    pontos: 25,
    postaNoFeed: true,
  },
];

// ----------------------------------------------------------------------------
// MISSÕES SEMANAIS — resetam toda semana (ver lib/dateUtils.js -> currentWeekId)
// ----------------------------------------------------------------------------
export const MISSOES_SEMANAIS = [
  {
    id: 'atividade_fisica',
    titulo: 'Atividade Física',
    tipo: 'reflexao',
    icone: 'dumbbell',
    campos: [{ chave: 'atividade', label: 'Qual atividade você praticou?', tipo: 'texto-curto' }],
    permiteFoto: true,
    pontos: 40,
    postaNoFeed: true,
  },
];

// ----------------------------------------------------------------------------
// MISSÕES MENSAIS / BIMESTRAIS
// ----------------------------------------------------------------------------
export const MISSOES_MENSAIS = [
  {
    id: 'leitura_livro',
    titulo: 'Leitura do Livro',
    tipo: 'leitura',
    icone: 'book',
    descricao: 'Leia o livro indicado e marque como concluído quando terminar.',
    linkDrive: '', // Preencher no painel admin quando definir o livro do bimestre
    pontos: 100,
    postaNoFeed: true,
    exigeAprovacaoAdmin: false,
  },
];

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
  },
  {
    id: 'madrugador_de_deus',
    nome: 'Madrugador de Deus',
    descricao: 'Completou o devocional matinal 7 dias seguidos.',
    icone: 'sunrise',
  },
  {
    id: 'coracao_missionario',
    nome: 'Coração Missionário',
    descricao: 'Completou 10 atividades missionárias.',
    icone: 'heart-handshake',
  },
  {
    id: 'voz_do_louvor',
    nome: 'Voz do Louvor',
    descricao: 'Registrou 15 momentos de adoração.',
    icone: 'music',
  },
  {
    id: 'intercessor',
    nome: 'Intercessor',
    descricao: 'Orou por 20 pedidos de oração diferentes.',
    icone: 'hand-heart',
  },
  {
    id: 'fiel_nas_pequenas_coisas',
    nome: 'Fiel nas Pequenas Coisas',
    descricao: 'Manteve uma sequência de 60 dias ativos no app.',
    icone: 'gem',
  },
  {
    id: 'primeira_palavra',
    nome: 'Primeira Palavra',
    descricao: 'Fez seu primeiro post no Feed.',
    icone: 'message-circle',
  },
  {
    id: 'rato_de_biblioteca',
    nome: 'Rato de Biblioteca (versão gospel)',
    descricao: 'Concluiu 3 leituras de livro indicadas.',
    icone: 'book',
  },
  {
    id: 'top_3',
    nome: 'Pódio da Temporada',
    descricao: 'Terminou uma temporada trimestral entre os 3 primeiros.',
    icone: 'trophy',
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
