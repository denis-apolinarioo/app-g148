'use client';

import { useState } from 'react';
import * as Icons from 'lucide-react';
import { Plus, Pencil } from 'lucide-react';
import VitrineConquistasModal from '@/components/VitrineConquistasModal';
import ConquistaDetalheModal from '@/components/ConquistaDetalheModal';
import { iconePascalCase } from '@/lib/missionIcons';

/**
 * Vitrine de conquistas em destaque, no topo do perfil — visual de
 * "mostruário de vidro": medalhão maior, com brilho fixo (reflexo) e um
 * reflexo animado varrendo de vez em quando, dando profundidade/efeito 3D
 * sem exagerar.
 *
 * - Tocar numa medalha PREENCHIDA (dono OU visitante) abre o pop-up de
 *   detalhe da conquista (foto, nome, texto) — igual ao resto do app.
 * - Tocar num espaço VAZIO ("+", só aparece pro dono) abre direto o modal
 *   de escolha/ordem.
 * - O dono tem, além disso, um botão "editar" sempre visível ao lado da
 *   vitrine (mesmo com as 3 medalhas preenchidas) pra poder trocar a
 *   escolha, a ordem, ou tirar tudo — isso é livre, decidido só por ele.
 * - Visitando o perfil de outra pessoa: só aparece se ela já escolheu algo
 *   pra mostrar (ela pode escolher mostrar nenhuma, de propósito).
 */
export default function VitrineConquistas({ usuario, usuarioAtual, conquistas, vitrine, onSalvar }) {
  const [modalGerenciarAberto, setModalGerenciarAberto] = useState(false);
  const [conquistaDetalhe, setConquistaDetalhe] = useState(null);
  const souDono = usuarioAtual?.uid === usuario.uid;
  const desbloqueadas = conquistas.filter((c) => c.desbloqueada);

  if (!souDono && vitrine.length === 0) return null;
  if (souDono && desbloqueadas.length === 0) return null;

  const espacos = [...vitrine];
  while (souDono && espacos.length < 3) espacos.push(null);

  return (
    <div className="mt-3 flex items-center justify-end gap-2.5">
      {espacos.map((conquista, i) => {
        const Icone = conquista ? Icons[iconePascalCase(conquista.icone)] || Icons.Award : null;
        // Atraso escalonado por posição pra o brilho de cada medalhão não
        // "piscar" tudo junto — fica mais orgânico, tipo peças reais de
        // mostruário reagindo à luz em momentos levemente diferentes.
        const atraso = `${i * 0.7}s`;

        return (
          <button
            key={conquista?.id || `vazio-${i}`}
            type="button"
            onClick={() => {
              if (conquista) setConquistaDetalhe(conquista);
              else if (souDono) setModalGerenciarAberto(true);
            }}
            disabled={!conquista && !souDono}
            title={conquista?.nome}
            style={conquista ? { animationDelay: atraso } : undefined}
            className={`group relative flex h-[4.5rem] w-[4.5rem] flex-shrink-0 items-center justify-center rounded-full transition-transform active:scale-95 ${
              conquista
                ? 'animate-vitrineFlutuar bg-gradient-to-br from-gold to-coffee-600 shadow-[0_10px_18px_-6px_rgba(58,38,22,0.45)] ring-2 ring-white/50'
                : 'border-2 border-dashed border-coffee-200 bg-coffee-50'
            }`}
          >
            {conquista ? (
              <>
                {conquista.imagemURL ? (
                  <img
                    src={conquista.imagemURL}
                    alt=""
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  <Icone size={28} strokeWidth={1.8} className="text-cream" />
                )}

                {/* "Vidro" do mostruário: brilho fixo no canto superior
                    esquerdo, simulando a curva de uma cúpula de vidro. */}
                <div className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-br from-white/55 via-white/5 to-transparent" />

                {/* Reflexo animado varrendo a peça de vez em quando. */}
                <div
                  style={{ animationDelay: atraso }}
                  className="pointer-events-none absolute -inset-y-6 -left-1/2 w-1/3 rotate-[20deg] bg-gradient-to-r from-transparent via-white/60 to-transparent [animation:vitrineBrilho_3.6s_ease-in-out_infinite]"
                />
              </>
            ) : (
              <Plus size={18} className="text-coffee-300" />
            )}
          </button>
        );
      })}

      {souDono && desbloqueadas.length > 0 && (
        <button
          type="button"
          onClick={() => setModalGerenciarAberto(true)}
          aria-label="Editar vitrine de conquistas"
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-coffee-100 bg-cream-card text-coffee-400 shadow-card active:scale-95"
        >
          <Pencil size={12} />
        </button>
      )}

      {modalGerenciarAberto && (
        <VitrineConquistasModal
          desbloqueadas={desbloqueadas}
          selecaoAtual={vitrine.map((c) => c.id)}
          onFechar={() => setModalGerenciarAberto(false)}
          onSalvar={async (novaSelecao) => {
            await onSalvar(novaSelecao);
            setModalGerenciarAberto(false);
          }}
        />
      )}

      {conquistaDetalhe && (
        <ConquistaDetalheModal conquista={conquistaDetalhe} onFechar={() => setConquistaDetalhe(null)} />
      )}
    </div>
  );
}
