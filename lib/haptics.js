// ============================================================================
// Vibração (haptics). A API Vibration só existe em navegadores/celulares que
// suportam (majoritariamente Android/Chrome — iOS Safari não suporta), então
// toda chamada é protegida e nunca deve quebrar o app onde não houver suporte.
// ============================================================================

function suportaVibracao() {
  return typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'vibrate' in navigator;
}

/** Vibração curta e leve — usada ao completar uma missão. */
export function vibrarMissaoConcluida() {
  if (!suportaVibracao()) return;
  try {
    navigator.vibrate(20);
  } catch {
    // ambiente sem suporte real (ex.: alguns webviews) — ignora silenciosamente
  }
}

/** Vibração bem curta — usada em toques lúdicos sem consequência (ex.: cutucar a fogueira do streak no perfil). */
export function vibrarToqueLeve() {
  if (!suportaVibracao()) return;
  try {
    navigator.vibrate(12);
  } catch {
    // ambiente sem suporte real — ignora silenciosamente
  }
}

/** Vibração longa — usada ao desbloquear e ao abrir uma conquista. */
export function vibrarConquista() {
  if (!suportaVibracao()) return;
  try {
    navigator.vibrate([40, 30, 90]);
  } catch {
    // ambiente sem suporte real — ignora silenciosamente
  }
}
