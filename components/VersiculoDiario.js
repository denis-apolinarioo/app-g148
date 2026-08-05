'use client';

import { useEffect, useState } from 'react';
import { ScrollText } from 'lucide-react';
import { getVersiculoDoDia } from '@/lib/bible';
import { pontuarAberturaVersiculo } from '@/lib/points';

/**
 * Versículo do dia — em vez de mostrar o texto direto, vira um convite
 * ("Ver o que o Senhor tem a me dizer hoje") ao lado de um pergaminho. Ao
 * tocar no texto OU no pergaminho, ele "desenrola" pra baixo revelando o
 * versículo; tocar de novo fecha. Mesmo tema/cores de sempre (coffee-700 +
 * dourado), só ganhou esse novo comportamento.
 *
 * A 1ª abertura de cada dia credita pontos (valor configurável no Admin,
 * aba Ações > "Abrir o versículo do dia") — abrir/fechar de novo no mesmo
 * dia não pontua de novo (ver lib/points.js -> pontuarAberturaVersiculo).
 */
export default function VersiculoDiario({ uid }) {
  const [versiculo, setVersiculo] = useState(null);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    let ativo = true;
    getVersiculoDoDia().then((v) => {
      if (ativo) setVersiculo(v);
    });
    return () => {
      ativo = false;
    };
  }, []);

  function handleAlternar() {
    if (!versiculo) return;
    setAberto((atual) => {
      const vaiAbrir = !atual;
      if (vaiAbrir && uid) {
        pontuarAberturaVersiculo(uid).catch((err) => {
          console.error('Erro ao pontuar abertura do versículo:', err);
        });
      }
      return vaiAbrir;
    });
  }

  return (
    <div className="relative overflow-hidden rounded-xl2 bg-coffee-700 px-6 py-6 shadow-soft">
      <div className="pointer-events-none absolute -right-6 -top-8 font-display text-[7rem] leading-none text-coffee-600/40">
        &rdquo;
      </div>

      <p className="relative text-[11px] font-semibold uppercase tracking-wider text-coffee-200">
        Versículo do dia
      </p>

      <button
        type="button"
        onClick={handleAlternar}
        disabled={!versiculo}
        className="relative mt-3 flex w-full items-center gap-3.5 text-left disabled:opacity-70"
      >
        {/* Pergaminho dourado — ícone de diploma/pergaminho, girando
            levemente quando aberto pra reforçar o toque. */}
        <span
          className={`relative flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-coffee-600/60 shadow-md transition-transform duration-500 ${
            aberto ? 'rotate-6' : '-rotate-3'
          }`}
        >
          <ScrollText className="h-6 w-6 text-gold-soft" strokeWidth={1.8} />
        </span>

        {versiculo ? (
          <span className="font-display text-base italic leading-snug text-cream">
            Ver o que o Senhor tem a me dizer hoje
          </span>
        ) : (
          <span className="flex-1 space-y-2">
            <span className="block h-4 w-full animate-pulse rounded bg-coffee-600/60" />
            <span className="block h-4 w-4/5 animate-pulse rounded bg-coffee-600/60" />
          </span>
        )}
      </button>

      {/* "Desenrola pra baixo": grid-template-rows de 0fr -> 1fr é o jeito
          mais estável de animar até altura automática sem medir nada em
          JS — o conteúdo real fica dentro de um overflow-hidden. O mt-4
          (espaço acima da linha) também entra na transição — antes só o
          grid-template-rows animava e o mt-4 sumia de vez ao fechar,
          fazendo a linha "pular" pra cima de repente em vez de subir
          suave junto com o resto. */}
      <div
        className={`relative grid transition-[grid-template-rows,margin-top] duration-500 ease-in-out ${
          aberto ? 'grid-rows-[1fr] mt-4' : 'grid-rows-[0fr] mt-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-coffee-500/50 pt-4">
            <p className="font-display text-lg italic leading-relaxed text-cream">{versiculo?.texto}</p>
            <p className="mt-3 text-sm font-medium text-coffee-200">
              {versiculo?.referencia} · {versiculo?.versao || 'NAA'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
