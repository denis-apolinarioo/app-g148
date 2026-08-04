'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import VitrineConquistasModal from '@/components/VitrineConquistasModal';
import EmblemaConquista from '@/components/EmblemaConquista';

/**
 * Vitrine de conquistas em destaque, no topo do perfil (3 "medalhas").
 *
 * - Dono do perfil: sempre aparece (contanto que já tenha pelo menos 1
 *   conquista desbloqueada), com espaços vazios clicáveis ("+") pra
 *   completar até 3, e toque em qualquer medalha já escolhida também abre
 *   o modal de escolha.
 * - Visitando o perfil de outra pessoa: só aparece se ela já escolheu algo
 *   pra mostrar; nada clicável.
 */
export default function VitrineConquistas({ usuario, usuarioAtual, conquistas, vitrine, onSalvar }) {
  const [modalAberto, setModalAberto] = useState(false);
  const souDono = usuarioAtual?.uid === usuario.uid;
  const desbloqueadas = conquistas.filter((c) => c.desbloqueada);

  if (!souDono && vitrine.length === 0) return null;
  if (souDono && desbloqueadas.length === 0) return null;

  const espacos = [...vitrine];
  while (souDono && espacos.length < 3) espacos.push(null);

  return (
    <div className="flex justify-end gap-3">
      {espacos.map((conquista, i) => (
        <button
          key={conquista?.id || `vazio-${i}`}
          type="button"
          onClick={() => souDono && setModalAberto(true)}
          disabled={!souDono}
          title={conquista?.nome}
          className={`flex-shrink-0 transition-transform ${souDono ? 'active:scale-95' : ''}`}
        >
          {conquista ? (
            <EmblemaConquista conquista={conquista} size={76} bloqueada={false} />
          ) : (
            <div className="flex h-[76px] w-[76px] items-center justify-center rounded-full border-2 border-dashed border-coffee-200 bg-coffee-50">
              <Plus size={22} className="text-coffee-300" />
            </div>
          )}
        </button>
      ))}

      {modalAberto && (
        <VitrineConquistasModal
          desbloqueadas={desbloqueadas}
          selecaoAtual={vitrine.map((c) => c.id)}
          onFechar={() => setModalAberto(false)}
          onSalvar={async (novaSelecao) => {
            await onSalvar(novaSelecao);
            setModalAberto(false);
          }}
        />
      )}
    </div>
  );
}
