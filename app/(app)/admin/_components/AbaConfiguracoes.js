'use client';

// Item 11 do Bloco 4 (central de configurações) + item 12 do Bloco 5
// (1ª configuração de verdade: liga/desliga a função de bloquear usuário).

import { useState } from 'react';
import { Loader2, ShieldOff } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useAppConfig } from '@/lib/useAppConfig';
import { CHAVE_BLOQUEIO_USUARIO_ATIVO, salvarConfiguracoesApp } from '@/lib/appConfig';

export default function AbaConfiguracoes() {
  const { perfil } = useAuth();
  const config = useAppConfig();
  const [salvando, setSalvando] = useState(false);

  // Chave ainda não existe no documento = comportamento de hoje = ativo.
  const bloqueioAtivo = config?.[CHAVE_BLOQUEIO_USUARIO_ATIVO] !== false;

  async function handleAlternar() {
    if (salvando || !config) return;
    setSalvando(true);
    try {
      await salvarConfiguracoesApp({ [CHAVE_BLOQUEIO_USUARIO_ATIVO]: !bloqueioAtivo }, perfil);
    } catch (err) {
      console.error('Erro ao salvar configuração:', err);
    } finally {
      setSalvando(false);
    }
  }

  if (!config) return <div className="h-40 animate-pulse rounded-xl2 bg-coffee-100/60" />;

  return (
    <div className="space-y-2">
      <h3 className="mb-2 font-destaque text-sm font-semibold text-coffee-700">
        Configurações gerais
      </h3>

      <div className="flex items-center gap-3 rounded-xl2 border border-coffee-100 bg-cream-card px-3.5 py-3">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-coffee-50">
          <ShieldOff size={17} className="text-coffee-400" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-coffee-800">Bloquear/desbloquear usuário</p>
          <p className="text-xs text-coffee-400">
            Quando desligado, ninguém consegue bloquear outra pessoa e os bloqueios já feitos
            deixam de esconder posts, pra todo mundo.
          </p>
        </div>
        <button
          onClick={handleAlternar}
          disabled={salvando}
          aria-label={bloqueioAtivo ? 'Desligar bloqueio de usuário' : 'Ligar bloqueio de usuário'}
          className={`relative h-7 w-12 flex-shrink-0 rounded-full transition-colors disabled:opacity-60 ${
            bloqueioAtivo ? 'bg-coffee-700' : 'bg-coffee-100'
          }`}
        >
          {salvando ? (
            <Loader2
              size={14}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-spin text-cream"
            />
          ) : (
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-[#FAF6EF] shadow transition-transform ${
                bloqueioAtivo ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          )}
        </button>
      </div>

      <p className="pt-2 text-xs text-coffee-300">Mais configurações gerais vão aparecer aqui.</p>
    </div>
  );
}
