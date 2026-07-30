// ============================================================================
// Normalização de texto para busca (itens 15º e 16º da lista de prioridade).
// Remove acentos e caixa alta/baixa, pra "joao", "João" e "JOÃO" darem o
// mesmo resultado numa busca simples por nome/username/texto de post.
// ============================================================================

export function normalizarBusca(texto) {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // remove acentos
}

export function combinaComBusca(campo, termoBusca) {
  const termo = normalizarBusca(termoBusca).trim();
  if (!termo) return true;
  return normalizarBusca(campo).includes(termo);
}
