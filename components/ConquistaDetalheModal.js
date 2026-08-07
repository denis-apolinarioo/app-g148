'use client';

import { useEffect, useState } from 'react';
import { X, Lock } from 'lucide-react';
import EmblemaConquista from '@/components/EmblemaConquista';
import { getProgressoConquista } from '@/lib/achievements';

// Era 132, depois 168 — aumentado de novo (pedido do usuário) pra dar ainda
// mais destaque à conquista em si no topo do pop-up.
const TAMANHO_DETALHE = 190;

/**
 * Modal de detalhe de uma conquista — abre ao tocar em qualquer badge
 * (components/AchievementBadge.js) ou medalhão da vitrine
 * (components/VitrineConquistas.js), desbloqueada ou não. Popup flutuante
 * centralizado, com tamanho PADRONIZADO (largura fixa + altura mínima) —
 * não pula de tamanho conforme o texto de cada conquista é curto ou longo.
 *
 * Ordem sempre igual: emblema grande em destaque → nome → texto →
 * contador "atual/meta" (ex.: "12/50"), pra todas as conquistas que têm
 * contador (as manuais, sem meta configurada, simplesmente não mostram
 * essa linha — ver getProgressoConquista em lib/achievements.js).
 *
 * Pra bloqueadas, o cadeado padrão do EmblemaConquista (pequeno, pensado
 * pro selo mini do grid) é substituído aqui por um selo próprio maior —
 * `mostrarCadeado={false}` desliga o embutido e o cadeado "bonito" é
 * desenhado por cima, sobre o emblema já acinzentado.
 *
 * `uid` é de quem é a conquista (dono do perfil sendo visto, não
 * necessariamente quem está olhando) — usado só pra calcular o progresso
 * do contador. Sem ele (não deveria acontecer nos 3 lugares que abrem esse
 * modal hoje, mas por segurança), o pop-up funciona igual, só sem a linha
 * do contador.
 */
export default function ConquistaDetalheModal({ conquista, uid, onFechar }) {
  const desbloqueada = !!conquista.desbloqueada;
  // Se essa conquista TEM contador é algo que já sabemos na hora, sem
  // precisar esperar rede nenhuma (vem do catálogo, junto com o resto de
  // `conquista`) — só o VALOR do contador (`progresso`) depende do
  // Firestore. Por isso a linha do contador já nasce reservada (co
  // `temContador`) mesmo antes do valor chegar: sem isso, ela aparecia do
  // nada assim que a busca terminava e empurrava nome/texto pra cima —
  // esse pulo era o "lag" ao abrir o pop-up.
  const temContador = !!conquista?.contadorTipo && conquista.contadorTipo !== 'manual' && conquista.meta != null;
  const [progresso, setProgresso] = useState(null);

  useEffect(() => {
    let cancelado = false;
    setProgresso(null);
    if (!uid) return undefined;
    getProgressoConquista(conquista, uid).then((p) => {
      if (!cancelado) setProgresso(p);
    });
    return () => {
      cancelado = true;
    };
  }, [conquista, uid]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-coffee-900/50 p-4 backdrop-blur-sm"
      onClick={onFechar}
    >
      <div
        // p-7 vira px-7 pt-7 pb-[25px]: só o padding de baixo encolhe 3px,
        // empurrando o bloco de texto (nome/descrição/contador) 3px pra
        // baixo — sem mudar w-[300px]/min-h-[400px] do balão.
        className="relative flex min-h-[400px] w-[300px] max-w-full animate-popupFlutuante flex-col items-center justify-between rounded-3xl bg-cream px-7 pt-7 pb-[25px] text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onFechar}
          className="absolute right-4 top-4 rounded-full p-1 text-coffee-400"
        >
          <X size={18} />
        </button>

        {/* mt-3 (12px) virou mt-[9px]: sobe a arte 3px, afastando ela do
            nome logo abaixo. */}
        <div className="relative mx-auto mt-[9px]" style={{ width: TAMANHO_DETALHE, height: TAMANHO_DETALHE }}>
          <EmblemaConquista conquista={conquista} size={TAMANHO_DETALHE} mostrarCadeado={false} />

          {!desbloqueada && (
            <div className="absolute inset-0 z-20 flex items-center justify-center">
              <Lock size={48} strokeWidth={1.8} className="text-coffee-500/60 drop-shadow-sm" />
            </div>
          )}
        </div>

        <div>
          <p className="font-destaque text-xl font-semibold text-coffee-800">{conquista.nome}</p>
          <p className="mt-2 text-sm text-coffee-500">{conquista.descricao}</p>

          {temContador && (
            <p className="mt-4 text-xs font-semibold tracking-wider text-coffee-300">
              {progresso ? `${progresso.atual}/${progresso.meta}` : '\u00A0'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
