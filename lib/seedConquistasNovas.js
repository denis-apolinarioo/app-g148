// ============================================================================
// Seed das "25 conquistas novas" pedidas pelo usuário (20 com níveis
// I/II/III + 5 únicas = 65 documentos). Mesmo espírito de CONQUISTAS em
// lib/constants.js (fonte só de leitura pra migração — depois de migrada
// pro Firestore, editar/excluir é tudo pelo painel Admin > Conquistas).
//
// contadorTipo usados aqui que já existiam no motor (lib/achievements.js):
//   'streak' | 'post' | 'oracao' | 'dracma_saldo' | 'missao:<id>' |
//   'categoria:<id>' | 'manual'
// contadorTipo NOVOS, adicionados a lib/achievements.js junto com este bloco:
//   'curtidas_por_post:<N>'      — quantos posts próprios já bateram N curtidas
//   'curtidas_dadas'             — em quantos posts (de outras pessoas) curtiu
//   'comentarios'                — total de comentários feitos
//   'dias_3_oracoes'             — dias com as 3 orações diárias no mesmo dia
//   'categoria_audio_min:id:seg' — posts de uma categoria com áudio de N segundos+
//   'oracao_audio'               — orações diárias enviadas com áudio
//   'conquistas_desbloqueadas'   — quantas conquistas diferentes já tem
//   'cadastro'                   — sempre verdadeiro (concede no 1º dia)
//   'conta_idade_dias'           — dias desde a criação da conta
//   'madrugada_oracao'           — orações diárias feitas na janela de madrugada
//   'pedido_e_oracoes:<N>'       — fez pedido próprio E orou por N pessoas
//   'top1_dias_seguidos'         — dias seguidos em 1º no ranking (aproximado)
//
// ATENÇÃO — 4 conquistas dependem de MISSÕES que ainda não existem (você
// cria quando quiser, no Admin > Missões, com QUALQUER pontuação/campos que
// preferir — só o NOME precisa gerar o ID abaixo pra conquista "linkar"
// sozinha; se preferir usar outro ID, edite o contadorTipo da conquista
// depois de migrada):
//   • "Pescador de Gente"   → crie uma missão com o nome "Estudo Biblico" (ID: estudo_biblico)
//   • "Ide (VAI LOGO)"      → crie uma missão com o nome "Convite Evento" (ID: convite_evento)
//   • "Quase um Escriba"    → crie uma missão com o nome "Reflexao Meditacao" (ID: reflexao_meditacao)
//   • "Com fé e água..."    → crie uma missão com o nome "Jejum" (ID: jejum)
// E 2 dependem de CATEGORIAS DE POST (Admin > Categorias) com nome "Lanche"
// (ID: lanche) e "Musica" (ID: musica) — "Tô na arca de Noé" espera uma
// categoria "Animais" (ID: animais). Enquanto a missão/categoria com esse ID
// não existir, a conquista fica parada (nunca é concedida por engano) — ela
// só passa a contar a partir do dia em que a missão/categoria for criada.
// ============================================================================

function niveis(baseId, baseNome, descricaoPorNivel, icone, contadorTipoFn, metas) {
  const sufixos = ['I', 'II', 'III'];
  return metas.map((meta, i) => ({
    id: `${baseId}_${i + 1}`,
    nome: `${baseNome} ${sufixos[i]}`,
    descricao: descricaoPorNivel(meta, i),
    icone,
    contadorTipo: contadorTipoFn(meta, i),
    meta,
  }));
}

