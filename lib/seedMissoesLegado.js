// ============================================================================
// SEED (dados iniciais) das missões que existiam hardcoded no código antes de
// o CRUD de missões (lib/missionsRepo.js) passar a guardar tudo no Firestore.
// Hoje isso só é usado por migrarMissoesDoCodigoParaFirestore() (rodada uma
// única vez pelo Admin, no painel > aba Missões > "Migrar missões do
// código") — depois que a migração roda, editar missão é feito pelo painel
// admin, não mais aqui. Este arquivo fica separado de lib/constants.js
// (que reúne config "viva" do app) porque isso é dado histórico/seed, não
// configuração atual.
// ============================================================================

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
