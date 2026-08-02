'use client';

import { useState } from 'react';
import * as Icons from 'lucide-react';
import { Plus } from 'lucide-react';
import VitrineConquistasModal from '@/components/VitrineConquistasModal';

function iconePascalCase(nomeKebab) {
  return nomeKebab
    .split('-')
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
    .join('');
}

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
    <div className="mt-4 flex w-full max-w-xs justify-center gap-3">
      {espacos.map((conquista, i) => {
        const Icone = conquista ? Icons[iconePascalCase(conquista.icone)] || Icons.Award : null;
        return (
          <button
            key={conquista?.id || `vazio-${i}`}
            type="button"
            onClick={() => souDono && setModalAberto(true)}
            disabled={!souDono}
            title={conquista?.nome}
            className={`flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full transition-transform ${
              conquista
                ? 'bg-gradient-to-br from-gold to-coffee-600 shadow-card'
                : 'border-2 border-dashed border-coffee-200 bg-coffee-50'
            } ${souDono ? 'active:scale-95' : ''}`}
          >
            {conquista ? (
              <Icone size={26} strokeWidth={1.8} className="text-cream" />
            ) : (
              <Plus size={20} className="text-coffee-300" />
            )}
          </button>
        );
      })}

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