export const CONQUISTAS_NOVAS_SEED = [
  // 1. Luz do Feed — curtidas recebidas: 10 num post / em 10 posts / em 100 posts
  ...niveis(
    'luz_do_feed',
    'Luz do Feed',
    (meta) => (meta === 1
      ? 'Alcançou 10 curtidas em 1 post.'
      : `Alcançou 10 curtidas em ${meta} posts diferentes.`),
    'heart',
    () => 'curtidas_por_post:10',
    [1, 10, 100]
  ),

  // 2. Sansão sem Dalila — dias com exercício físico
  ...niveis(
    'sansao_sem_dalila',
    'Sansão sem Dalila',
    (meta) => `Cumpriu a missão de exercício físico em ${meta} ocasiões.`,
    'dumbbell',
    () => 'missao:atividade_fisica',
    [10, 30, 90]
  ),

  // 3. Daniel na Janelinha — dias com as 3 orações no mesmo dia
  ...niveis(
    'daniel_na_janelinha',
    'Daniel na Janelinha',
    (meta) => `Fez as 3 orações do dia no mesmo dia, ${meta}x.`,
    'calendar-check',
    () => 'dias_3_oracoes',
    [3, 10, 30]
  ),

  // 4. Arautos da Shoppe — áudio cantando (categoria música, 1min+)
  ...niveis(
    'arautos_da_shoppe',
    'Arautos da Shoppe',
    (meta) => `Postou ${meta} áudio(s) cantando (categoria Música, 1 minuto ou mais).`,
    'mic-2',
    () => 'categoria_audio_min:musica:60',
    [1, 3, 10]
  ),

  // 5. Servo Bom e Fiel — streak de constância
  ...niveis(
    'servo_bom_e_fiel',
    'Servo Bom e Fiel',
    (meta) => `Manteve uma sequência de constância por ${meta} dias.`,
    'flame',
    () => 'streak',
    [7, 14, 28]
  ),

  // 6. Pescador de Gente — estudos bíblicos (vinculada a missão específica)
  ...niveis(
    'pescador_de_gente',
    'Pescador de Gente',
    (meta) => `Concluiu ${meta} estudo(s) bíblico(s).`,
    'fish',
    () => 'missao:estudo_biblico',
    [1, 3, 7]
  ),

  // 7. Ide (VAI LOGO) — convidou amigos pra eventos (print de convite)
  ...niveis(
    'ide_vai_logo',
    'Ide (VAI LOGO)',
    (meta) => `Convidou amigos pra eventos ${meta}x (print de convite).`,
    'send',
    () => 'missao:convite_evento',
    [3, 7, 20]
  ),

  // 8. Quase um Escriba — reflexões de meditações
  ...niveis(
    'quase_um_escriba',
    'Quase um Escriba',
    (meta) => `Escreveu ${meta} reflexões de meditação.`,
    'pen-line',
    () => 'missao:reflexao_meditacao',
    [3, 10, 30]
  ),

  // 9. Semeador Digital — posts publicados
  ...niveis(
    'semeador_digital',
    'Semeador Digital',
    (meta) => `Publicou ${meta} posts no Feed.`,
    'sprout',
    () => 'post',
    [10, 30, 100]
  ),

  // 10. Publicano (honesto, viu?) — saldo de Dracma acumulado
  ...niveis(
    'publicano',
    'Publicano (honesto, viu?)',
    (meta) => `Acumulou ${meta.toLocaleString('pt-BR')} Dracmas de saldo.`,
    'coins',
    () => 'dracma_saldo',
    [5000, 20000, 100000]
  ),

  // 11. Fornecedor do Maná — post categoria "lanche" com foto
  ...niveis(
    'fornecedor_do_mana',
    'Fornecedor do Maná',
    (meta) => `Postou foto na categoria Lanche ${meta}x.`,
    'sandwich',
    () => 'categoria:lanche',
    [3, 10, 30]
  ),

  // 12. Whatsapp do Céu — "orar por alguém"
  ...niveis(
    'whatsapp_do_ceu',
    'Whatsapp do Céu',
    (meta) => `Usou "orar por alguém" ${meta}x.`,
    'phone-call',
    () => 'oracao',
    [5, 15, 50]
  ),

  // 13. Jumenta de Balaão — comentários
  ...niveis(
    'jumenta_de_balaao',
    'Jumenta de Balaão',
    (meta) => `Fez ${meta} comentários.`,
    'message-square',
    () => 'comentarios',
    [10, 50, 200]
  ),

  // 14. Paulo no Whatsapp — áudio orando
  ...niveis(
    'paulo_no_whatsapp',
    'Paulo no Whatsapp',
    (meta) => `Enviou ${meta} áudio(s) orando.`,
    'mic',
    () => 'oracao_audio',
    [3, 10, 30]
  ),

  // 15. Multiplicador de Likes — curtiu posts diferentes
  ...niveis(
    'multiplicador_de_likes',
    'Multiplicador de Likes',
    (meta) => `Curtiu ${meta} posts diferentes.`,
    'heart-handshake',
    () => 'curtidas_dadas',
    [10, 50, 200]
  ),

  // 16. Sagrado Despertador — oração feita de madrugada
  ...niveis(
    'sagrado_despertador',
    'Sagrado Despertador',
    (meta) => `Orou de madrugada ${meta}x.`,
    'alarm-clock',
    () => 'madrugada_oracao',
    [3, 10, 50]
  ),

  // 17. Bom Samaritano — atividades missionárias concluídas
  ...niveis(
    'bom_samaritano',
    'Bom Samaritano',
    (meta) => `Concluiu ${meta} atividades missionárias.`,
    'life-buoy',
    () => 'missao:atividade_missionaria',
    [3, 10, 50]
  ),

  // 18. Com fé e água, nada me falta — missões de jejum concluídas
  ...niveis(
    'com_fe_e_agua',
    'Com fé e água, nada me falta',
    (meta) => `Concluiu ${meta} missão(ões) de jejum.`,
    'droplets',
    () => 'missao:jejum',
    [1, 3, 10]
  ),

  // 19. Mil e um talentos — conquistas diferentes desbloqueadas
  ...niveis(
    'mil_e_um_talentos',
    'Mil e um talentos',
    (meta) => `Desbloqueou ${meta} conquistas diferentes.`,
    'gem',
    () => 'conquistas_desbloqueadas',
    [7, 21, 50]
  ),

  // 20. Tô na arca de Noé — fotos com animais (categoria Animais)
  ...niveis(
    'arca_de_noe',
    'Tô na arca de Noé',
    (meta) => `Postou foto na categoria Animais ${meta}x.`,
    'dog',
    () => 'categoria:animais',
    [3, 10, 30]
  ),

  // ---------------------------------------------------------------------
  // ÚNICAS (1 nível só)
  // ---------------------------------------------------------------------
  {
    id: 'ta_on',
    nome: 'Tá On',
    descricao: 'Primeiro dia de app — todo mundo ganha essa.',
    icone: 'zap',
    contadorTipo: 'cadastro',
    meta: 1,
  },
  {
    id: 'um_orando_por_todos',
    nome: 'Um Orando por Todos, Todos Orando por Um',
    descricao: 'Fez 1 pedido de oração e orou por 10 pessoas diferentes.',
    icone: 'users',
    contadorTipo: 'pedido_e_oracoes:10',
    meta: 10,
  },
  {
    id: 'planando_como_aguia',
    nome: 'Planando como Águia',
    descricao: '1º lugar no ranking por 3 dias seguidos.',
    icone: 'crown',
    contadorTipo: 'top1_dias_seguidos',
    meta: 3,
  },
  {
    id: 'aprendiz_de_joao_batista',
    nome: 'Aprendiz de João Batista',
    descricao: 'Levou alguém ao tanque batismal.',
    icone: 'droplet',
    contadorTipo: 'manual', // sem gatilho automático — precisa de concessão manual (mesmo caso já existente de "Pódio da Temporada")
    meta: null,
  },
  {
    id: 'adao_e_eva_do_app',
    nome: 'Adão e Eva do App',
    descricao: '1 ano de conta no app.',
    icone: 'cake',
    contadorTipo: 'conta_idade_dias',
    meta: 365,
  },
];
