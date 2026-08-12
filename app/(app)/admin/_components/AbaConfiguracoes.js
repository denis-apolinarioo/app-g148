'use client';

// Item 11 do Bloco 4 (central de configurações) + item 12 do Bloco 5
// (1ª configuração de verdade: liga/desliga a função de bloquear usuário).

import { useState } from 'react';
import { Loader2, ShieldOff, Send, Award, AlertTriangle, Check } from 'lucide-react';
import DracmaIcon from '@/components/DracmaIcon';
import { useAuth } from '@/components/AuthProvider';
import { useAppConfig } from '@/lib/useAppConfig';
import {
  CHAVE_BLOQUEIO_USUARIO_ATIVO,
  CHAVE_TRANSFERENCIA_DRACMA_ATIVA,
  CHAVE_NOME_COMUNIDADE,
  NOME_APP_PADRAO,
  salvarConfiguracoesApp,
} from '@/lib/appConfig';
import { resetarPontosDeTodos } from '@/lib/points';
import { resetarDracmasDeTodos } from '@/lib/dracma';
import ConfirmarResetModal from '@/components/ConfirmarResetModal';
import { useConfirm } from '@/components/ConfirmProvider';

export default function AbaConfiguracoes() {
  const { perfil } = useAuth();
  const config = useAppConfig();
  const [salvando, setSalvando] = useState(null); // null | chave sendo salva agora

  async function alternar(chave, valorAtual) {
    if (salvando || !config) return;
    setSalvando(chave);
    try {
      await salvarConfiguracoesApp({ [chave]: !valorAtual }, perfil);
    } catch (err) {
      console.error('Erro ao salvar configuração:', err);
    } finally {
      setSalvando(null);
    }
  }

  if (!config) return <div className="h-40 animate-pulse rounded-xl2 bg-coffee-100/60" />;

  // Chave ainda não existe no documento = comportamento de hoje/padrão = ativo.
  const bloqueioAtivo = config[CHAVE_BLOQUEIO_USUARIO_ATIVO] !== false;
  const transferenciaAtiva = config[CHAVE_TRANSFERENCIA_DRACMA_ATIVA] !== false;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="mb-2 font-destaque text-sm font-semibold text-coffee-700">
          Configurações gerais
        </h3>

        <CampoNomeComunidade
          valorSalvo={config[CHAVE_NOME_COMUNIDADE] || NOME_APP_PADRAO}
          admin={perfil}
        />

        <ToggleConfig
          icone={ShieldOff}
          titulo="Bloquear/desbloquear usuário"
          descricao="Quando desligado, ninguém consegue bloquear outra pessoa e os bloqueios já feitos deixam de esconder posts, pra todo mundo."
          ativo={bloqueioAtivo}
          salvando={salvando === CHAVE_BLOQUEIO_USUARIO_ATIVO}
          onAlternar={() => alternar(CHAVE_BLOQUEIO_USUARIO_ATIVO, bloqueioAtivo)}
        />

        <ToggleConfig
          icone={Send}
          titulo="Transferência de Dracma entre usuários"
          descricao="Quando desligado, ninguém consegue enviar Dracma pra outra pessoa pela Carteira (o histórico e os saldos continuam normais)."
          ativo={transferenciaAtiva}
          salvando={salvando === CHAVE_TRANSFERENCIA_DRACMA_ATIVA}
          onAlternar={() => alternar(CHAVE_TRANSFERENCIA_DRACMA_ATIVA, transferenciaAtiva)}
        />

        <p className="pt-2 text-xs text-coffee-300">Mais configurações gerais vão aparecer aqui.</p>
      </div>

      <ZonaDePerigo admin={perfil} />
    </div>
  );
}

