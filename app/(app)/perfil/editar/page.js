'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import TopBar from '@/components/TopBar';
import Avatar from '@/components/Avatar';
import LoadingScreen from '@/components/LoadingScreen';
import ImageCropper from '@/components/ImageCropper';
import { updateUserProfile } from '@/lib/firestore-helpers';
import { atualizarUsuarioCache } from '@/lib/usersCache';
import { uploadFotoPerfil } from '@/lib/storage';
import { getFuncoesAtivas } from '@/lib/funcoesRepo';
import { Camera, KeyRound, Loader2 } from 'lucide-react';

export default function EditarPerfilPage() {
  const router = useRouter();
  const { perfil } = useAuth();
  const [nome, setNome] = useState(perfil?.nome || '');
  const [proposito, setProposito] = useState(perfil?.proposito || '');
  const [tagFuncao, setTagFuncao] = useState(perfil?.tagFuncao || '');
  const [funcoes, setFuncoes] = useState(null);
  const [arquivoFoto, setArquivoFoto] = useState(null);
  const [previewFoto, setPreviewFoto] = useState('');
  const [srcCorte, setSrcCorte] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const inputFotoRef = useRef(null);

  // CORREÇÃO DE VAZAMENTO: tanto srcCorte (URL bruta pra tela de corte)
  // quanto previewFoto (prévia depois de cortar) são blob: locais que
  // nunca eram revogados — nem trocando de foto, nem cancelando o corte,
  // nem saindo da tela sem salvar. Revoga a anterior sempre que o valor
  // muda e também ao desmontar.
  useEffect(() => {
    return () => {
      if (srcCorte) URL.revokeObjectURL(srcCorte);
    };
  }, [srcCorte]);
  useEffect(() => {
    return () => {
      if (previewFoto) URL.revokeObjectURL(previewFoto);
    };
  }, [previewFoto]);

  // Carrega as funções ativas (lib/funcoesRepo.js) pro seletor. Ninguém
  // pode ficar sem função selecionada — por isso, assim que a lista chega,
  // se por algum motivo o campo ainda estiver vazio (perfil muito antigo,
  // sem tagFuncao gravado), cai na primeira função ativa disponível.
  useEffect(() => {
    getFuncoesAtivas().then((lista) => {
      setFuncoes(lista);
      setTagFuncao((atual) => atual || lista[0]?.nome || '');
    });
  }, []);

  if (!perfil) return <LoadingScreen />;

  function handleFotoChange(e) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setSrcCorte(URL.createObjectURL(arquivo));
  }

  function handleCortado(blob) {
    setSrcCorte('');
    const file = new File([blob], 'perfil.jpg', { type: 'image/jpeg' });
    setArquivoFoto(file);
    setPreviewFoto(URL.createObjectURL(blob));
  }

  async function handleSalvar() {
    if (salvando) return;
    setSalvando(true);
    setErro('');
    try {
      const dados = {
        nome: nome.trim(),
        proposito: proposito.trim(),
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

  // Tela de corte 1:1 sobrepõe tudo
  if (srcCorte) {
    return (
      <ImageCropper
        src={srcCorte}
        razao={{ w: 1, h: 1 }}
        onConfirmar={handleCortado}
        onCancelar={() => setSrcCorte('')}
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <TopBar titulo="Editar perfil" voltarPara="/perfil" />

      <div className="space-y-5 px-5 py-5">
        <div className="flex justify-center">
          <button type="button" onClick={() => inputFotoRef.current?.click()} className="relative">
            {/* Foto maior na tela de edição */}
            <Avatar src={previewFoto || perfil.fotoURL} nome={nome} tamanho={88} />
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
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            maxLength={28}
            className="input"
          />
          <p className="mt-1 text-[11px] text-coffee-300">
            Aparece em 1 linha só no perfil — se o nome completo não couber, ele é cortado
            (ex.: &quot;Maria Eduarda Nascimento…&quot;). Se preferir, abrevie aqui mesmo.
          </p>
        </Campo>

        <Campo label="Propósito">
          <textarea
            value={proposito}
            onChange={(e) => setProposito(e.target.value)}
            rows={2}
            className="input resize-none"
          />
        </Campo>

        <Campo label="Função na comunidade">
          <select
            value={tagFuncao}
            onChange={(e) => setTagFuncao(e.target.value)}
            className="input"
          >
            {/* Se a função atual não estiver mais na lista ativa (foi
                desativada/apagada no Admin), mostra ela mesmo assim como
                opção — assim a pessoa nunca fica sem seleção nenhuma; basta
                trocar pra uma das ativas quando quiser. */}
            {tagFuncao && !funcoes?.some((f) => f.nome === tagFuncao) && (
              <option value={tagFuncao}>{tagFuncao}</option>
            )}
            {funcoes?.map((f) => (
              <option key={f.id} value={f.nome}>
                {f.nome}
              </option>
            ))}
          </select>
        </Campo>

        {erro && <p className="text-sm text-red-700">{erro}</p>}

        <button
          onClick={handleSalvar}
          disabled={salvando || !nome.trim() || !tagFuncao}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-coffee-700 py-3.5 text-sm font-semibold text-cream disabled:opacity-40"
        >
          {salvando && <Loader2 size={16} className="animate-spin" />}
          Salvar alterações
        </button>

        {/* CORREÇÃO: alterar o PIN agora só é possível pelo fluxo "Esqueci
            meu PIN" (código por e-mail) — este link não pula mais direto
            pra trocar o PIN sem confirmação nenhuma. */}
        <Link
          href="/carteira?modo=recuperar_solicitar"
          className="flex items-center gap-3 rounded-xl border border-coffee-100 px-4 py-3 text-sm font-medium text-coffee-600"
        >
          <KeyRound size={16} className="text-coffee-500" />
          Alterar PIN da Carteira
        </Link>

        <Link
          href="/perfil/notificacoes"
          className="block rounded-xl border border-coffee-100 px-4 py-3 text-center text-sm font-medium text-coffee-600"
        >
          Notificações
        </Link>

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
