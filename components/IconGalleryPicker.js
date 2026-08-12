'use client';

import { useState } from 'react';
import * as Icons from 'lucide-react';
import { X } from 'lucide-react';
import BowArrowIcon from '@/components/BowArrowIcon';
import { GALERIA_ICONES, iconePascalCase } from '@/lib/missionIcons';

/**
 * Seletor de ícone da missão: mostra o ícone escolhido (ou o padrão) e um
 * botão "Ver mais" que abre a galeria com os ícones disponíveis. Escolher
 * um ícone fecha a galeria na hora.
 *
 * `value` é o nome em kebab-case (ex.: "book-open"), igual ao que já era
 * salvo em `missao.icone` antes — só ganhou uma UI de escolha visual.
 */
export default function IconGalleryPicker({ value, onChange }) {
  const [galeriaAberta, setGaleriaAberta] = useState(false);
  const IconeAtual = value ? Icons[iconePascalCase(value)] : null;

  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-coffee-100">
          {IconeAtual ? (
            <IconeAtual size={19} className="text-coffee-600" strokeWidth={1.8} />
          ) : (
            <BowArrowIcon size={19} className="text-coffee-600" strokeWidth={1.8} />
          )}
        </span>
        <button
          type="button"
          onClick={() => setGaleriaAberta(true)}
          className="rounded-lg border border-coffee-200 px-3 py-2 text-xs font-semibold text-coffee-700"
        >
          Ver mais
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-xs text-coffee-400 underline"
          >
            Remover
          </button>
        )}
      </div>

      {galeriaAberta && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-forte-900/40 sm:items-center"
          onClick={() => setGaleriaAberta(false)}
        >
          <div
            className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-cream sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-coffee-100 px-5 py-4">
              <h3 className="font-destaque text-base font-semibold text-coffee-800">
                Escolha um ícone
              </h3>
              <button onClick={() => setGaleriaAberta(false)} className="text-coffee-400">
                <X size={20} />
              </button>
            </div>
            <div className="grid grid-cols-5 gap-2 p-4">
              {GALERIA_ICONES.map((nome) => {
                const Icone = Icons[iconePascalCase(nome)];
                if (!Icone) return null; // proteção: nunca quebra se um nome não existir na lib
                const selecionado = value === nome;
                return (
                  <button
                    key={nome}
                    type="button"
                    onClick={() => {
                      onChange(nome);
                      setGaleriaAberta(false);
                    }}
                    className={`flex h-12 w-12 items-center justify-center rounded-xl border ${
                      selecionado
                        ? 'border-forte bg-forte text-texto-forte'
                        : 'border-coffee-100 bg-cream-card text-coffee-600'
                    }`}
                    title={nome}
                  >
                    <Icone size={19} strokeWidth={1.8} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
