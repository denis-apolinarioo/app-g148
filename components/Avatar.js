'use client';

import { useState, useEffect } from 'react';
import { getCachedImageURL } from '@/lib/imageCache';

export default function Avatar({ src, nome = '', tamanho = 36, className = '' }) {
  const [urlLocal, setUrlLocal] = useState('');

  // Converte "sm" e "md" para número, pra manter compatibilidade com código antigo
  const px = tamanho === 'sm' ? 28 : tamanho === 'md' ? 36 : Number(tamanho) || 36;

  useEffect(() => {
    if (!src) { setUrlLocal(''); return; }
    let cancelado = false;
    getCachedImageURL(src).then((url) => {
      if (!cancelado) setUrlLocal(url);
    });
    return () => { cancelado = true; };
  }, [src]);

  const iniciais = nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');

  if (urlLocal) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={urlLocal}
        alt={nome}
        width={px}
        height={px}
        className={`rounded-full object-cover flex-shrink-0 ${className}`}
        style={{ width: px, height: px }}
      />
    );
  }

  return (
    <div
      className={`flex flex-shrink-0 items-center justify-center rounded-full bg-coffee-200 font-semibold text-coffee-700 ${className}`}
      style={{ width: px, height: px, fontSize: px * 0.36 }}
    >
      {iniciais || '?'}
    </div>
  );
}
