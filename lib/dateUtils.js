// Todas as funções aqui usam o fuso horário de Brasília (America/Sao_Paulo)
// como referência FIXA, não o fuso do aparelho da pessoa. Isso evita o bug
// de alguém "ganhar" ou "perder" um dia de missão por estar com o celular
// configurado em outro fuso horário.

const TIME_ZONE = 'America/Sao_Paulo';

/**
 * Retorna a data de "hoje" no fuso de Brasília, no formato YYYY-MM-DD.
 * Esse valor é usado como parte do ID dos documentos de missão diária,
 * o que naturalmente evita duplicidade (ver missions.js).
 */
export function todayBrasilia() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date()); // já vem como YYYY-MM-DD
}

/**
 * Igual todayBrasilia(), mas pra uma data/Timestamp qualquer (não só
 * "agora") — usado pra agrupar registros (ex.: submissões de missão) por
 * dia no fuso de Brasília. Aceita Date ou Firestore Timestamp.
 */
export function dateStrBrasilia(date) {
  const d = date?.toDate ? date.toDate() : new Date(date);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(d);
}

/**
 * Hora do dia (0-23) de uma data/Timestamp, no fuso de Brasília — usado
 * pra checar se uma ação aconteceu dentro de uma janela de horário (ex.:
 * conquista "Sagrado Despertador", oração de madrugada).
 */
export function horaBrasilia(date) {
  const d = date?.toDate ? date.toDate() : new Date(date);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    hour12: false,
  });
  return parseInt(formatter.format(d), 10) % 24;
}

/**
 * Hora:minuto atuais ("HH:MM"), no fuso de Brasília — usado pra checar se
 * "agora" está dentro da janela de visibilidade de uma missão/categoria
 * (ver dentroDaJanelaHorario abaixo).
 */
export function horaMinutoBrasilia() {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return formatter.format(new Date()); // já vem como HH:MM
}

/**
 * Diz se "agora" (fuso de Brasília) está dentro da janela [horaInicio,
 * horaFim), ambos no formato "HH:MM". Suporta janela que passa da meia-noite
 * (ex.: 22:00 até 06:00) — nesse caso horaInicio > horaFim e a janela é
 * tratada como "depois do início OU antes do fim".
 *
 * Sem horaInicio/horaFim definidos, considera sempre visível (retorna true) —
 * esse é o comportamento padrão de missão/categoria sem horário configurado.
 */
export function dentroDaJanelaHorario(horaInicio, horaFim) {
  if (!horaInicio || !horaFim) return true;
  const agora = horaMinutoBrasilia();
  if (horaInicio === horaFim) return true; // janela "vazia" — não restringe nada
  if (horaInicio < horaFim) {
    return agora >= horaInicio && agora < horaFim;
  }
  // Janela vira a noite (ex.: 22:00–06:00)
  return agora >= horaInicio || agora < horaFim;
}

/**
 * Converte uma data (Date ou Firestore Timestamp) para uma string amigável
 * em português, já considerando o fuso de Brasília.
 */
export function formatDateBR(date) {
  const d = date?.toDate ? date.toDate() : new Date(date);
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

export function formatDateTimeBR(date) {
  const d = date?.toDate ? date.toDate() : new Date(date);
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/**
 * Quantos dias faltam até uma data-limite (prazo de oração), considerando
 * o fuso de Brasília. Retorna número negativo se já passou do prazo.
 */
export function daysUntil(dateStr) {
  const todayStr = todayBrasilia();
  const today = new Date(`${todayStr}T00:00:00-03:00`);
  const target = new Date(`${dateStr}T00:00:00-03:00`);
  const diffMs = target.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Retorna true se a data-limite já passou (considerando fuso de Brasília).
 */
export function isPastDeadline(dateStr) {
  return daysUntil(dateStr) < 0;
}

/**
 * Calcula o "número da semana" do ano (usado para IDs de missão semanal),
 * de forma estável e determinística, no fuso de Brasília.
 */
export function currentWeekId() {
  const todayStr = todayBrasilia();
  const d = new Date(`${todayStr}T00:00:00-03:00`);
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const diff = target - firstThursday;
  const week = 1 + Math.round(diff / (7 * 24 * 60 * 60 * 1000));
  return `${target.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

/**
 * ID do mês corrente (usado para missões mensais/bimestrais), fuso Brasília.
 */
export function currentMonthId() {
  return todayBrasilia().slice(0, 7); // YYYY-MM
}

// Janela de edição de um post (ver components/PostCard.js e
// components/EditarPostModal.js) — depois desse prazo desde a criação, o
// dono não pode mais editar o post. O mesmo limite é reforçado no
// firestore.rules (função podeEditarConteudoDoPost), então não dá pra
// burlar só escondendo/reexibindo o botão no navegador.
export const JANELA_EDICAO_POST_MS = 24 * 60 * 60 * 1000;

/**
 * Se um post ainda pode ser editado pelo dono, com base em `createdAt`.
 * Um post recém-criado, cujo `createdAt` (serverTimestamp) ainda não foi
 * confirmado pelo servidor, chega como `null/undefined` por um instante —
 * nesse caso, tratamos como "ainda editável" (post novíssimo).
 */
export function postAindaEditavel(createdAt) {
  if (!createdAt?.toDate) return true;
  return Date.now() - createdAt.toDate().getTime() < JANELA_EDICAO_POST_MS;
}
