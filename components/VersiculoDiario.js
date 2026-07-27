'use client';

import { useEffect, useState } from 'react';
import { getVersiculoDoDia } from '@/lib/bible';

export default function VersiculoDiario() {
  const [versiculo, setVersiculo] = useState(null);

  useEffect(() => {
    let ativo = true;
    getVersiculoDoDia().then((v) => {
      if (ativo) setVersiculo(v);
    });
    return () => {
      ativo = false;
    };
  }, []);

  return (
    <div className="relative overflow-hidden rounded-xl2 bg-coffee-700 px-6 py-7 shadow-soft">
      <div className="pointer-events-none absolute -right-6 -top-8 font-display text-[7rem] leading-none text-coffee-600/40">
        &rdquo;
      </div>
      <p className="relative text-[11px] font-semibold uppercase tracking-wider text-coffee-200">
        Versículo do dia
      </p>
      {versiculo ? (
        <>
          <p className="relative mt-3 font-display text-lg italic leading-relaxed text-cream">
            {versiculo.texto}
          </p>
          <p className="relative mt-3 text-sm font-medium text-coffee-200">
            {versiculo.referencia} · {versiculo.versao || 'NAA'}
          </p>
        </>
      ) : (
        <div className="relative mt-3 space-y-2">
          <div className="h-4 w-full animate-pulse rounded bg-coffee-600/60" />
          <div className="h-4 w-4/5 animate-pulse rounded bg-coffee-600/60" />
          <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-coffee-600/60" />
        </div>
      )}
    </div>
  );
}
