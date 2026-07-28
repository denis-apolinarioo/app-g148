'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import TopBar from '@/components/TopBar';
import Avatar from '@/components/Avatar';
import LoadingScreen from '@/components/LoadingScreen';
import { updateUserProfile } from '@/lib/firestore-helpers';
import { atualizarUsuarioCache } from '@/lib/usersCache';
import { uploadFotoPerfil } from '@/lib/storage';
import { TAGS_FUNCAO } from '@/lib/constants';
import { Camera, Loader2 } from 'lucide-react';

export default function EditarPerfilPage() {
  const router = useRouter();
  const { perfil } = useAuth();
  const [nome, setNome] = useState(perfil?.nome || '');
  const [bio, setBio] = useState(perfil?.bio || '');
  const [proposito, setProposito] = useState(perfil?.proposito || '');
  const [musicaFavorita, setMusicaFavorita] = useState(perfil?.musicaFavorita || '');
  const [tagFuncao, setTagFuncao] = useState(perfil?.tagFuncao || 'Membro');
  const [arquivoFoto, setArquivoFoto] = useState(null);
  const [previewFoto, setPreviewFoto] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const inputFotoRef = useRef(null);

  if (!perfil) return <LoadingScreen />;

  function handleFotoChange(e) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setArquivoFoto(arquivo);
    setPreviewFoto(URL.createObjectURL(arquivo));
  }

  async function handleSalvar() {
    if (salvando) return;
    setSalvando(true);
    setErro('');
    try {
      const dados = {
        nome: nome.trim(),
        bio: bio.trim(),
        proposito: proposito.trim(),
        musicaFavorita: musicaFavorita.trim(),
        tagFuncao,
      };
      if (arquivoFoto) {
        dados.fotoURL = await uploadFotoPerfil(perfil.uid, arquivoFoto);
      }
      await updateUserProfile(perfil.uid, dados);
      atualizarUsuarioCache(perfil.uid, {
        nome: dados.nome,
        fotoURL: dados.fotoURL || perfil.fotoURL,
        username: perfil.username,
      });
      router.push('/perfil');
    } catch (err) {
      console.error('Erro ao salvar perfil:', err);
      setErro('Não foi possível salvar. Verifique sua internet e tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <TopBar titulo="Editar perfil" voltarPara="/perfil" />

      <div className="space-y-5 px-5 py-5">
        <div className="flex justify-center">
          <button type="button" onClick={() => inputFotoRef.current?.click()} className="relative">
            <Avatar src={previewFoto || perfil.fotoURL} nome={nome} tamanho="xl" />
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

        <Campo label="Nome">
          <input value={nome} onChange={(e) => setNome(e.target.value)} className="input" />
        </Campo>

        <Campo label="Bio">
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={2}
            className="input resize-none"
            placeholder="Fale um pouco sobre você"
          />
        </Campo>

        <Campo label="Propósito">
          <textarea
            value={proposito}
            onChange={(e) => setProposito(e.target.value)}
            rows={2}
            className="input resize-none"
          />
        </Campo>

        <Campo label="Música favorita">
          <input
            value={musicaFavorita}
            onChange={(e) => setMusicaFavorita(e.target.value)}
            className="input"
            placeholder="Nome da música e artista"
          />
        </Campo>

        <Campo label="Função na comunidade">
          <select value={tagFuncao} onChange={(e) => setTagFuncao(e.target.value)} className="input">
            {TAGS_FUNCAO.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Campo>

        {erro && <p className="text-sm text-red-700">{erro}</p>}

        <button
          onClick={handleSalvar}
          disabled={salvando || !nome.trim()}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-coffee-700 py-3.5 text-sm font-semibold text-cream disabled:opacity-40"
        >
          {salvando && <Loader2 size={16} className="animate-spin" />}
          Salvar alterações
        </button>

        <Link
          href="/termos"
          className="block pt-1 text-center text-xs text-coffee-300 underline underline-offset-2"
        >
          Termos de Uso e Política de Privacidade
        </Link>
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
