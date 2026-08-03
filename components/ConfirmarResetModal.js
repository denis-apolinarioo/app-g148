'use client';

// ============================================================================
// PACOTE 3, item 3.3 — 2º e 3º fator da confirmação tripla pros botões de
// reset em massa (Pontos/Dracma) no Admin. O 1º fator (pop up) já aconteceu
// antes deste componente ser montado — ver handleAbrirConfirmacao() em
// AbaConfiguracoes.js, que usa window.confirm().
//
// Passo 1 (aqui dentro): código de 6 dígitos por e-mail — gerado no aparelho
// do admin (igual à recuperação de PIN da Carteira, lib/dracma.js), enviado
// pela rota app/api/confirmar-reset/route.js. Não é salvo em lugar nenhum
// do Firestore — só vive no state deste componente durante o fluxo.
//
// Passo 2: reautenticação com a própria senha (ou Google) da conta do
// admin — a "senha de transferências do admin" pedida na tarefa é a mesma
// senha da conta, reaproveitando o mecanismo que já existe em
// AdminLoginGate.js pra entrar no Painel Admin.
// ============================================================================

import { useEffect, useState } from 'react';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
} from 'firebase/auth';
import { X, Mail, Lock, Eye, EyeOff, Loader2, ShieldAlert } from 'lucide-react';
import { auth, googleProvider } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';

function gerarCodigo() {
  const numero = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
  return String(numero).padStart(6, '0');
}

function mensagemErroReauth(codigo) {
  const mapa = {
    'auth/wrong-password': 'Senha incorreta.',
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde um instante e tente de novo.',
    'auth/popup-closed-by-user': '',
    'auth/user-mismatch': 'Essa confirmação precisa ser feita com a mesma conta que está logada no app.',
  };
  return mapa[codigo] ?? 'Não foi possível confirmar. Tente novamente.';
}