// Item novo — nome da comunidade (cabeçalho do Feed, tela de login). Campo
// de texto livre, diferente dos toggles acima: salva só quando a pessoa
// aperta "Salvar" (não a cada letra digitada, que geraria uma escrita no
// Firestore por tecla) — o botão só aparece quando o texto muda de verdade.
function CampoNomeComunidade({ valorSalvo, admin }) {
  const [valor, setValor] = useState(valorSalvo);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  const mudou = valor.trim() !== valorSalvo && valor.trim() !== '';

  async function handleSalvar() {
    if (!mudou || salvando) return;
    setSalvando(true);
    try {
      await salvarConfiguracoesApp({ [CHAVE_NOME_COMUNIDADE]: valor.trim() }, admin);
      setSalvo(true);
      setTimeout(() => setSalvo(false), 2000);
    } catch (err) {
      console.error('Erro ao salvar nome da comunidade:', err);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="rounded-xl2 border border-coffee-100 bg-cream-card px-3.5 py-3">
      <label className="mb-1.5 block text-xs font-medium text-coffee-500">
        Nome da comunidade
      </label>
      <p className="mb-2 text-xs text-coffee-400">
        Aparece no cabeçalho do Feed e na tela de login. Não muda o título da aba do navegador
        nem o nome ao adicionar à tela inicial — isso depende do código, não deste campo.
      </p>
      <div className="flex items-center gap-2">
        <input
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          maxLength={40}
          placeholder={NOME_APP_PADRAO}
          className="w-full min-w-0 rounded-lg border border-coffee-100 bg-cream px-3 py-2 text-sm text-coffee-800 outline-none"
        />
        <button
          onClick={handleSalvar}
          disabled={!mudou || salvando}
          className="flex h-9 flex-shrink-0 items-center justify-center gap-1.5 rounded-lg bg-forte px-3.5 text-xs font-semibold text-texto-forte disabled:opacity-40"
        >
          {salvando ? (
            <Loader2 size={14} className="animate-spin" />
          ) : salvo ? (
            <Check size={14} />
          ) : (
            'Salvar'
          )}
        </button>
      </div>
    </div>
  );
}

function ToggleConfig({ icone: Icone, titulo, descricao, ativo, salvando, onAlternar }) {
  return (
    <div className="flex items-center gap-3 rounded-xl2 border border-coffee-100 bg-cream-card px-3.5 py-3">
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-coffee-50">
        <Icone size={17} className="text-coffee-400" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-coffee-800">{titulo}</p>
        <p className="text-xs text-coffee-400">{descricao}</p>
      </div>
      <button
        onClick={onAlternar}
        disabled={salvando}
        aria-label={ativo ? `Desligar ${titulo}` : `Ligar ${titulo}`}
        className={`relative h-7 w-12 flex-shrink-0 rounded-full transition-colors disabled:opacity-60 ${
          ativo ? 'bg-forte' : 'bg-coffee-100'
        }`}
      >
        {salvando ? (
          <Loader2
            size={14}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-spin text-texto-forte"
          />
        ) : (
          <span
            className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-[rgb(var(--cor-cream))] shadow transition-transform ${
              ativo ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        )}
      </button>
    </div>
  );
}

// ----------------------------------------------------------------------------
// PACOTE 3, item 3.3 — reset manual duplo (Pontos / Dracma), com confirmação
// tripla: 1) pop up nativo, 2) código por e-mail, 3) senha do admin (as duas
// últimas dentro de ConfirmarResetModal). Zera pontos/dracmas de TODOS os
// usuários — ação irreversível.
// ----------------------------------------------------------------------------
function ZonaDePerigo({ admin }) {
  const confirmar = useConfirm();
  const [modalAberto, setModalAberto] = useState(null); // null | 'pontos' | 'dracmas'
  const [executando, setExecutando] = useState(false);
  const [resultado, setResultado] = useState(null); // { acao, quantidade } | null
  const [erro, setErro] = useState('');

  async function handleAbrirConfirmacao(acao) {
    setErro('');
    setResultado(null);
    const descricao =
      acao === 'pontos'
        ? 'Isso zera os Pontos de Comunhão de TODOS os usuários do app. Essa ação não pode ser desfeita.'
        : 'Isso zera os Dracmas de TODOS os usuários do app. Essa ação não pode ser desfeita.';
    // 1º fator da confirmação tripla (os outros dois ficam dentro de
    // ConfirmarResetModal: código por e-mail e senha do admin).
    const ok = await confirmar({
      titulo: 'Tem certeza?',
      descricao,
      perigo: true,
      labelConfirmar: 'Continuar',
    });
    if (ok) {
      setModalAberto(acao);
    }
  }

  async function handleConfirmado() {
    setExecutando(true);
    setErro('');
    try {
      const quantidade =
        modalAberto === 'pontos'
          ? await resetarPontosDeTodos(admin)
          : await resetarDracmasDeTodos(admin);
      setResultado({ acao: modalAberto, quantidade });
      setModalAberto(null);
    } catch (err) {
      console.error('Erro ao resetar em massa:', err);
      setErro('Não foi possível concluir o reset. Tente de novo.');
    } finally {
      setExecutando(false);
    }
  }

  return (
    <div className="space-y-2">
      <h3 className="mb-2 flex items-center gap-1.5 font-destaque text-sm font-semibold text-red-700">
        <AlertTriangle size={15} />
        Zona de perigo
      </h3>
      <p className="mb-2 text-xs text-coffee-400">
        As ações abaixo afetam TODOS os usuários do app de uma vez e não podem ser desfeitas.
      </p>

      <BotaoReset
        icone={Award}
        titulo="Zerar Pontos de Comunhão de todos"
        onClick={() => handleAbrirConfirmacao('pontos')}
        disabled={executando}
      />
      <BotaoReset
        icone={DracmaIcon}
        titulo="Zerar Dracmas de todos"
        onClick={() => handleAbrirConfirmacao('dracmas')}
        disabled={executando}
      />

      {erro && <p className="text-xs text-red-600">{erro}</p>}
      {resultado && (
        <p className="text-xs font-medium text-green-700">
          {resultado.acao === 'pontos'
            ? `Pronto: ${resultado.quantidade} usuário(s) tiveram os Pontos de Comunhão zerados.`
            : `Pronto: ${resultado.quantidade} usuário(s) tiveram os Dracmas zerados.`}
        </p>
      )}

      {modalAberto && (
        <ConfirmarResetModal
          acao={modalAberto}
          titulo={modalAberto === 'pontos' ? 'Zerar Pontos de todos' : 'Zerar Dracmas de todos'}
          descricao={
            modalAberto === 'pontos'
              ? 'Isso vai zerar o campo de Pontos de Comunhão de TODOS os usuários do app, agora.'
              : 'Isso vai zerar o saldo de Dracma de TODOS os usuários do app, agora.'
          }
          onFechar={() => (executando ? null : setModalAberto(null))}
          onConfirmado={handleConfirmado}
        />
      )}
    </div>
  );
}

function BotaoReset({ icone: Icone, titulo, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-3 rounded-xl2 border border-red-100 bg-red-50/40 px-3.5 py-3 text-left disabled:opacity-50"
    >
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-red-100">
        <Icone size={17} className="text-red-600" />
      </span>
      <span className="text-sm font-semibold text-red-700">{titulo}</span>
    </button>
  );
}
