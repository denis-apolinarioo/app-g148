// ============================================================================
// GERADOR DE PALETA — aba Estética do Admin.
// ----------------------------------------------------------------------------
// O Admin escolhe só 4 cores-base por preset (Fundo, Cartão, Principal,
// Destaque) + nome + ícone. Esta função expande essas 4 cores pra TODAS as
// variáveis CSS que o app usa (escala coffee-50..900, cream-soft e gold-soft)
// — o "resto gerado automaticamente pra deixar natural" que foi pedido.
//
// COMO FUNCIONA (resumo — comentário mais completo dentro de
// gerarEscalaCoffee): a escala coffee-50..900 é construída interpolando a
// LUMINOSIDADE (HSL) entre a Cor de Fundo (âncora do índice 50, quase igual
// ao fundo) e um extremo forte — claro ou escuro, o que fizer mais contraste
// com o fundo (âncora do índice 900) — seguindo a mesma "forma"/proporção de
// passos que a paleta original (marrom) sempre teve, só que agora com
// qualquer matiz (hue) que a Cor Principal escolhida tiver. Por isso o
// mesmo gerador funciona pra criar tanto um preset "claro" quanto um
// "escuro" quanto qualquer outro — não tem um caminho de código separado
// pra cada caso, só o fundo escolhido decide pra qual lado a escala anda.
//
// `forte` (botão sólido/overlay) é gerado à parte, sempre escuro/saturado,
// pra nunca ficar claro demais pro texto claro (cream) de cima sumir em
// cima dele — ver comentário grande em tailwind.config.js.
// ============================================================================

// ---- conversão hex <-> HSL -------------------------------------------------

function hexParaRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

export function rgbParaHsl({ r, g, b }) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r:
        h = ((g - b) / d) % 6;
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: s * 100, l: l * 100 };
}

