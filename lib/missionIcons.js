// ============================================================================
// Galeria de ícones disponíveis pra montar uma missão (Admin > Missões).
// Nomes em kebab-case, no mesmo padrão que `missao.icone` já usava
// (ver components/MissionCard.js) — convertidos pra PascalCase na hora de
// buscar o componente dentro de `lucide-react`.
//
// Lista ampla (quase 500 ícones) organizada por tema, pra dar bastante opção
// visual sem travar o Admin numa lista curta. Nomes que não existirem na
// versão instalada do lucide-react são ignorados automaticamente pelo
// IconGalleryPicker (proteção `if (!Icone) return null`), então não quebra
// nada se algum nome mudar em uma atualização futura da lib.
// ============================================================================
export const GALERIA_ICONES = [
  // espiritual / fé / comunidade / som / registro / tempo / conquista / natureza / cotidiano / comida / corpo / deslocamento / aprendizado (base original)
  'sunrise', 'sunset', 'sun', 'moon', 'moon-star', 'star', 'sparkles', 
  'heart', 'heart-handshake', 'book-open', 'book', 'book-marked', 'bookmark', 
  'feather', 'flame', 'church', 'cross', 'users', 'user', 'user-check', 
  'handshake', 'smile', 'gift', 'baby', 'music', 'music-2', 'mic', 'mic-2', 
  'headphones', 'camera', 'image', 'images', 'video', 'phone', 
  'message-circle', 'message-square', 'mail', 'send', 'bell', 'bell-ring', 
  'calendar', 'calendar-days', 'calendar-check', 'clock', 'timer', 
  'alarm-clock', 'check-circle', 'check-circle-2', 'check-square', 'circle', 
  'target', 'trophy', 'award', 'medal', 'crown', 'gem', 'diamond', 'flag', 
  'mountain', 'tree-pine', 'leaf', 'flower', 'flower-2', 'droplet', 
  'droplets', 'cloud-rain', 'cloud-sun', 'rainbow', 'wind', 'snowflake', 
  'umbrella', 'globe', 'home', 'coffee', 'backpack', 'briefcase', 'wallet', 
  'dollar-sign', 'shopping-bag', 'shopping-cart', 'utensils', 
  'utensils-crossed', 'pizza', 'apple', 'carrot', 'salad', 'dumbbell', 
  'bike', 'car', 'bus', 'plane', 'ship', 'train', 'footprints', 'navigation', 
  'compass', 'map', 'map-pin', 'graduation-cap', 'lightbulb',
  // animais
  'cat', 'dog', 'bird', 'fish', 'rabbit', 'turtle', 'squirrel', 'bug', 
  'shell', 'paw-print', 'egg', 'egg-fried', 'snail', 'worm',
  // clima extra
  'cloud', 'cloud-fog', 'cloud-lightning', 'cloud-snow', 'cloud-drizzle', 
  'cloud-hail', 'cloudy', 'thermometer', 'thermometer-sun', 
  'thermometer-snowflake', 'tornado', 'zap', 'zap-off',
  // tecnologia
  'laptop', 'monitor', 'smartphone', 'tablet', 'wifi', 'wifi-off', 
  'bluetooth', 'battery', 'battery-charging', 'battery-low', 'power', 'plug', 
  'plug-zap', 'cpu', 'server', 'database', 'hard-drive', 'usb', 'keyboard', 
  'mouse', 'printer', 'camera-off', 'video-off', 'radio', 'tv', 'gamepad', 
  'gamepad-2', 'joystick', 'rocket', 'satellite', 'satellite-dish', 'router', 
  'webcam', 'cast',
  // ferramentas / escritório
  'wrench', 'hammer', 'ruler', 'scissors', 'paintbrush', 'paint-bucket', 
  'palette', 'pencil', 'pen', 'pen-tool', 'eraser', 'clipboard', 
  'clipboard-check', 'clipboard-list', 'clipboard-copy', 'folder', 
  'folder-open', 'file', 'file-text', 'files', 'archive', 'box', 'package', 
  'package-open', 'trash', 'trash-2', 'lock', 'lock-open', 'unlock', 'key', 
  'shield', 'shield-check', 'shield-alert', 'paperclip', 'stamp', 
  'highlighter', 'notebook', 'sticky-note',
  // formas / símbolos
  'square', 'triangle', 'hexagon', 'pentagon', 'octagon', 'infinity', 'plus', 
  'minus', 'x', 'check', 'asterisk', 'circle-dot', 'square-check',
  // setas / ações de interface
  'arrow-up', 'arrow-down', 'arrow-left', 'arrow-right', 'arrow-up-right', 
  'chevron-up', 'chevron-down', 'chevrons-up', 'refresh-cw', 'repeat', 
  'shuffle', 'rotate-cw', 'move', 'expand', 'search', 'filter', 'settings', 
  'sliders', 'toggle-left', 'toggle-right', 'link', 'link-2', 
  'external-link', 'share', 'share-2', 'download', 'upload', 'save', 'edit', 
  'edit-2', 'edit-3', 'copy', 'more-horizontal', 'more-vertical', 'grid', 
  'list', 'layout-grid', 'columns', 'rows',
  // corpo / gestos extra
  'thumbs-up', 'thumbs-down', 'hand', 'hand-metal', 'hand-heart', 'eye', 
  'eye-off', 'ear', 'brain', 'fingerprint',
  // festas / comemoração
  'party-popper', 'cake',
  // edifícios / lugares
  'building', 'building-2', 'landmark', 'school', 'hospital', 'store', 
  'warehouse', 'factory', 'castle', 'ferris-wheel', 'palmtree', 'trees', 
  'waves', 'tent',
  // comida extra
  'ice-cream', 'ice-cream-2', 'cookie', 'croissant', 'sandwich', 'soup', 
  'wine', 'beer', 'martini', 'cup-soda', 'milk', 'candy', 'candy-cane', 
  'popcorn', 'donut', 'cherry', 'banana', 'citrus', 'grape',
  // ciência / saúde
  'stethoscope', 'pill', 'syringe', 'microscope', 'flask-conical', 
  'test-tube', 'atom', 'dna', 'bandage',
  // dinheiro
  'coins', 'banknote', 'credit-card', 'piggy-bank', 'receipt', 'calculator',
  // segurança / alerta
  'siren', 'flashlight', 'life-buoy', 'alert-triangle', 'alert-circle', 
  'info', 'help-circle',
  // jogos
  'dice-1', 'dice-2', 'dice-3', 'dice-4', 'dice-5', 'dice-6', 'puzzle',
  // roupas / acessórios
  'shirt', 'glasses', 'watch',
  // música extra
  'guitar', 'drum', 'disc', 'disc-2', 'cassette-tape', 'speaker', 'volume', 
  'volume-1', 'volume-2', 'volume-x',
  // gráficos / dados
  'bar-chart', 'bar-chart-2', 'pie-chart', 'trending-up', 'trending-down', 
  'line-chart', 'presentation',
  // natureza extra
  'seedling', 'sprout', 'mountain-snow', 'tree-deciduous',
  // localização extra
  'map-pinned', 'locate', 'route',
  // comunicação extra
  'at-sign', 'hash', 'megaphone', 'rss', 'inbox',
  // tempo extra
  'hourglass', 'calendar-x', 'calendar-plus',
  // pessoas extra
  'user-plus', 'user-minus', 'user-x', 'users-2', 'contact',
  // transporte extra
  'truck', 'ambulance', 'fuel', 'parking-circle', 'traffic-cone', 'anchor', 
  'sailboat',
  // casa / objetos
  'lamp', 'lamp-desk', 'sofa', 'bed', 'bath', 'shower-head', 'door-open', 
  'door-closed', 'fan', 'washing-machine', 'chef-hat',
  // educação extra
  'pencil-ruler', 'library', 'notebook-pen',
  // status / badges
  'circle-check', 'circle-x', 'circle-plus', 'circle-minus', 'circle-alert', 
  'square-plus', 'square-minus', 'badge', 'badge-check', 'badge-alert',
  // setas extra
  'arrow-up-left', 'arrow-down-left', 'arrow-down-right', 'chevron-left', 
  'chevron-right', 'chevrons-down', 'chevrons-left', 'chevrons-right', 
  'corner-up-right', 'corner-down-left',
  // sol / céu extra
  'sun-dim', 'sun-medium', 'cloud-off',
  // expressões / emoções
  'laugh', 'frown', 'meh', 'angry', 'annoyed', 'smile-plus',
  // gesto extra
  'hand-helping',
  // e-mail / arquivos extra
  'mail-open', 'mail-check', 'reply', 'forward', 'archive-restore', 
  'file-plus', 'file-minus', 'file-check', 'folder-plus', 'folder-minus',
  // verificação / código
  'scan', 'scan-line', 'qr-code', 'barcode',
  // comida extra 2
  'beef', 'wheat',
  // céu extra 2
  'cloud-moon', 'cloud-moon-rain',
  // programação
  'terminal', 'code',
  // aventura / exploração
  'swords', 'axe', 'shovel', 'pickaxe', 'magnet', 'telescope', 'binoculars', 
  'navigation-2', 'signpost', 'milestone',
  // interface extra
  'menu', 'grip', 'grip-vertical', 'grip-horizontal', 'maximize', 'minimize', 
  'crop', 'flip-horizontal', 'flip-vertical', 'zoom-in', 'zoom-out',
  // clima extra 2
  'cloud-sun-rain',
  // mídia / player
  'play', 'pause', 'stop-circle', 'skip-forward', 'skip-back', 'rewind', 
  'fast-forward', 'mic-off',
  // transporte extra 2
  'car-front', 'train-front', 'plane-takeoff', 'plane-landing', 'luggage',
  // escudo extra
  'shield-plus', 'shield-x',
  // relógio extra
  'clock-3', 'clock-9',
  // coração / estrela extra
  'heart-crack', 'heart-off', 'star-off',
  // medidor
  'gauge',
  // diversos extra
  'briefcase-medical', 'clover', 'wand', 'wand-2', 'sparkle', 
  'badge-dollar-sign', 'hand-coins', 'heart-plus', 'book-plus', 'book-heart', 
  'book-open-check', 'book-open-text', 'calendar-heart', 'calendar-clock', 
  'star-half', 'construction',
];

export function iconePascalCase(nomeKebab) {
  return (nomeKebab || '')
    .split('-')
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
    .join('');
}
