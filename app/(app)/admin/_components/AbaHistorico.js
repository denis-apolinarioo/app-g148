'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { History } from 'lucide-react';
import EmptyState from '@/components/EmptyState';
import { useUsuarioAtual } from '@/lib/useUsuarioAtual';
import { subscribeToAcoesAdmin } from '@/lib/adminLog';
import { formatDateTimeBR } from '@/lib/dateUtils';

// Item 9º do Bloco 3 — tela de histórico das ações do admin (por enquanto,
// só o ajuste manual de pontos usa isso — ver AbaUsuarios.js / lib/points.js
// -> ajustarPontosManualmente — mas qualquer ação futura que chamar
// registrarAcaoAdmin() já aparece aqui de graça).
const ROTULOS_ACAO = {
  ajustar_pontos: 'Ajuste manual de pontos',
};

export default function AbaHistorico() {
  const [registros, setRegistros] = useState(null);

  useEffect(() => {
    const unsub = subscribeToAcoesAdmin(setRegistros);
    return () => unsub();
  }, []);

  if (registros === null) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl2 bg-coffee-100/60" />
        ))}
      </div>
    );
  }

  if (registros.length === 0) {
    return (
      <EmptyState
        icone={History}
        titulo="Nenhum registro ainda"
        descricao="Ações administrativas (como ajuste manual de pontos) aparecem aqui."
      />
    );
  }

  return (
    <div className="space-y-2">
      {registros.map((r) => (
        <LinhaRegistro key={r.id} registro={r} />
      ))}
    </div>
  );
}

function LinhaRegistro({ registro }) {
  // Alvo é sempre um uid de usuário por enquanto (único `alvoTipo` em uso
  // é 'users'), então já resolvemos nome/username pra exibir em vez do id cru.
  const mostrarAlvo = registro.alvoTipo === 'users' && registro.alvoId;
  const alvo = useUsuarioAtual(mostrarAlvo ? registro.alvoId : null);

  return (
    <div className="rounded-xl2 border border-coffee-100 bg-cream-card p-3.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-coffee-800">
          {ROTULOS_ACAO[registro.acao] || registro.acao}
        </p>
        <p className="flex-shrink-0 text-[11px] text-coffee-300">
          {registro.createdAt ? formatDateTimeBR(registro.createdAt) : 'agora'}
        </p>
      </div>

      <p className="mt-1 text-xs text-coffee-500">
        por <span className="font-medium text-coffee-700">{registro.adminNome || 'admin'}</span>
        {mostrarAlvo && (
          <>
            {' '}
            em{' '}
            <Link href={`/u/${alvo.username || registro.alvoId}`} className="font-medium text-coffee-700 hover:underline">
              {alvo.nome}
            </Link>
          </>
        )}
      </p>

      {(registro.valorAntes !== null || registro.valorDepois !== null) && (
        <p className="mt-1 text-xs text-coffee-500">
          {registro.valorAntes} → <span className="font-semibold text-coffee-700">{registro.valorDepois}</span>
        </p>
      )}

      {registro.detalhes && (
        <p className="mt-1.5 rounded-lg bg-cream px-2.5 py-1.5 text-xs text-coffee-600">
          {registro.detalhes}
        </p>
      )}
    </div>
  );
}
