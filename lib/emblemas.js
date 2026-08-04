// ============================================================================
// EMBLEMAS (tiers de conquista) — diamante / rubi / esmeralda / ouro / prata /
// bronze / ferro.
//
// Cada conquista pode opcionalmente ter um `emblema` (ver lib/conquistasRepo.js
// e o seletor em AbaConquistas.js). É a "capa 3d" que fica por trás/ao redor
// da foto/ícone da conquista (components/EmblemaConquista.js), com uma
// animação de brilho — mais forte no diamante, mais discreta no ferro.
//
// As imagens em si vivem em /public/emblemas/<id>.png (fixas no projeto, não
// é upload — não existe outro lugar pra trocar o desenho a não ser mexendo
// direto nesses arquivos).
//
// `moldura` é a geometria de encaixe de cada PNG: a foto preenche o círculo
// TODO (100% do selo), e o anel/moldura entra por cima como um elemento
// maior que o próprio círculo, "por fora" dele (anel + louros ultrapassando
// a borda), em vez de ficar encolhido pra caber dentro:
//   escala   — tamanho da moldura em % do círculo (sempre >100%, porque ela
//              precisa "vazar" pra fora)
//   deslocX/deslocY — deslocamento (esquerda/topo) em % do círculo, sempre
//              negativo, pra centralizar o vão do anel exatamente sobre o
//              círculo da foto
//
// Apesar do PNG de esmeralda/rubi ser um canvas maior (900x900 vs 400x400
// dos outros 5), medindo o vão transparente real dos 7 arquivos a folga ao
// redor do anel é praticamente a mesma proporção em todos — por isso os 7
// tiers usam só DOIS conjuntos de valores, e não um ajuste por PNG: ferro /
// bronze / prata / ouro compartilham um valor, diamante / esmeralda / rubi
// compartilham outro (ligeiramente maior). NÃO dar um `escala` maior e
// separado pra esmeralda/rubi achando que o canvas 900x900 exige — já foi
// testado, o anel ficava visivelmente maior que o dos outros tiers.
// ============================================================================

export const EMBLEMAS = [
  {
    id: 'ferro',
    nome: 'Ferro',
    ordem: 1,
    corBrilho: 'rgba(214, 214, 219, 0.5)',
    intensidade: 0.32,
    duracaoSeg: 5.6,
    moldura: { escala: '168.1%', deslocX: '-34.0%', deslocY: '-23.5%' },
  },
  {
    id: 'bronze',
    nome: 'Bronze',
    ordem: 2,
    corBrilho: 'rgba(255, 202, 148, 0.6)',
    intensidade: 0.48,
    duracaoSeg: 4.6,
    moldura: { escala: '168.1%', deslocX: '-34.0%', deslocY: '-24.8%' },
  },
  {
    id: 'prata',
    nome: 'Prata',
    ordem: 3,
    corBrilho: 'rgba(255, 255, 255, 0.7)',
    intensidade: 0.6,
    duracaoSeg: 3.9,
    moldura: { escala: '168.1%', deslocX: '-34.0%', deslocY: '-24.8%' },
  },
  {
    id: 'ouro',
    nome: 'Ouro',
    ordem: 4,
    corBrilho: 'rgba(255, 223, 140, 0.85)',
    intensidade: 0.78,
    duracaoSeg: 3.1,
    moldura: { escala: '168.1%', deslocX: '-34.0%', deslocY: '-24.8%' },
  },
  {
    id: 'esmeralda',
    nome: 'Esmeralda',
    ordem: 5,
    corBrilho: 'rgba(110, 231, 160, 0.88)',
    intensidade: 0.85,
    duracaoSeg: 2.8,
    moldura: { escala: '168.8%', deslocX: '-34.2%', deslocY: '-25.3%' },
  },
  {
    id: 'rubi',
    nome: 'Rubi',
    ordem: 6,
    corBrilho: 'rgba(255, 110, 110, 0.9)',
    intensidade: 0.9,
    duracaoSeg: 2.5,
    moldura: { escala: '168.8%', deslocX: '-34.2%', deslocY: '-25.3%' },
  },
  {
    id: 'diamante',
    nome: 'Diamante',
    ordem: 7,
    corBrilho: 'rgba(160, 221, 255, 0.95)',
    intensidade: 0.95,
    duracaoSeg: 2.3,
    moldura: { escala: '168.8%', deslocX: '-34.2%', deslocY: '-25.3%' },
  },
];

export const EMBLEMAS_POR_ID = Object.fromEntries(EMBLEMAS.map((e) => [e.id, e]));

export function caminhoEmblema(id) {
  return `/emblemas/${id}.png`;
}
