'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import LoadingScreen from '@/components/LoadingScreen';
import Avatar from '@/components/Avatar';
import { createUserProfile, isUsernameAvailable } from '@/lib/firestore-helpers';
import { uploadFotoPerfil } from '@/lib/storage';
import { Camera, Check, X, Loader2 } from 'lucide-react';

export default function OnboardingPage() {
  const router = useRouter();
  const { usuarioAuth, perfil, carregando } = useAuth();

  const [nome, setNome] = useState('');
  const [username, setUsername] = useState('');
  const [statusUsername, setStatusUsername] = useState('vazio'); // vazio | checando | disponivel | indisponivel | invalido
  const [dataNascimento, setDataNascimento] = useState('');
  const [proposito, setProposito] = useState('');
  const [arquivoFoto, setArquivoFoto] = useState(null);
  const [previewFoto, setPreviewFoto] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const timeoutRef = useRef(null);
  const inputFotoRef = useRef(null);

  useEffect(() => {
    if (!carregando && !usuarioAuth) {
      router.replace('/login');
    } else if (!carregando && perfil) {
      router.replace('/feed');
    }
  }, [carregando, usuarioAuth, perfil, router]);

  useEffect(() => {
    if (usuarioAuth?.displayName && !nome) setNome(usuarioAuth.displayName);
  }, [usuarioAuth, nome]);

  const verificarUsername = useCallback((valor) => {
    clearTimeout(timeoutRef.current);
    const limpo = valor.trim().toLowerCase();

    if (!limpo) {
      setStatusUsername('vazio');
      return;
    }
    if (!/^[a-z0-9_.]{3,20}$/.test(limpo)) {
      setStatusUsername('invalido');
      return;
    }

    setStatusUsername('checando');
    timeoutRef.current = setTimeout(async () => {
      try {
        const disponivel = await isUsernameAvailable(limpo);
        setStatusUsername(disponivel ? 'disponivel' : 'indisponivel');
      } catch {
        setStatusUsername('vazio');
      }
    }, 500);
  }, []);

  function handleUsernameChange(valor) {
    setUsername(valor);
    verificarUsername(valor);
  }

  function handleFotoChange(e) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setArquivoFoto(arquivo);
    setPreviewFoto(URL.createObjectURL(arquivo));
  }

  const formValido =
    nome.trim().length >= 2 && statusUsername === 'disponivel' && dataNascimento;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!formValido || salvando) return;
    setErro('');
    setSalvando(true);

    try {
      let fotoURL = usuarioAuth.photoURL || '';
      if (arquivoFoto) {
        try {
          fotoURL = await uploadFotoPerfil(usuarioAuth.uid, arquivoFoto);
        } catch (err) {
          console.error('Falha ao subir foto, seguindo sem foto:', err);
          // Não trava o cadastro por causa da foto — ela pode ser adicionada depois no perfil.
        }
      }

      await createUserProfile(usuarioAuth.uid, {
        nome: nome.trim(),
        username: username.trim(),
        dataNascimento,
        fotoURL,
        proposito: proposito.trim(),
      });

      router.replace('/feed');
    } catch (err) {
      if (err.message === 'USERNAME_INDISPONIVEL') {
        setErro('Esse nome de usuário acabou de ser usado por outra pessoa. Escolha outro.');
        setStatusUsername('indisponivel');
      } else {
        console.error(err);
        setErro('Não foi possível concluir o cadastro. Verifique sua internet e tente de novo.');
      }
    } finally {
      setSalvando(false);
    }
  }

  if (carregando || !usuarioAuth || perfil) return <LoadingScreen />;

  return (
    <div className="min-h-screen bg-cream px-6 py-10">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="font-display text-2xl font-medium text-coffee-800">Quase lá</h1>
        <p className="mt-1 text-sm text-coffee-400">
          Preencha seus dados pra entrar na comunidade G148.
        </p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-5">
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => inputFotoRef.current?.click()}
              className="relative"
            >
              <Avatar src={previewFoto} nome={nome} tamanho="xl" />
              <span className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-cream bg-coffee-700 text-cream">
                <Camera size={15} />
              </span>
            </button>
            <input
              ref={inputFotoRef}
              type="file"
              accept="image/*"
              onChange={handleFotoChange}
              className="hidden"
            />
          </div>

          <Campo label="Nome completo">
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Seu nome"
              required
              className="input"
            />
          </Campo>

          <Campo label="Nome de usuário">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-coffee-300">
                @
              </span>
              <input
                value={username}
                onChange={(e) => handleUsernameChange(e.target.value)}
                placeholder="seunome"
                required
                className="input pl-8 pr-9"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2">
                {statusUsername === 'checando' && (
                  <Loader2 size={16} className="animate-spin text-coffee-300" />
                )}
                {statusUsername === 'disponivel' && <Check size={17} className="text-green-700" />}
                {(statusUsername === 'indisponivel' || statusUsername === 'invalido') && (
                  <X size={17} className="text-red-700" />
                )}
              </span>
            </div>
            {statusUsername === 'invalido' && (
              <p className="mt-1 text-xs text-red-700">
                Use de 3 a 20 letras minúsculas, números, ponto ou underline.
              </p>
            )}
            {statusUsername === 'indisponivel' && (
              <p className="mt-1 text-xs text-red-700">Esse nome de usuário já está em uso.</p>
            )}
          </Campo>

          <Campo label="Data de nascimento">
            <input
              type="date"
              value={dataNascimento}
              onChange={(e) => setDataNascimento(e.target.value)}
              required
              max={new Date().toISOString().slice(0, 10)}
              className="input"
            />
          </Campo>

          <Campo label="Propósito (o que você quer fazer na terra)">
            <textarea
              value={proposito}
              onChange={(e) => setProposito(e.target.value)}
              placeholder="Escreva livremente..."
              rows={3}
              className="input resize-none"
            />
          </Campo>

          {erro && <p className="text-center text-sm text-red-700">{erro}</p>}

          <button
            type="submit"
            disabled={!formValido || salvando}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-coffee-700 py-3.5 text-sm font-semibold text-cream disabled:opacity-40"
          >
            {salvando && <Loader2 size={16} className="animate-spin" />}
            Entrar na comunidade
          </button>
        </form>
      </div>

      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid #e4d3be;
          background-color: #fffdf9;
          padding: 0.875rem 1rem;
          font-size: 0.875rem;
          color: #3f2c1c;
        }
        .input::placeholder {
          color: #cbad8a;
        }
        .input:focus {
          border-color: #8a6644;
        }
      `}</style>
    </div>
  );
}

function Campo({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-coffee-500">{label}</span>
      {children}
    </label>
  );
}
