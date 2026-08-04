// ============================================================================
// EMBLEMAS (tiers de conquista) — diamante / ouro / prata / bronze / ferro.
//
// Cada conquista pode opcionalmente ter um `emblema` (ver lib/conquistasRepo.js
// e o seletor em AbaConquistas.js). É a "capa 3d" que fica por trás/ao redor
// da foto/ícone da conquista (components/EmblemaConquista.js), com uma
// animação de brilho — mais forte no diamante, mais discreta no ferro.
//
// As imagens em si vivem em /public/emblemas/<id>.png (fixas no projeto, não
// é upload — não existe outro lugar pra trocar o desenho a não ser mexendo
// direto nesses arquivos).
// ============================================================================

export const EMBLEMAS = [
  {
    id: 'ferro',
    nome: 'Ferro',
    ordem: 1,
    corBrilho: 'rgba(214, 214, 219, 0.5)',
    intensidade: 0.32,
    duracaoSeg: 5.6,
  },
  {
    id: 'bronze',
    nome: 'Bronze',
    ordem: 2,
    corBrilho: 'rgba(255, 202, 148, 0.6)',
    intensidade: 0.48,
    duracaoSeg: 4.6,
  },
  {
    id: 'prata',
    nome: 'Prata',
    ordem: 3,
    corBrilho: 'rgba(255, 255, 255, 0.7)',
    intensidade: 0.6,
    duracaoSeg: 3.9,
  },
  {
    id: 'ouro',
    nome: 'Ouro',
    ordem: 4,
    corBrilho: 'rgba(255, 223, 140, 0.85)',
    intensidade: 0.78,
    duracaoSeg: 3.1,
  },
  {
    id: 'diamante',
    nome: 'Diamante',
    ordem: 5,
    corBrilho: 'rgba(160, 221, 255, 0.95)',
    intensidade: 0.95,
    duracaoSeg: 2.3,
  },
];

export const EMBLEMAS_POR_ID = Object.fromEntries(EMBLEMAS.map((e) => [e.id, e]));

export function caminhoEmblema(id) {
  return `/emblemas/${id}.png`;
}
