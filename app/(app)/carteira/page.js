'use client';

import { useEffect, useState } from 'react';
import { Coins, Copy, Check, KeyRound, Loader2, Lock, Mail, RefreshCw } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { auth } from '@/lib/firebase';
import TopBar from '@/components/TopBar';
import LoadingScreen from '@/components/LoadingScreen';
import EmptyState from '@/components/EmptyState';
import { formatDateTimeBR } from '@/lib/dateUtils';
import {
  subscribeToDracmaLog,
  pinConfigurado,
  configurarPin,
  solicitarRecuperacaoPin,
  confirmarRecuperacaoPin,
} from '@/lib/dracma';

// Rótulos amigáveis por tipo de lançamento no histórico — qualquer tipo não
// mapeado aqui cai no rótulo genérico "Movimentação", pra nunca quebrar a
// tela mesmo que um tipo novo seja adicionado depois (ex.: transferências,
// no Pacote 3).
const ROTULO_TIPO = {
  missao: 'Missão cumprida',
  oracao: 'Orou por um pedido',
  post: 'Post no Feed',
  ajuste_admin: 'Ajuste do administrador',
};

export default function CarteiraPage() {
  const { perfil, usuarioAuth } = useAuth();
  const [historico, setHistorico] = useState(null);
  const [copiado, setCopiado] = useState(false);

  // 'criar_pin' | 'carteira' | 'alterar_pin' | 'recuperar_solicitar' | 'recuperar_confirmar'
  const [modo, setModo] = useState(null);

  useEffect(() => {
    if (!perfil) return;
    setModo(pinConfigurado(perfil) ? 'carteira' : 'criar_pin');
  }, [perfil?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!perfil?.uid) return undefined;
    const unsub = subscribeToDracmaLog(perfil.uid, setHistorico);
    return () => unsub();
  }, [perfil?.uid]);

  if (!perfil || !modo) return <LoadingScreen />;

  function handleCopiarChave() {
    navigator.clipboard.writeText(`@${perfil.username}`).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    });
  }

  return (
    <div className="mx-auto max-w-md">
      <TopBar titulo="Carteira" voltarPara="/perfil" />

      <div className="space-y-5 px-5 py-5">
        {modo === 'criar_pin' && (
          <FormularioPin
            titulo="Crie o PIN da sua Carteira"
            descricao="Antes de continuar, crie um PIN de 4 dígitos pra proteger sua Carteira. Você vai usar esse PIN em futuras transferências."
            onConfirmar={async (pin) => {
              await configurarPin(perfil.uid, pin);
              setModo('carteira');
            }}
          />
        )}

        {modo === 'alterar_pin' && (
          <FormularioPin
            titulo="Criar novo PIN"
            descricao="Escolha um novo PIN de 4 dígitos."
            onConfirmar={async (pin) => {
              await configurarPin(perfil.uid, pin);
              setModo('carteira');
            }}
            onVoltar={() => setModo('carteira')}
          />
        )}

        {modo === 'recuperar_solicitar' && (
          <RecuperarSolicitar
            perfil={perfil}
            email={usuarioAuth?.email || auth.currentUser?.email}
            onEnviado={() => setModo('recuperar_confirmar')}
            onVoltar={() => setModo('carteira')}
          />
        )}

        {modo === 'recuperar_confirmar' && (
          <RecuperarConfirmar
            uid={perfil.uid}
            onConfirmado={() => setModo('alterar_pin')}
            onVoltar={() => setModo('carteira')}
          />
        )}

        {modo === 'carteira' && (
          <>
            <div className="rounded-2xl border border-coffee-100 bg-cream-card p-5 text-center shadow-card">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-gold/15">
                <Coins size={22} className="text-gold" />
              </div>
              <p className="mt-3 font-destaque text-3xl font-bold text-coffee-800">
                {perfil.dracmas || 0}
              </p>
              <p className="text-xs text-coffee-400">Dracmas</p>
            </div>

            <div className="rounded-2xl border border-coffee-100 bg-cream-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-coffee-400">
                Sua chave de recebimento
              </p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="font-destaque text-sm font-semibold text-coffee-800">
                  @{perfil.username}
                </span>
                <button
                  onClick={handleCopiarChave}
                  className="flex items-center gap-1.5 rounded-lg border border-coffee-100 px-2.5 py-1.5 text-xs font-medium text-coffee-600"
                >
                  {copiado ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
                  {copiado ? 'Copiado' : 'Copiar'}
                </button>
              </div>
              <p className="mt-2 text-xs text-coffee-400">
                Compartilhe essa chave com quem for te enviar Dracma.
              </p>
            </div>

            <button
              onClick={() => setModo('alterar_pin')}
              className="flex w-full items-center gap-3 rounded-2xl border border-coffee-100 bg-cream-card p-4 text-left"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-coffee-50">
                <KeyRound size={18} className="text-coffee-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-coffee-800">Alterar PIN</p>
                <p className="text-xs text-coffee-400">Trocar o PIN de 4 dígitos da carteira</p>
              </div>
            </button>

            <div>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-coffee-400">
                Histórico de transações
              </h2>
              <div className="space-y-2">
                {historico === null && (
                  <div className="h-16 animate-pulse rounded-xl2 bg-coffee-100/60" />
                )}
                {historico?.length === 0 && (
                  <EmptyState icone={Coins} titulo="Nenhuma transação ainda" />
                )}
                {historico?.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl2 border border-coffee-100 bg-cream-card px-3.5 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-coffee-700">
                        {ROTULO_TIPO[item.tipo] || 'Movimentação'}
                      </p>
                      <p className="text-xs text-coffee-300">
                        {item.createdAt ? formatDateTimeBR(item.createdAt) : '...'}
                      </p>
                    </div>
                    <span
                      className={`font-destaque text-sm font-bold ${
                        item.valor >= 0 ? 'text-green-700' : 'text-red-600'
                      }`}
                    >
                      {item.valor >= 0 ? '+' : ''}
                      {item.valor}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Formulário de criação/troca de PIN — 2 campos (PIN + confirmação), 4
// dígitos numéricos cada.
// ----------------------------------------------------------------------------
function FormularioPin({ titulo, descricao, onConfirmar, onVoltar }) {
  const [pin, setPin] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  async function handleSalvar() {
    if (!/^\d{4}$/.test(pin)) {
      setErro('O PIN precisa ter exatamente 4 números.');
      return;
    }
    if (pin !== confirmacao) {
      setErro('Os PINs não coincidem.');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      await onConfirmar(pin);
    } catch (err) {
      console.error('Erro ao salvar PIN:', err);
      setErro('Não foi possível salvar o PIN. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="rounded-2xl border border-coffee-100 bg-cream-card p-5">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-coffee-50">
        <Lock size={20} className="text-coffee-600" />
      </div>
      <p className="mt-3 text-center font-destaque text-base font-semibold text-coffee-800">
        {titulo}
      </p>
      <p className="mt-1 text-center text-sm text-coffee-400">{descricao}</p>

      <div className="mt-4 space-y-2.5">
        <input
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          placeholder="Novo PIN (4 dígitos)"
          className="w-full rounded-xl border border-coffee-100 bg-cream px-3 py-2.5 text-center text-lg tracking-[0.4em] text-coffee-800"
        />
        <input
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={confirmacao}
          onChange={(e) => setConfirmacao(e.target.value.replace(/\D/g, ''))}
          placeholder="Confirme o PIN"
          className="w-full rounded-xl border border-coffee-100 bg-cream px-3 py-2.5 text-center text-lg tracking-[0.4em] text-coffee-800"
        />
      </div>

      {erro && <p className="mt-2 text-center text-xs text-red-600">{erro}</p>}

      <button
        onClick={handleSalvar}
        disabled={salvando}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-coffee-700 py-2.5 text-sm font-semibold text-cream disabled:opacity-50"
      >
        {salvando && <Loader2 size={15} className="animate-spin" />}
        Salvar PIN
      </button>

      {onVoltar && (
        <button
          onClick={onVoltar}
          className="mt-2 w-full text-center text-xs text-coffee-400"
        >
          Cancelar
        </button>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Recuperação de PIN — passo 1: pedir o código por e-mail.
// ----------------------------------------------------------------------------
function RecuperarSolicitar({ perfil, email, onEnviado, onVoltar }) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  async function handleEnviar() {
    setEnviando(true);
    setErro('');
    try {
      await solicitarRecuperacaoPin(perfil, email);
      onEnviado();
    } catch (err) {
      console.error('Erro ao solicitar recuperação de PIN:', err);
      setErro('Não foi possível enviar o e-mail agora. Tente de novo em instantes.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="rounded-2xl border border-coffee-100 bg-cream-card p-5 text-center">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-coffee-50">
        <Mail size={20} className="text-coffee-600" />
      </div>
      <p className="mt-3 font-destaque text-base font-semibold text-coffee-800">
        Recuperar PIN por e-mail
      </p>
      <p className="mt-1 text-sm text-coffee-400">
        Vamos enviar um código de 6 dígitos para <strong>{email || 'seu e-mail cadastrado'}</strong>.
      </p>
      {erro && <p className="mt-2 text-xs text-red-600">{erro}</p>}
      <button
        onClick={handleEnviar}
        disabled={enviando || !email}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-coffee-700 py-2.5 text-sm font-semibold text-cream disabled:opacity-50"
      >
        {enviando && <Loader2 size={15} className="animate-spin" />}
        Enviar código
      </button>
      <button onClick={onVoltar} className="mt-2 w-full text-center text-xs text-coffee-400">
        Cancelar
      </button>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Recuperação de PIN — passo 2: confirmar o código recebido.
// ----------------------------------------------------------------------------
function RecuperarConfirmar({ uid, onConfirmado, onVoltar }) {
  const [codigo, setCodigo] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState('');

  async function handleConfirmar() {
    if (!/^\d{6}$/.test(codigo)) {
      setErro('Digite o código de 6 dígitos que você recebeu por e-mail.');
      return;
    }
    setConfirmando(true);
    setErro('');
    try {
      await confirmarRecuperacaoPin(uid, codigo);
      onConfirmado();
    } catch (err) {
      const mensagens = {
        CODIGO_EXPIRADO: 'Esse código expirou. Peça um novo.',
        CODIGO_INCORRETO: 'Código incorreto. Confira e tente de novo.',
      };
      setErro(mensagens[err.message] || 'Não foi possível confirmar o código.');
    } finally {
      setConfirmando(false);
    }
  }

  return (
    <div className="rounded-2xl border border-coffee-100 bg-cream-card p-5 text-center">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-coffee-50">
        <RefreshCw size={20} className="text-coffee-600" />
      </div>
      <p className="mt-3 font-destaque text-base font-semibold text-coffee-800">
        Digite o código recebido
      </p>
      <p className="mt-1 text-sm text-coffee-400">Ele vale por 10 minutos.</p>

      <input
        type="text"
        inputMode="numeric"
        maxLength={6}
        value={codigo}
        onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
        placeholder="000000"
        className="mt-4 w-full rounded-xl border border-coffee-100 bg-cream px-3 py-2.5 text-center text-lg tracking-[0.4em] text-coffee-800"
      />

      {erro && <p className="mt-2 text-xs text-red-600">{erro}</p>}

      <button
        onClick={handleConfirmar}
        disabled={confirmando}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-coffee-700 py-2.5 text-sm font-semibold text-cream disabled:opacity-50"
      >
        {confirmando && <Loader2 size={15} className="animate-spin" />}
        Confirmar código
      </button>
      <button onClick={onVoltar} className="mt-2 w-full text-center text-xs text-coffee-400">
        Cancelar
      </button>
    </div>
  );
}
