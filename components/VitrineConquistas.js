'use client';

import { useRef, useState } from 'react';
import * as Icons from 'lucide-react';
import { Plus } from 'lucide-react';
import VitrineConquistasModal from '@/components/VitrineConquistasModal';
import ConquistaDetalheModal from '@/components/ConquistaDetalheModal';
import { iconePascalCase } from '@/lib/missionIcons';
import { vibrarToqueLeve } from '@/lib/haptics';

const DURACAO_LONG_PRESS = 500; // ms — igual ao padrão já usado no PostCard

/**
 * Vitrine de conquistas em destaque, no topo do perfil — medalhão maior,
 * com uma leve flutuação contínua dando profundidade sem exagerar.
 *
 * - Tocar numa medalha PREENCHIDA (dono OU visitante) abre o pop-up de
 *   detalhe da conquista (foto, nome, texto) — igual ao resto do app.
 * - Tocar num espaço VAZIO ("+", só aparece pro dono) abre direto o modal
 *   de escolha/ordem.
 * - O dono, segurando (long press) uma medalha PREENCHIDA, abre o mesmo
 *   modal de escolha/ordem/remoção — não existe mais um botão "editar"
 *   separado ao lado da vitrine.
 * - Visitando o perfil de outra pessoa: só aparece se ela já escolheu algo
 *   pra mostrar (ela pode escolher mostrar nenhuma, de propósito).
 */
export default function VitrineConquistas({ usuario, usuarioAtual, conquistas, vitrine, onSalvar }) {
  const [modalGerenciarAberto, setModalGerenciarAberto] = useState(false);
  const [conquistaDetalhe, setConquistaDetalhe] = useState(null);
  const souDono = usuarioAtual?.uid === usuario.uid;
  const desbloqueadas = conquistas.filter((c) => c.desbloqueada);

  const pressTimerRef = useRef(null);
  const longPressAtivoRef = useRef(false);

  if (!souDono && vitrine.length === 0) return null;
  if (souDono && desbloqueadas.length === 0) return null;

  const espacos = [...vitrine];
  while (souDono && espacos.length < 3) espacos.push(null);

  // Segurar uma medalha preenchida (só o dono) abre o modal de gerenciar
  // vitrine — substitui o antigo botão "editar" fixo ao lado.
  function iniciarPressionar(conquista) {
    if (!souDono || !conquista) return;
    longPressAtivoRef.current = false;
    pressTimerRef.current = setTimeout(() => {
      longPressAtivoRef.current = true;
      vibrarToqueLeve();
      setModalGerenciarAberto(true);
    }, DURACAO_LONG_PRESS);
  }
  function cancelarPressionar() {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  }
  function handleClick(conquista) {
    if (longPressAtivoRef.current) {
      longPressAtivoRef.current = false;
      return; // já abriu o modal de gerenciar no long-press, não abre o detalhe
    }
    if (conquista) setConquistaDetalhe(conquista);
    else if (souDono) setModalGerenciarAberto(true);
  }

  return (
    <div className="mt-3 flex items-center justify-end gap-2.5">
      {espacos.map((conquista, i) => {
        const Icone = conquista ? Icons[iconePascalCase(conquista.icone)] || Icons.Award : null;
        // Atraso escalonado por posição pra a flutuação de cada medalhão
        // não ficar toda em sincronia — fica mais orgânico.
        const atraso = `${i * 0.7}s`;

        return (
          <button
            key={conquista?.id || `vazio-${i}`}
            type="button"
            onClick={() => handleClick(conquista)}
            onTouchStart={() => iniciarPressionar(conquista)}
            onTouchEnd={cancelarPressionar}
            onMouseDown={() => iniciarPressionar(conquista)}
            onMouseUp={cancelarPressionar}
            onMouseLeave={cancelarPressionar}
            disabled={!conquista && !souDono}
            title={conquista?.nome}
            style={conquista ? { animationDelay: atraso } : undefined}
            className={`relative flex h-[4.5rem] w-[4.5rem] flex-shrink-0 items-center justify-center rounded-full transition-transform active:scale-95 ${
              conquista
                ? 'animate-vitrineFlutuar bg-gradient-to-br from-gold to-coffee-600 shadow-[0_10px_18px_-6px_rgba(58,38,22,0.45)] ring-2 ring-white/50'
                : 'border-2 border-dashed border-coffee-200 bg-coffee-50'
            }`}
          >
            {conquista ? (
              conquista.imagemURL ? (
                <img
                  src={conquista.imagemURL}
                  alt=""
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                <Icone size={28} strokeWidth={1.8} className="text-cream" />
              )
            ) : (
              <Plus size={18} className="text-coffee-300" />
            )}
          </button>
        );
      })}

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