export function hslParaRgb({ h, s, l }) {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (h < 60) [r1, g1, b1] = [c, x, 0];
  else if (h < 120) [r1, g1, b1] = [x, c, 0];
  else if (h < 180) [r1, g1, b1] = [0, c, x];
  else if (h < 240) [r1, g1, b1] = [0, x, c];
  else if (h < 300) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

export function hexParaHsl(hex) {
  return rgbParaHsl(hexParaRgb(hex));
}

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/** "#RRGGBB" -> "R G B" (formato que a variável CSS precisa, ver globals.css) */
export function hexParaRgbString(hex) {
  const { r, g, b } = hexParaRgb(hex);
  return `${r} ${g} ${b}`;
}

export function hslParaHex({ h, s, l }) {
  const { r, g, b } = hslParaRgb({ h, s: clamp(s, 0, 100), l: clamp(l, 0, 100) });
  const toHex = (n) => clamp(n, 0, 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

// ---- forma de referência da escala original (marrom) -----------------------
// Luminosidade (%) de cada degrau 50..900 da paleta marrom original —
// usada só como "proporção dos passos", não como valor final. Calculada uma
// vez a partir dos hex originais (#F4EDE4 ... #1C140D).
const FORMA_LUMINOSIDADE = [92.5, 82.0, 66.9, 52.5, 40.4, 30.2, 23.7, 17.8, 12.5, 8.0];
const DEGRAUS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];

/**
 * Gera a escala adaptável coffee-50..900 a partir da Cor de Fundo (âncora do
 * degrau 50) e da Cor Principal (dá o matiz/saturação de toda a escala).
 *
 * O degrau 50 fica perto do fundo (não idêntico — um leve empurrão de ~6%
 * na direção do resto da escala, pra continuar dando pra perceber um cartão
 * sutil sobre a página, do jeito que coffee-50 já não era idêntico ao cream
 * na paleta original). O degrau 900 vai pro extremo OPOSTO ao fundo (claro
 * se o fundo é escuro, escuro se o fundo é claro) — é isso que faz um preset
 * de fundo escuro "inverter sozinho" a escala, sem precisar de um caminho de
 * código separado pra modo escuro.
 */
export function gerarEscalaCoffee(corFundoHex, corPrincipalHex) {
  const fundo = hexParaHsl(corFundoHex);
  const principal = hexParaHsl(corPrincipalHex);

  const fundoEscuro = fundo.l < 50;
  const lExtremo = fundoEscuro ? 93 : 8;

  const resultado = {};
  DEGRAUS.forEach((degrau, i) => {
    // progresso normalizado (0 = no fundo, 1 = no extremo forte), na mesma
    // proporção da escala original
    const progressoBruto =
      (FORMA_LUMINOSIDADE[0] - FORMA_LUMINOSIDADE[i]) /
      (FORMA_LUMINOSIDADE[0] - FORMA_LUMINOSIDADE[9]);
    // pequeno empurrão inicial (6%) pra degrau 50 nunca ficar idêntico ao fundo
    const progresso = 0.06 + progressoBruto * 0.94;
    const l = fundo.l + (lExtremo - fundo.l) * progresso;
    resultado[degrau] = hslParaHex({ h: principal.h, s: principal.s, l });
  });
  return resultado; // { 50: '#...', 100: '#...', ..., 900: '#...' }
}

/**
 * Gera a família "forte" (botão sólido, overlay/scrim, texto sobre selo
 * dourado) a partir da Cor Principal — sempre escura/saturada, do mesmo
 * jeito em QUALQUER preset (não depende do fundo), pra continuar legível
 * com texto claro (cream) em cima. Ver comentário grande em
 * tailwind.config.js sobre por que essa família existe separada da escala
 * adaptável.
 */
export function gerarCorForte(corPrincipalHex) {
  const principal = hexParaHsl(corPrincipalHex);
  return {
    DEFAULT: hslParaHex({ h: principal.h, s: principal.s, l: 18 }),
    800: hslParaHex({ h: principal.h, s: principal.s, l: 12.5 }),
    900: hslParaHex({ h: principal.h, s: principal.s, l: 8 }),
  };
}

/**
 * Gera a escala de BORDA (100/200/300/400/700) — reproduz uma correção que
 * já existia no app antes da Estética virar múltiplos presets: no modo
 * escuro (folha de estilo escrita à mão na época), essas bordas usavam um
 * valor GRADUAL PRÓPRIO, mais claro que o correspondente da escala normal
 * nesses mesmos degraus (que nos degraus baixos é escura — pensada pra
 * FUNDO, não pra borda, que precisa de mais contraste pra continuar
 * visível). Virou uma escala mais granular na prática (preenche o "salto"
 * que existe entre o degrau 100, escuro/fundo, e o 200, já claro/texto).
 * No modo claro, a borda usa a escala normal direto, sem ajuste — era
 * assim no app original: só o modo escuro tinha essa correção.
 */
export function gerarBorda(corFundoHex, corPrincipalHex, escala) {
  const fundo = hexParaHsl(corFundoHex);
  if (fundo.l >= 50) {
    return { 100: escala[100], 200: escala[200], 300: escala[300], 400: escala[400], 700: escala[700] };
  }
  const principal = hexParaHsl(corPrincipalHex);
  // Frações calibradas pra bater bem próximo dos valores exatos que o app
  // original usava no modo escuro (#3A2A1B/#4A3624/#5C4530/#6E5238/#8A6644
  // a partir de fundo #0D0906 + principal #CBB593).
  const FRACAO = { 100: 0.145, 200: 0.195, 300: 0.25, 400: 0.325, 700: 0.415 };
  const resultado = {};
  Object.keys(FRACAO).forEach((degrau) => {
    const l = fundo.l + (93 - fundo.l) * FRACAO[degrau];
    resultado[degrau] = hslParaHex({ h: principal.h, s: principal.s, l });
  });
  return resultado;
}

/** Gera o tom "soft" do dourado — mesmo matiz, mais claro (~+19% de luz). */
export function gerarGoldSoft(corDestaqueHex) {
  const destaque = hexParaHsl(corDestaqueHex);
  return hslParaHex({ h: destaque.h, s: destaque.s, l: clamp(destaque.l + 19, 0, 96) });
}

/**
 * BUG CORRIGIDO (texto sumindo em cima de botão/cartão "forte" em preset
 * escuro): o app usava a variável `cream` (fundo da página) como cor de
 * texto/ícone em cima de superfícies "forte" (botões sólidos, o cartão do
 * Verso do Dia, "Sua posição" no Ranking etc.) — funcionava por
 * coincidência nos presets claros (fundo claro = essa variável também
 * clara), mas ficava ILEGÍVEL em qualquer preset de fundo escuro (fundo
 * escuro = variável também escura, texto escuro em cima do forte, que
 * por sua vez é SEMPRE escuro — ver gerarCorForte acima — resultado:
 * escuro em cima de escuro). Esta função gera uma cor separada,
 * dedicada, SEMPRE clara/quase branca, do mesmo jeito em QUALQUER preset
 * — companheira exata do `forte` (que é sempre escuro): uma sempre clara,
 * a outra sempre escura, nenhuma das duas amarrada ao fundo da página.
 */
export function gerarTextoForte(corPrincipalHex) {
  const principal = hexParaHsl(corPrincipalHex);
  return hslParaHex({ h: principal.h, s: Math.min(principal.s, 18), l: 97 });
}

/** Gera o "cream-soft" — o fundo, com um leve empurrão na direção da escala. */
export function gerarCremeSoft(corFundoHex, corPrincipalHex) {
  const fundo = hexParaHsl(corFundoHex);
  const principal = hexParaHsl(corPrincipalHex);
  const fundoEscuro = fundo.l < 50;
  const deslocamento = fundoEscuro ? 0 : -4.5; // no escuro o "soft" já nasce igual ao fundo (ver preset seed)
  return hslParaHex({
    h: principal.h,
    s: Math.min(principal.s, 25),
    l: clamp(fundo.l + deslocamento, 0, 100),
  });
}

/**
 * Monta o pacote completo de variáveis (o que fica salvo em
 * preset.variaveis no Firestore) a partir das 4 cores-base escolhidas no
 * seletor do Admin. Também decide `ehEscuro` (usado pra ligar a classe
 * `dark` — color-scheme + variantes dos ícones em PNG).
 */
export function gerarPaletaCompleta({ fundo, cartao, principal, destaque }) {
  const escala = gerarEscalaCoffee(fundo, principal);
  const forte = gerarCorForte(principal);
  const borda = gerarBorda(fundo, principal, escala);
  const fundoHsl = hexParaHsl(fundo);

  const cores = {
    cream: fundo,
    creamSoft: gerarCremeSoft(fundo, principal),
    creamCard: cartao,
    coffee50: escala[50],
    coffee100: escala[100],
    coffee200: escala[200],
    coffee300: escala[300],
    coffee400: escala[400],
    coffee500: escala[500],
    coffee600: escala[600],
    coffee700: escala[700],
    coffee800: escala[800],
    coffee900: escala[900],
    borda100: borda[100],
    borda200: borda[200],
    borda300: borda[300],
    borda400: borda[400],
    borda700: borda[700],
    forte: forte.DEFAULT,
    forte800: forte[800],
    forte900: forte[900],
    textoForte: gerarTextoForte(principal),
    gold: destaque,
    goldSoft: gerarGoldSoft(destaque),
  };

  return { variaveis: cores, ehEscuro: fundoHsl.l < 50 };
}

/** Converte o pacote de variáveis (hex) pra formato "R G B" pronto pra usar
 * em document.documentElement.style.setProperty. */
export function variaveisParaRgbString(variaveis) {
  const saida = {};
  Object.entries(variaveis).forEach(([chave, hex]) => {
    saida[chave] = hexParaRgbString(hex);
  });
  return saida;
}

// Mapa chave-do-objeto -> nome real da variável CSS (usado tanto pra aplicar
// no <html> quanto pelo script anti-flash em app/layout.js).
export const MAPA_VARIAVEIS_CSS = {
  cream: '--cor-cream',
  creamSoft: '--cor-cream-soft',
  creamCard: '--cor-cream-card',
  coffee50: '--cor-coffee-50',
  coffee100: '--cor-coffee-100',
  coffee200: '--cor-coffee-200',
  coffee300: '--cor-coffee-300',
  coffee400: '--cor-coffee-400',
  coffee500: '--cor-coffee-500',
  coffee600: '--cor-coffee-600',
  coffee700: '--cor-coffee-700',
  coffee800: '--cor-coffee-800',
  coffee900: '--cor-coffee-900',
  borda100: '--cor-borda-100',
  borda200: '--cor-borda-200',
  borda300: '--cor-borda-300',
  borda400: '--cor-borda-400',
  borda700: '--cor-borda-700',
  forte: '--cor-forte',
  forte800: '--cor-forte-800',
  forte900: '--cor-forte-900',
  textoForte: '--cor-texto-forte',
  gold: '--cor-gold',
  goldSoft: '--cor-gold-soft',
};
