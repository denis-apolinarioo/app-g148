'use client';

// ============================================================================
// Item 10 do Bloco 4 — pede e-mail e senha toda vez que a pessoa entra na
// área Admin, mesmo já estando logada no app com uma conta isAdmin=true.
// ----------------------------------------------------------------------------
// Não guarda "confirmado" em lugar nenhum (nem sessionStorage) de propósito:
// o estado `desbloqueado` vive só no state do AdminPage, que é recriado toda
// vez que a pessoa entra em /admin — ou seja, sair da tela e voltar já pede
// de novo, como pedido.
//
// Reautentica contra a PRÓPRIA conta Firebase já logada (reauthenticate),
// não é um login novo nem um usuário/senha separado — segurança de verdade,
// e não exige nenhuma configuração extra no Firebase Console.
//
// Cobre os dois jeitos de login que o app aceita (ver app/login/page.js):
// quem entrou com e-mail/senha confirma com e-mail/senha; quem entrou só
// com Google (sem senha cadastrada) confirma com o próprio Google.
// ============================================================================

import { useState } from 'react';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
} from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { Lock, Mail, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';

function mensagemErro(codigo) {
  const mapa = {
    'auth/wrong-password': 'Senha incorreta.',
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/invalid-email': 'E-mail inválido.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde um instante e tente de novo.',
    'auth/popup-closed-by-user': '',
    'auth/user-mismatch': 'Essa confirmação precisa ser feita com a mesma conta que está logada no app.',
  };
  return mapa[codigo] ?? 'Não foi possível confirmar. Tente novamente.';
}

export default function AdminLoginGate({ usuarioAuth, onDesbloqueado }) {
  const usaSenha = usuarioAuth?.providerData?.some((p) => p.providerId === 'password');
  const [email, setEmail] = useState(usuarioAuth?.email || '');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  async function confirmarComSenha(e) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      const credencial = EmailAuthProvider.credential(email, senha);
      await reauthenticateWithCredential(auth.currentUser, credencial);
      onDesbloqueado();
    } catch (err) {
      setErro(mensagemErro(err.code));
    } finally {
      setEnviando(false);
    }
  }

  async function confirmarComGoogle() {
    setErro('');
    setEnviando(true);
    try {
      await reauthenticateWithPopup(auth.currentUser, googleProvider);
      onDesbloqueado();
    } catch (err) {
      const msg = mensagemErro(err.code);
      if (msg) setErro(msg);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[65vh] max-w-md flex-col items-center justify-center px-6">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-forte">
        <ShieldCheck size={26} className="text-cream" />
      </div>
      <h1 className="font-destaque text-lg font-semibold text-coffee-800">Confirme que é você</h1>
      <p className="mt-1 text-center text-sm text-coffee-400">
        Por segurança, confirme seu e-mail e senha toda vez que entrar no Painel Admin.
      </p>

      {usaSenha ? (
        <form onSubmit={confirmarComSenha} className="mt-6 w-full space-y-3">
          <div className="relative">
            <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-coffee-300" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Seu e-mail"
              className="w-full rounded-xl border border-coffee-100 bg-cream-card py-3.5 pl-11 pr-4 text-sm text-coffee-800 placeholder:text-coffee-300 focus:border-coffee-400"
            />
          </div>

          <div className="relative">
            <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-coffee-300" />
            <input
              type={mostrarSenha ? 'text' : 'password'}
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Sua senha"
              autoFocus
              className="w-full rounded-xl border border-coffee-100 bg-cream-card py-3.5 pl-11 pr-11 text-sm text-coffee-800 placeholder:text-coffee-300 focus:border-coffee-400"
            />
            <button
              type="button"
              onClick={() => setMostrarSenha((v) => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-coffee-300"
              aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
              tabIndex={-1}
            >
              {mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {erro && <p className="text-center text-sm text-red-700">{erro}</p>}

          <button
            type="submit"
            disabled={enviando}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-forte py-3.5 text-sm font-semibold text-cream disabled:opacity-60"
          >
            {enviando && <Loader2 size={16} className="animate-spin" />}
            Entrar no Painel Admin
          </button>
        </form>
      ) : (
        <div className="mt-6 w-full space-y-3">
          {erro && <p className="text-center text-sm text-red-700">{erro}</p>}
          <button
            onClick={confirmarComGoogle}
            disabled={enviando}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-forte py-3.5 text-sm font-semibold text-cream disabled:opacity-60"
          >
            {enviando && <Loader2 size={16} className="animate-spin" />}
            Confirmar com o Google
          </button>
        </div>
      )}
    </div>
  );
}
