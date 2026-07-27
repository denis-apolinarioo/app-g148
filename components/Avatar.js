function iniciais(nome) {
  if (!nome) return '?';
  const partes = nome.trim().split(/\s+/);
  const primeira = partes[0]?.[0] || '';
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
  return (primeira + ultima).toUpperCase();
}

const TAMANHOS = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-16 w-16 text-lg',
  xl: 'h-24 w-24 text-2xl',
};

export default function Avatar({ src, nome, tamanho = 'md', className = '' }) {
  const classe = TAMANHOS[tamanho] || TAMANHOS.md;

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={nome || 'Foto de perfil'}
        className={`${classe} flex-shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <div
      className={`${classe} flex flex-shrink-0 items-center justify-center rounded-full bg-coffee-200 font-display font-medium text-coffee-700 ${className}`}
    >
      {iniciais(nome)}
    </div>
  );
}