export default function ConfirmarResetModal({ acao, titulo, descricao, onFechar, onConfirmado }) {
  const { perfil, usuarioAuth } = useAuth();
  const [etapa, setEtapa] = useState('email'); // 'email' | 'senha'

  // --- Etapa 1: código por e-mail -------------------------------------------
  const [codigoGerado, setCodigoGerado] = useState('');
  const [codigoDigitado, setCodigoDigitado] = useState('');
  const [enviandoEmail, setEnviandoEmail] = useState(false);
  const [emailEnviado, setEmailEnviado] = useState(false);
  const [erroEmail, setErroEmail] = useState('');

  const email = usuarioAuth?.email || auth.currentUser?.email;

  async function enviarCodigo() {
    if (!email) {
      setErroEmail('Sua conta não tem e-mail cadastrado pra receber o código.');
      return;
    }
    setEnviandoEmail(true);
    setErroEmail('');
    const novoCodigo = gerarCodigo();
    try {
      const resposta = await fetch('/api/confirmar-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, nome: perfil?.nome, codigo: novoCodigo, acao }),
      });
      if (!resposta.ok) throw new Error('FALHA_ENVIO');
      setCodigoGerado(novoCodigo);
      setEmailEnviado(true);
    } catch (err) {
      console.error('Erro ao enviar código de confirmação:', err);
      setErroEmail('Não foi possível enviar o e-mail agora. Tente de novo em instantes.');
    } finally {
      setEnviandoEmail(false);
    }
  }

  useEffect(() => {
    enviarCodigo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function confirmarCodigo() {
    if (codigoDigitado.trim() === codigoGerado) {
      setErroEmail('');
      setEtapa('senha');
    } else {
      setErroEmail('Código incorreto. Confira o e-mail e tente de novo.');
    }
  }

  // --- Etapa 2: senha do admin -----------------------------------------------
  const usaSenha = usuarioAuth?.providerData?.some((p) => p.providerId === 'password');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [erroSenha, setErroSenha] = useState('');

  async function confirmarComSenha(e) {
    e.preventDefault();
    setErroSenha('');
    setConfirmando(true);
    try {
      const credencial = EmailAuthProvider.credential(email, senha);
      await reauthenticateWithCredential(auth.currentUser, credencial);
      onConfirmado();
    } catch (err) {
      setErroSenha(mensagemErroReauth(err.code));
    } finally {
      setConfirmando(false);
    }
  }

  async function confirmarComGoogle() {
    setErroSenha('');
    setConfirmando(true);
    try {
      await reauthenticateWithPopup(auth.currentUser, googleProvider);
      onConfirmado();
    } catch (err) {
      const msg = mensagemErroReauth(err.code);
      if (msg) setErroSenha(msg);
    } finally {
      setConfirmando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-coffee-900/40 sm:items-center">
      <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-cream sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-coffee-100 px-5 py-4">
          <h2 className="font-destaque text-lg font-semibold text-coffee-800">{titulo}</h2>
          <button onClick={onFechar} className="text-coffee-400">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="flex items-start gap-2.5 rounded-xl bg-red-50 p-3">
            <ShieldAlert size={18} className="mt-0.5 flex-shrink-0 text-red-600" />
            <p className="text-xs text-red-700">{descricao}</p>
          </div>

          {etapa === 'email' && (
            <div className="text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-coffee-50">
                <Mail size={20} className="text-coffee-600" />
              </div>
              <p className="mt-3 font-destaque text-base font-semibold text-coffee-800">
                Confirme por e-mail
              </p>
              <p className="mt-1 text-sm text-coffee-400">
                {emailEnviado
                  ? <>Enviamos um código de 6 dígitos para <strong>{email}</strong>.</>
                  : 'Enviando código...'}
              </p>

              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={codigoDigitado}
                onChange={(e) => setCodigoDigitado(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="mt-4 w-full rounded-xl border border-coffee-100 bg-cream-card px-3 py-2.5 text-center text-lg tracking-[0.4em] text-coffee-800"
              />

              {erroEmail && <p className="mt-2 text-xs text-red-600">{erroEmail}</p>}

              <button
                onClick={confirmarCodigo}
                disabled={enviandoEmail || codigoDigitado.length !== 6}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-coffee-700 py-2.5 text-sm font-semibold text-cream disabled:opacity-50"
              >
                Confirmar código
              </button>
              <button
                onClick={enviarCodigo}
                disabled={enviandoEmail}
                className="mt-2 flex w-full items-center justify-center gap-1.5 text-xs text-coffee-400 disabled:opacity-50"
              >
                {enviandoEmail && <Loader2 size={12} className="animate-spin" />}
                Reenviar código
              </button>
            </div>
          )}

          {etapa === 'senha' && (
            <div className="text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-coffee-50">
                <Lock size={20} className="text-coffee-600" />
              </div>
              <p className="mt-3 font-destaque text-base font-semibold text-coffee-800">
                Confirme com sua senha
              </p>
              <p className="mt-1 text-sm text-coffee-400">
                Último passo: confirme com a senha da sua conta de admin.
              </p>

              {usaSenha ? (
                <form onSubmit={confirmarComSenha} className="mt-4 space-y-2.5 text-left">
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-coffee-300" />
                    <input
                      type={mostrarSenha ? 'text' : 'password'}
                      required
                      autoFocus
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      placeholder="Sua senha"
                      className="w-full rounded-xl border border-coffee-100 bg-cream-card py-3 pl-10 pr-10 text-sm text-coffee-800 placeholder:text-coffee-300"
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarSenha((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-coffee-300"
                      tabIndex={-1}
                    >
                      {mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  {erroSenha && <p className="text-center text-xs text-red-600">{erroSenha}</p>}

                  <button
                    type="submit"
                    disabled={confirmando}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-700 py-2.5 text-sm font-semibold text-cream disabled:opacity-60"
                  >
                    {confirmando && <Loader2 size={15} className="animate-spin" />}
                    Confirmar e executar
                  </button>
                </form>
              ) : (
                <div className="mt-4 space-y-2.5">
                  {erroSenha && <p className="text-center text-xs text-red-600">{erroSenha}</p>}
                  <button
                    onClick={confirmarComGoogle}
                    disabled={confirmando}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-700 py-2.5 text-sm font-semibold text-cream disabled:opacity-60"
                  >
                    {confirmando && <Loader2 size={15} className="animate-spin" />}
                    Confirmar com o Google e executar
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
