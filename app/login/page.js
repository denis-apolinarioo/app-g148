'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
} from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import LoadingScreen from '@/components/LoadingScreen';
import { Mail, Lock, Loader2, Eye, EyeOff, MailCheck } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { usuarioAuth, carregando } = useAuth();
  const [modo, setModo] = useState('entrar'); // 'entrar' | 'criar'
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [avisoVerificacao, setAvisoVerificacao] = useState(false);

  useEffect(() => {
    if (!carregando && usuarioAuth) {
      router.replace('/');
    }
  }, [carregando, usuarioAuth, router]);

  if (carregando) return <LoadingScreen />;

  function mensagemErro(codigo) {
    const mapa = {
      'auth/invalid-email': 'E-mail inválido.',
      'auth/user-not-found': 'Não encontramos conta com esse e-mail.',
      'auth/wrong-password': 'Senha incorreta.',
      'auth/invalid-credential': 'E-mail ou senha incorretos.',
      'auth/email-already-in-use': 'Esse e-mail já tem conta. Tente entrar em vez de criar.',
      'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
      'auth/popup-closed-by-user': '',
    };
    return mapa[codigo] ?? 'Algo deu errado. Tente novamente em instantes.';
  }

  async function entrarComGoogle() {
    setErro('');
    setEnviando(true);
    try {
      await signInWithPopup(auth, googleProvider);
      router.replace('/');
    } catch (err) {
      const msg = mensagemErro(err.code);
      if (msg) setErro(msg);
    } finally {
      setEnviando(false);
    }
  }

  async function handleSubmitEmail(e) {
    e.preventDefault();
    setErro('');
    setAvisoVerificacao(false);

    // Melhoria: confirmar senha no cadastro, pra evitar erro de digitação
    // silencioso que só a pessoa descobre no próximo login.
    if (modo === 'criar' && senha !== confirmarSenha) {
      setErro('As senhas não coincidem. Confira e tente de novo.');
      return;
    }

    setEnviando(true);
    try {
      if (modo === 'criar') {
        const cred = await createUserWithEmailAndPassword(auth, email, senha);
        await sendEmailVerification(cred.user);
        setAvisoVerificacao(true);
      } else {
        await signInWithEmailAndPassword(auth, email, senha);
        router.replace('/');
      }
    } catch (err) {
      setErro(mensagemErro(err.code));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col justify-center bg-cream px-6 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-forte font-display text-2xl font-semibold text-cream">
            G148
          </div>
          <h1 className="font-destaque text-2xl font-semibold text-coffee-800">Geração 148</h1>
          <p className="mt-1 text-sm text-coffee-400">
            &ldquo;Quer vivamos, quer morramos, pertencemos ao Senhor.&rdquo; — Romanos 14:8
          </p>
        </div>

        {avisoVerificacao ? (
          // MELHORIA: aviso de verificação de e-mail bem mais visível —
          // antes era um card discreto, fácil de ignorar sem perceber que
          // era uma etapa obrigatória.
          <div className="rounded-xl2 border-2 border-gold/40 bg-cream-card p-6 text-center shadow-card">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gold/15">
              <MailCheck size={26} className="text-gold" />
            </div>
            <p className="font-display text-lg font-medium text-coffee-800">
              Confirme seu e-mail pra continuar
            </p>
            <p className="mt-2 text-sm leading-relaxed text-coffee-500">
              Enviamos um link de confirmação para <strong>{email}</strong>. Você{' '}
              <strong>precisa clicar nesse link</strong> antes de conseguir entrar no app.
              Confira também a caixa de spam.
            </p>
            <button
              onClick={() => {
                setAvisoVerificacao(false);
                setModo('entrar');
              }}
              className="mt-5 w-full rounded-xl bg-forte py-3 text-sm font-semibold text-cream"
            >
              Já confirmei, ir para o login
            </button>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmitEmail} className="space-y-3">
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
                  minLength={6}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="Sua senha"
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

              {/* MELHORIA: campo de confirmar senha, só aparece no cadastro */}
              {modo === 'criar' && (
                <div className="relative">
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-coffee-300" />
                  <input
                    type={mostrarSenha ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    placeholder="Confirme sua senha"
                    className="w-full rounded-xl border border-coffee-100 bg-cream-card py-3.5 pl-11 pr-4 text-sm text-coffee-800 placeholder:text-coffee-300 focus:border-coffee-400"
                  />
                </div>
              )}

              {erro && <p className="text-center text-sm text-red-700">{erro}</p>}

              <button
                type="submit"
                disabled={enviando}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-forte py-3.5 text-sm font-semibold text-cream disabled:opacity-60"
              >
                {enviando && <Loader2 size={16} className="animate-spin" />}
                {modo === 'criar' ? 'Criar conta' : 'Entrar'}
              </button>
            </form>

            <button
              onClick={entrarComGoogle}
              disabled={enviando}
              className="mt-3 flex w-full items-center justify-center gap-2.5 rounded-xl border border-coffee-100 bg-cream-card py-3.5 text-sm font-semibold text-coffee-700 disabled:opacity-60"
            >
              <GoogleIcon />
              Continuar com Google
            </button>

            <p className="mt-6 text-center text-sm text-coffee-400">
              {modo === 'entrar' ? (
                <>
                  Ainda não tem conta?{' '}
                  <button
                    onClick={() => {
                      setModo('criar');
                      setErro('');
                    }}
                    className="font-semibold text-coffee-700 underline"
                  >
                    Criar agora
                  </button>
                </>
              ) : (
                <>
                  Já tem conta?{' '}
                  <button
                    onClick={() => {
                      setModo('entrar');
                      setErro('');
                    }}
                    className="font-semibold text-coffee-700 underline"
                  >
                    Entrar
                  </button>
                </>
              )}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.16.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03l2.99-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58z"
      />
    </svg>
  );
}
