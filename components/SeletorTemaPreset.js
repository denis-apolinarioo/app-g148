'use client';

import { useState } from 'react';
import * as Icons from 'lucide-react';
import { Palette } from 'lucide-react';
import { iconePascalCase } from '@/lib/missionIcons';

/**
 * Botão no cabeçalho do Perfil que abre um menu com os presets de cor
 * ATIVOS (aba Estética do Admin) — cada um mostrado com o próprio ícone.
 * Substitui o antigo botão sol/lua (só 2 opções fixas) por um seletor com
 * quantas opções o Admin tiver deixado disponíveis.
 */
export default function SeletorTemaPreset({ presetAtivoId, presetsDisponiveis, onTrocar }) {
  const [aberto, setAberto] = useState(false);

  const atual = presetsDisponiveis?.find((p) => p.id === presetAtivoId);
  const IconeAtual = atual?.icone ? Icons[iconePascalCase(atual.icone)] : null;

  // Ainda carregando a lista (1ª renderização) — mostra um ícone neutro em
  // vez de piscar vazio.
  if (!presetsDisponiveis) {
    return (
      <span className="text-coffee-500">
        <Palette size={21} />
      </span>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setAberto((v) => !v)}
        className="text-coffee-500"
        aria-label={`Cor do app: ${atual?.nome || 'Claro'}. Toque pra trocar`}
      >
        {IconeAtual ? <IconeAtual size={21} /> : <Palette size={21} />}
      </button>

      {aberto && (
        <>
          {/* Fundo transparente pra fechar ao tocar fora — mesmo padrão de
              outros menus pequenos do app. */}
          <div className="fixed inset-0 z-40" onClick={() => setAberto(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-xl2 border border-coffee-100 bg-cream-card shadow-lg">
            {presetsDisponiveis.map((preset) => {
              const IconePreset = preset.icone ? Icons[iconePascalCase(preset.icone)] : null;
              const selecionado = preset.id === presetAtivoId;
              return (
                <button
                  key={preset.id}
                  onClick={() => {
                    onTrocar(preset.id);
                    setAberto(false);
                  }}
                  className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm ${
                    selecionado ? 'bg-coffee-50 font-semibold text-coffee-800' : 'text-coffee-600'
                  }`}
                >
                  {IconePreset ? (
                    <IconePreset size={16} className={selecionado ? 'text-coffee-800' : 'text-coffee-400'} />
                  ) : (
                    <Palette size={16} className="text-coffee-400" />
                  )}
                  {preset.nome}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
