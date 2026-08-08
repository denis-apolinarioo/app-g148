// ============================================================================
// Slugify compartilhado — usado tanto pra gerar o ID de uma missão nova
// (lib/missionsRepo.js) quanto pra gerar a "chave interna" de um campo de
// resposta a partir do texto da pergunta (Admin > Missões). Ficou num
// arquivo próprio pra não duplicar a mesma lógica nos dois lugares.
// ============================================================================
export function slugify(texto) {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}
