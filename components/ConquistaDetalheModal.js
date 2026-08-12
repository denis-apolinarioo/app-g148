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
      className="fixed inset-0 z-[70] flex items-center justify-center bg-forte-900/50 p-4 backdrop-blur-sm"
      onClick={onFechar}
    >
      <div
        // Balão 340px de largura, 480px de altura mínima. Padding lateral
        // de 20px. Duas "cabeças" independentes dentro do card:
        //
        // 1) Cabeça da arte — pt-[50px] garante 50px entre a borda de
        //    cima do popup e essa cabeça; o emblema fica numa área de
        //    tamanho fixo (TAMANHO_DETALHE) e centralizada, sempre no
        //    mesmo lugar, não importa qual conquista/arte é mostrada.
        // 2) Cabeça de texto — começa 55px depois do fim da cabeça da
        //    arte (mt-[70px] no bloco de texto: os 35px originais + mais
        //    35px, absorvendo os 30px de altura extra do balão nessa
        //    borda inferior da cabeça da arte — e só nela). Dentro dela,
        //    a lógica de sempre: título → mt-2 → legenda, fluindo
        //    naturalmente de cima pra baixo (nome sempre no mesmo ponto,
        //    1 ou 2 linhas, sem depender de justify-between).
        //
        // O contador NÃO faz parte de nenhuma das duas cabeças: fica
        // ancorado via position absolute a 25px fixos da borda de baixo
        // do popup, sempre — não se move com o tamanho do texto acima.
        className="relative flex min-h-[480px] w-[340px] max-w-full animate-popupFlutuante flex-col items-center rounded-3xl bg-cream px-[20px] pb-[20px] pt-[50px] text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onFechar}
          className="absolute right-3 top-3 rounded-full p-1 text-coffee-400"
        >
          <X size={18} />
        </button>

        {/* Cabeça 1: arte — área fixa, sempre no mesmo lugar */}
        <div className="relative mx-auto" style={{ width: TAMANHO_DETALHE, height: TAMANHO_DETALHE }}>
          <EmblemaConquista conquista={conquista} size={TAMANHO_DETALHE} mostrarCadeado={false} />

          {!desbloqueada && (
            <div className="absolute inset-0 z-20 flex items-center justify-center">
              <Lock size={48} strokeWidth={1.8} className="text-coffee-500/60 drop-shadow-sm" />
            </div>
          )}
        </div>

        {/* Cabeça 2: texto — começa 55px depois do fim da cabeça da arte */}
        <div className="mt-[55px]">
          <p className="font-destaque text-xl font-semibold text-coffee-800">{conquista.nome}</p>
          <p className="mt-2 text-sm text-coffee-500">{conquista.descricao}</p>
        </div>

        {temContador && (
          // Fixo, sempre a 25px da borda de baixo — nunca se move.
          <p className="absolute bottom-[25px] left-0 right-0 text-xs font-semibold tracking-wider text-coffee-300">
            {progresso ? `${progresso.atual}/${progresso.meta}` : '\u00A0'}
          </p>
        )}
      </div>
    </div>
  );
}
