// ============================================================================
// Galeria de ícones disponíveis pra montar uma missão (Admin > Missões).
// Nomes em kebab-case, no mesmo padrão que `missao.icone` já usava
// (ver components/MissionCard.js) — convertidos pra PascalCase na hora de
// buscar o componente dentro de `lucide-react`.
//
// Mistura ícones "espirituais" (oração, fé, comunidade) com "do dia a dia"
// (café, casa, trabalho, comida, natureza) pra cobrir o tipo de missão que
// esta comunidade cria — sem travar o Admin numa lista só de um tema.
// ============================================================================
export const GALERIA_ICONES = [
  // espiritual / fé / comunidade
  'sunrise', 'sunset', 'sun', 'moon', 'moon-star', 'star', 'sparkles',
  'heart', 'heart-handshake', 'book-open', 'book', 'book-marked', 'bookmark',
  'feather', 'flame', 'church', 'cross', 'users', 'user', 'user-check',
  'handshake', 'smile', 'gift', 'baby',
  // som / comunicação / registro
  'music', 'music-2', 'mic', 'mic-2', 'headphones', 'camera', 'image',
  'images', 'video', 'phone', 'message-circle', 'message-square', 'mail',
  'send', 'bell', 'bell-ring',
  // tempo / organização
  'calendar', 'calendar-days', 'calendar-check', 'clock', 'timer',
  'alarm-clock', 'check-circle', 'check-circle-2', 'check-square', 'circle',
  // conquista / alvo
  'target', 'trophy', 'award', 'medal', 'crown', 'gem', 'diamond', 'flag',
  // natureza
  'mountain', 'tree-pine', 'leaf', 'flower', 'flower-2', 'droplet',
  'droplets', 'cloud-rain', 'cloud-sun', 'rainbow', 'wind', 'snowflake',
  'umbrella', 'globe',
  // cotidiano / casa / trabalho
  'home', 'coffee', 'backpack', 'briefcase', 'wallet', 'dollar-sign',
  'shopping-bag', 'shopping-cart',
  // comida
  'utensils', 'utensils-crossed', 'pizza', 'apple', 'carrot', 'salad',
  // corpo / deslocamento
  'dumbbell', 'bike', 'car', 'bus', 'plane', 'ship', 'train', 'footprints',
  'navigation', 'compass', 'map', 'map-pin',
  // aprendizado / ideia
  'graduation-cap', 'lightbulb',
];

export function iconePascalCase(nomeKebab) {
  return (nomeKebab || '')
    .split('-')
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
    .join('');
}
