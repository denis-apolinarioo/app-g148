'use client';

import { useEffect, useState } from 'react';
import { Copy, Check, Loader2, Lock, Mail, RefreshCw, Send, ArrowUpRight, ArrowDownLeft, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { auth } from '@/lib/firebase';
import TopBar from '@/components/TopBar';
import LoadingScreen from '@/components/LoadingScreen';
import EmptyState from '@/components/EmptyState';
import DracmaIcon from '@/components/DracmaIcon';
import { useUsuarioAtual } from '@/lib/useUsuarioAtual';
import { formatDateTimeBR } from '@/lib/dateUtils';
import { useAppConfig } from '@/lib/useAppConfig';
import { CHAVE_TRANSFERENCIA_DRACMA_ATIVA } from '@/lib/appConfig';
import {
  subscribeToDracmaLog,
  pinConfigurado,
  configurarPin,
  validarPin,
  solicitarRecuperacaoPin,
  confirmarRecuperacaoPin,
  montarChaveRecebimento,
  transferirDracma,
  formatarDracma,
} from '@/lib/dracma';

// Rótulos amigáveis por tipo de lançamento no histórico — qualquer tipo não
// mapeado aqui cai no rótulo genérico "Movimentação", pra nunca quebrar a
// tela mesmo que um tipo novo seja adicionado depois. PACOTE 3: tipo
// 'transferencia' não usa este mapa direto (é bidirecional — ver
// rotuloTransacao() abaixo, que decide o texto conforme quem está vendo).
const ROTULO_TIPO = {
  missao: 'Missão cumprida',
  oracao: 'Orou por um pedido',
  post: 'Post no Feed',
  ajuste_admin: 'Ajuste do administrador',
  correio: 'Recompensa recebida no Correio',
};

// Preferência de esconder/mostrar o saldo — deliberadamente por
// DISPOSITIVO (localStorage), não por conta: mesmo padrão do tema claro/
// escuro (lib/theme.js, chave 'g148_tema'). Fica marcada mesmo fechando e
// reabrindo o app anos depois, e independe da Carteira estar
// bloqueada/desbloqueada (PIN) — não tem nenhuma lógica de expirar.
const CHAVE_SALDO_OCULTO = 'g148_saldo_oculto';

export default function CarteiraPage() {
  const { perfil, usuarioAuth } = useAuth();
  const config = useAppConfig();
  const [historico, setHistorico] = useState(null);
  const [copiado, setCopiado] = useState(false);

  // 'criar_pin' | 'carteira' | 'confirmar_entrada' | 'alterar_pin' |
  // 'recuperar_solicitar' | 'recuperar_confirmar' | 'enviar_dracma'
  const [modo, setModo] = useState(null);
  // Item pedido: esconder/mostrar o saldo (só o valor, não os outros dados).
  // Lê o valor salvo (se houver) já na 1ª renderização, pra não piscar o
  // saldo visível por um instante antes de esconder de novo.
  const [saldoOculto, setSaldoOculto] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem(CHAVE_SALDO_OCULTO) === '1';
    } catch {
      // localStorage indisponível (ex.: aba anônima) — some sempre desmarcado.
      return false;
    }
  });

  const transferenciaAtiva = config?.[CHAVE_TRANSFERENCIA_DRACMA_ATIVA] !== false;
  const chaveRecebimento = montarChaveRecebimento(perfil);

  // CORREÇÃO: alterar o PIN só é possível pelo fluxo "Esqueci meu PIN"
  // (código por e-mail), acessado de dentro da própria Carteira — não
  // existe mais um jeito de pular direto pra 'alterar_pin' sem passar por
  // essa confirmação, nem um botão em Configurações apontando pra cá (foi
  // removido de lá por ser redundante com este fluxo). 'alterar_pin' só é
  // alcançado depois que RecuperarConfirmar confirma o código (mais abaixo
  // neste arquivo).
  //
  // Além disso, quem já tem PIN configurado precisa digitar o PIN pra
  // ENTRAR na Carteira (modo 'confirmar_entrada'), não só pra transferir —
  // item pedido.
  useEffect(() => {
    if (!perfil) return;
    setModo(pinConfigurado(perfil) ? 'confirmar_entrada' : 'criar_pin');
  }, [perfil?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!perfil?.uid) return undefined;
    const unsub = subscribeToDracmaLog(perfil.uid, setHistorico);
    return () => unsub();
  }, [perfil?.uid]);

  if (!perfil || !modo) return <LoadingScreen />;

  function handleCopiarChave() {
    navigator.clipboard.writeText(chaveRecebimento).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    });
  }

  return (
    <div className="mx-auto max-w-2xl">
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

        {modo === 'confirmar_entrada' && (
          <ConfirmarEntradaCarteira
            uid={perfil.uid}
            onConfirmado={() => setModo('carteira')}
            onEsqueciPin={() => setModo('recuperar_solicitar')}
            onSemPin={() => setModo('criar_pin')}
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
            onVoltar={() => setModo('confirmar_entrada')}
          />
        )}

        {modo === 'recuperar_solicitar' && (
          <RecuperarSolicitar
            perfil={perfil}
            email={usuarioAuth?.email || auth.currentUser?.email}
            onEnviado={() => setModo('recuperar_confirmar')}
            onVoltar={() => setModo('confirmar_entrada')}
          />
        )}

        {modo === 'recuperar_confirmar' && (
          <RecuperarConfirmar
            uid={perfil.uid}
            onConfirmado={() => setModo('alterar_pin')}
            onVoltar={() => setModo('confirmar_entrada')}
          />
        )}

        {modo === 'enviar_dracma' && (
          <FormularioTransferencia
            perfil={perfil}
            onVoltar={() => setModo('carteira')}
            onEnviado={() => setModo('carteira')}
            onEsqueciPin={() => setModo('recuperar_solicitar')}
          />
        )}

        {modo === 'carteira' && (
          <>
            <div className="relative rounded-2xl border border-coffee-100 bg-cream-card p-5 text-center shadow-card">
              <button
                type="button"
                onClick={() =>
                  setSaldoOculto((atual) => {
                    const novo = !atual;
                    try {
                      window.localStorage.setItem(CHAVE_SALDO_OCULTO, novo ? '1' : '0');
                    } catch {
                      // localStorage indisponível — vale só pra esta sessão.
                    }
                    return novo;
                  })
                }
                aria-label={saldoOculto ? 'Mostrar saldo' : 'Esconder saldo'}
                className="absolute right-3 top-3 rounded-full p-1.5 text-coffee-400"
              >
                {saldoOculto ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>

              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-gold/15">
                <DracmaIcon size={22} className="text-gold" />
              </div>
              <div className="mt-3">
                <p className="font-destaque text-3xl font-bold text-coffee-800">
                  {saldoOculto ? (
                    <span className="tracking-widest">••••</span>
                  ) : (
                    <>D$ {formatarDracma(perfil.dracmas || 0)}</>
                  )}{' '}
                  {!saldoOculto && <span className="text-base font-semibold text-coffee-400">dracmas</span>}
                </p>
              </div>
            </div>

            {transferenciaAtiva && (
              <button
                onClick={() => setModo('enviar_dracma')}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-coffee-700 py-3.5 text-sm font-semibold text-cream"
              >
                <Send size={16} />
                Enviar Dracma
              </button>
            )}

            <div className="rounded-2xl border border-coffee-100 bg-cream-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-coffee-400">
                Sua chave de recebimento
              </p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="font-destaque text-sm font-semibold text-coffee-800">
                  {chaveRecebimento}
                </span>
                <button
                  onClick={handleCopiarChave}
                  className="flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-coffee-100 px-2.5 py-1.5 text-xs font-medium text-coffee-600"
                >
                  {copiado ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
                  {copiado ? 'Copiado' : 'Copiar'}
                </button>
              </div>
              <p className="mt-2 text-xs text-coffee-400">
                Seu @usuário + data de nascimento, tudo junto. Compartilhe essa chave com quem for
                te enviar Dracma.
              </p>
            </div>

            <div>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-coffee-400">
                Histórico de transações
              </h2>
              <div className="space-y-2">
                {historico === null && (
                  <div className="h-16 animate-pulse rounded-xl2 bg-coffee-100/60" />
                )}
                {historico?.length === 0 && (
                  <EmptyState icone={DracmaIcon} titulo="Nenhuma transação ainda" />
                )}
                {historico?.map((item) => (
                  <LinhaHistoricoTransacao key={item.id} item={item} uidAtual={perfil.uid} />
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
// Uma linha do histórico de transações da Carteira. Igual a descreverTransacao
// de antes, mas agora resolvendo e mostrando o NOME REAL de quem mandou/
// recebeu (via useUsuarioAtual, mesmo padrão do histórico do Admin em
// AbaHistorico.js) — antes só dizia "Dracma enviado"/"Dracma recebido" sem
// dizer pra quem/de quem.
// ----------------------------------------------------------------------------
function LinhaHistoricoTransacao({ item, uidAtual }) {
  const ehTransferencia = item.tipo === 'transferencia';
  const enviou = ehTransferencia && item.origem === uidAtual;
  const outroUid = ehTransferencia ? (enviou ? item.destino : item.origem) : null;
  const outraPessoa = useUsuarioAtual(outroUid);

  const rotulo = ehTransferencia
    ? enviou
      ? `Dracma enviado para ${outraPessoa.nome}`
      : `Dracma recebido de ${outraPessoa.nome}`
    : ROTULO_TIPO[item.tipo] || 'Movimentação';
  const valorExibido = ehTransferencia ? (enviou ? -item.valor : item.valor) : item.valor;
  const Icone = ehTransferencia ? (enviou ? ArrowUpRight : ArrowDownLeft) : null;

  return (
    <div className="flex items-center justify-between rounded-xl2 border border-coffee-100 bg-cream-card px-3.5 py-2.5">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {Icone && <Icone size={14} className="flex-shrink-0 text-coffee-300" />}
        <div className="min-w-0">
          <p className="truncate text-sm text-coffee-700">{rotulo}</p>
          <p className="text-xs text-coffee-300">
            {item.createdAt ? formatDateTimeBR(item.createdAt) : '...'}
          </p>
        </div>
      </div>
      <span
        className={`flex-shrink-0 font-destaque text-sm font-bold ${
          valorExibido >= 0 ? 'text-green-700' : 'text-red-600'
        }`}
      >
        {valorExibido >= 0 ? '+' : '-'}
        {formatarDracma(Math.abs(valorExibido))}
      </span>
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
// Item pedido: pedir o PIN pra ENTRAR na Carteira (não só pra transferir).
// Usa a mesma validarPin (com o mesmo bloqueio por tentativas erradas) já
// usada na transferência. Se a pessoa não tiver PIN configurado (ex.: acabou
// de confirmar a recuperação e ainda não criou um novo), avisa via
// onSemPin em vez de mostrar erro.
// ----------------------------------------------------------------------------
function ConfirmarEntradaCarteira({ uid, onConfirmado, onEsqueciPin, onSemPin }) {
  const [pin, setPin] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState('');

  async function handleConfirmar() {
    if (!/^\d{4}$/.test(pin)) {
      setErro('Digite o PIN de 4 dígitos da sua Carteira.');
      return;
    }
    setConfirmando(true);
    setErro('');
    try {
      await validarPin(uid, pin);
      onConfirmado();
    } catch (err) {
      if (err.message === 'PIN_NAO_CONFIGURADO') {
        onSemPin();
        return;
      }
      const mensagens = {
        PIN_BLOQUEADO: 'PIN bloqueado por várias tentativas erradas. Tente de novo mais tarde.',
        PIN_INCORRETO: 'PIN incorreto.',
      };
      setErro(mensagens[err.message] || 'Não foi possível confirmar o PIN.');
    } finally {
      setConfirmando(false);
    }
  }

  return (
    <div className="rounded-2xl border border-coffee-100 bg-cream-card p-5 text-center">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-coffee-50">
        <Lock size={20} className="text-coffee-600" />
      </div>
      <p className="mt-3 font-destaque text-base font-semibold text-coffee-800">
        Digite o PIN da Carteira
      </p>
      <p className="mt-1 text-sm text-coffee-400">Confirme seu PIN pra entrar.</p>

      <input
        type="password"
        inputMode="numeric"
        maxLength={4}
        value={pin}
        onChange={(e) => {
          setPin(e.target.value.replace(/\D/g, ''));
          setErro('');
        }}
        placeholder="••••"
        autoFocus
        className="mt-4 w-full rounded-xl border border-coffee-100 bg-cream px-3 py-2.5 text-center text-lg tracking-[0.4em] text-coffee-800"
      />

      {erro && <p className="mt-2 text-xs text-red-600">{erro}</p>}

      <button
        onClick={handleConfirmar}
        disabled={confirmando}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-coffee-700 py-2.5 text-sm font-semibold text-cream disabled:opacity-50"
      >
        {confirmando && <Loader2 size={15} className="animate-spin" />}
        Entrar
      </button>
      <button
        onClick={onEsqueciPin}
        className="mt-2 w-full text-center text-xs text-coffee-500 underline underline-offset-2"
      >
        Esqueci meu PIN
      </button>
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

// ----------------------------------------------------------------------------
// PACOTE 3, item 3.1 — envio de Dracma: chave de recebimento + valor + PIN.
// ----------------------------------------------------------------------------
function FormularioTransferencia({ perfil, onVoltar, onEnviado, onEsqueciPin }) {
  const [chave, setChave] = useState('');
  const [valor, setValor] = useState('');
  const [pin, setPin] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  const mensagensErro = {
    PIN_NAO_CONFIGURADO: 'Sua Carteira ainda não tem um PIN configurado.',
    PIN_BLOQUEADO: 'PIN bloqueado por várias tentativas erradas. Tente de novo mais tarde.',
    PIN_INCORRETO: 'PIN incorreto.',
    TRANSFERENCIAS_DESATIVADAS: 'O administrador desativou as transferências de Dracma no momento.',
    VALOR_INVALIDO: 'Digite um valor válido, maior que zero.',
    DESTINO_NAO_ENCONTRADO: 'Não achamos ninguém com essa chave de recebimento. Confira e tente de novo.',
    DESTINO_INVALIDO: 'Você não pode enviar Dracma pra você mesmo.',
    SALDO_INSUFICIENTE: 'Você não tem Dracma suficiente pra essa transferência.',
  };

  async function handleEnviar() {
    if (enviando) return;
    setErro('');
    setSucesso('');

    if (!chave.trim()) {
      setErro('Digite a chave de recebimento de quem vai receber.');
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      setErro('Digite o PIN de 4 dígitos da sua Carteira.');
      return;
    }

    setEnviando(true);
    try {
      const destino = await transferirDracma(perfil, chave.trim(), valor, pin);
      setSucesso(`Dracma enviado pra ${destino.nome}!`);
      setChave('');
      setValor('');
      setPin('');
      setTimeout(() => onEnviado(), 1200);
    } catch (err) {
      console.error('Erro ao transferir Dracma:', err);
      setErro(mensagensErro[err.message] || 'Não foi possível concluir a transferência. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="rounded-2xl border border-coffee-100 bg-cream-card p-5">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-coffee-50">
        <Send size={20} className="text-coffee-600" />
      </div>
      <p className="mt-3 text-center font-destaque text-base font-semibold text-coffee-800">
        Enviar Dracma
      </p>
      <p className="mt-1 text-center text-sm text-coffee-400">
        Você tem <strong>{formatarDracma(perfil.dracmas || 0)}</strong> Dracma disponível.
      </p>

      <div className="mt-4 space-y-2.5">
        <div>
          <label className="mb-1 block text-xs font-medium text-coffee-500">
            Chave de recebimento de quem vai receber
          </label>
          <input
            type="text"
            value={chave}
            onChange={(e) => setChave(e.target.value)}
            placeholder="username_1990_05_20"
            autoCapitalize="none"
            className="w-full rounded-xl border border-coffee-100 bg-cream px-3 py-2.5 text-sm text-coffee-800 placeholder:text-coffee-300"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-coffee-500">Valor</label>
          <input
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="0,00"
            className="w-full rounded-xl border border-coffee-100 bg-cream px-3 py-2.5 text-sm text-coffee-800 placeholder:text-coffee-300"
          />
          {/* Item pedido: valor pode ser quebrado, limitado a 2 casas
              decimais (ex.: 5,00 / 5,01 / 5,99) — validação de verdade fica
              em transferirDracma (lib/dracma.js), este input só ajuda a
              pessoa a digitar certo. */}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-coffee-500">PIN da Carteira</label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            placeholder="••••"
            className="w-full rounded-xl border border-coffee-100 bg-cream px-3 py-2.5 text-center text-lg tracking-[0.4em] text-coffee-800"
          />
          {/* CORREÇÃO: esse link não existia em lugar nenhum da tela — o
              fluxo de recuperação por e-mail (RecuperarSolicitar/
              RecuperarConfirmar, mais abaixo neste arquivo) já estava
              pronto, mas não tinha como chegar nele. */}
          {onEsqueciPin && (
            <button
              type="button"
              onClick={onEsqueciPin}
              className="mt-1.5 text-xs font-medium text-coffee-500 underline underline-offset-2"
            >
              Esqueci meu PIN
            </button>
          )}
        </div>
      </div>

      {erro && <p className="mt-2 text-center text-xs text-red-600">{erro}</p>}
      {sucesso && <p className="mt-2 text-center text-xs font-semibold text-green-700">{sucesso}</p>}

      <button
        onClick={handleEnviar}
        disabled={enviando}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-coffee-700 py-2.5 text-sm font-semibold text-cream disabled:opacity-50"
      >
        {enviando && <Loader2 size={15} className="animate-spin" />}
        Enviar
      </button>

      <button onClick={onVoltar} className="mt-2 w-full text-center text-xs text-coffee-400">
        Cancelar
      </button>
    </div>
  );
}
