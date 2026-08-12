'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import * as Icons from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import TopBar from '@/components/TopBar';
import Avatar from '@/components/Avatar';
import LoadingScreen from '@/components/LoadingScreen';
import ImageCropper from '@/components/ImageCropper';
import ConfirmarAcaoModal from '@/components/ConfirmarAcaoModal';
import ConfirmarResetModal from '@/components/ConfirmarResetModal';
import { useConfirm } from '@/components/ConfirmProvider';
import { auth } from '@/lib/firebase';
import { updateUserProfile } from '@/lib/firestore-helpers';
import { atualizarUsuarioCache } from '@/lib/usersCache';
import { uploadFotoPerfil } from '@/lib/storage';
import { getFuncoesAtivas } from '@/lib/funcoesRepo';
import { excluirConta } from '@/lib/excluirContaRepo';
import { limparTokenAoSair } from '@/lib/push';
import { usePresetAtivo } from '@/lib/theme';
import { iconePascalCase } from '@/lib/missionIcons';
import { Camera, Loader2, UserX, Palette, ChevronRight, X, Check, LogOut } from 'lucide-react';

export default function EditarPerfilPage() {
  const router = useRouter();
  const { perfil } = useAuth();
  const confirmar = useConfirm();
  const { presetAtivoId, presetsDisponiveis, trocarPreset } = usePresetAtivo();
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

  // Item novo — seletor de tema (antes ficava no cabeçalho do Perfil, ver
  // comentário em app/(app)/perfil/page.js) e botão de sair, os dois
  // movidos pra dentro de Editar perfil, que virou a tela de "Config" de
  // fato. `usePresetAtivo` pode ser chamado de qualquer tela (cada
  // instância monta sua própria escuta em tempo real) — a reconciliação
  // do preset (aplicar o padrão do Admin, validar cache) já roda sempre,
  // de qualquer forma, em app/(app)/layout.js; esta aqui é só pra
  // alimentar o seletor abaixo.
  const [temaAberto, setTemaAberto] = useState(false);
  const presetAtual = presetsDisponiveis?.find((p) => p.id === presetAtivoId);
  const IconePresetAtual = presetAtual?.icone ? Icons[iconePascalCase(presetAtual.icone)] : null;

  async function handleSair() {
    const ok = await confirmar({ titulo: 'Sair da sua conta?', labelConfirmar: 'Sair' });
    if (ok) {
      // Item 25 do Bloco 10 — remove o token de push deste aparelho ANTES
      // de sair, senão quem ficar logado em outra conta nesse mesmo
      // navegador continuaria recebendo pushes da conta anterior.
      await limparTokenAoSair();
      await signOut(auth);
    }
  }

  // Exclusão de conta (LGPD) — ver comentário grande na Cloud Function
  // excluirConta (functions/index.js) pro que exatamente é apagado/
  // anonimizado. Três camadas antes de chamar a function de verdade: (1)
  // botão abre um aviso do que vai acontecer (ConfirmarAcaoModal); (2) ao
  // confirmar o aviso, abre ConfirmarResetModal — mesmo componente usado no
  // reset em massa do Admin (AbaConfiguracoes.js) — que pede o código de
  // 6 dígitos por e-mail (igual à recuperação de PIN da Carteira, ver
  // carteira/page.js) e, na sequência, a senha (ou Google) da própria
  // conta; (3) só depois de tudo isso é que handleExcluirConta chama a
  // Cloud Function de verdade.
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [autenticandoExclusao, setAutenticandoExclusao] = useState(false);
  const [excluindoConta, setExcluindoConta] = useState(false);
  const [erroExclusao, setErroExclusao] = useState('');

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

  // Exclusão de conta (LGPD). A Cloud Function faz tudo do lado do
  // servidor (ver excluirConta em functions/index.js); aqui só chamamos e,
  // se der certo, deslogamos — a sessão local já não vale mais nada depois
  // que a conta some do Firebase Auth, então signOut é só pra limpar o
  // estado do app e mandar pra tela de login.
  async function handleExcluirConta() {
    if (excluindoConta) return;
    setExcluindoConta(true);
    setErroExclusao('');
    try {
      await excluirConta();
      await signOut(auth);
      router.push('/login');
    } catch (err) {
      console.error('Erro ao excluir conta:', err);
      // Mesma correção do Admin: mostra a mensagem real da Cloud Function
      // (etapa que falhou) em vez de sempre um texto genérico, que escondia
      // qualquer detalhe útil sobre o que realmente deu errado.
      const detalhe = err && typeof err.message === 'string' ? err.message.trim() : '';
      setErroExclusao(
        detalhe && detalhe.toLowerCase() !== 'internal'
          ? detalhe
          : 'Não foi possível excluir agora. Verifique sua internet e tente de novo.'
      );
      setExcluindoConta(false);
      setAutenticandoExclusao(false);
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
            <span className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-cream bg-forte text-texto-forte">
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
            Aparece em 1 linha só no perfil — nomes longos são cortados.
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
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-forte py-3.5 text-sm font-semibold text-texto-forte disabled:opacity-40"
        >
          {salvando && <Loader2 size={16} className="animate-spin" />}
          Salvar alterações
        </button>

        <Link
          href="/perfil/notificacoes"
          className="block rounded-xl border border-coffee-100 px-4 py-3 text-center text-sm font-medium text-coffee-600"
        >
          Notificações
        </Link>

        {/* Item novo — seletor de tema, migrado do cabeçalho do Perfil pra
            cá (mesmo espírito de "config" da Notificações acima). Abre uma
            folha inferior com os presets ATIVOS (aba Estética do Admin),
            cada um com o próprio ícone — mesma fonte de dados que já
            alimentava o botão antigo (usePresetAtivo), só a apresentação
            mudou de dropdown ancorado pra folha inferior, mais adequada
            numa lista de configurações do que num ícone isolado. */}
        <button
          type="button"
          onClick={() => setTemaAberto(true)}
          className="flex w-full items-center justify-between rounded-xl border border-coffee-100 px-4 py-3 text-sm font-medium text-coffee-600"
        >
          <span className="flex items-center gap-2">
            {IconePresetAtual ? (
              <IconePresetAtual size={16} className="text-coffee-400" />
            ) : (
              <Palette size={16} className="text-coffee-400" />
            )}
            Tema do app
          </span>
          <span className="flex items-center gap-1 text-coffee-400">
            {presetAtual?.nome || 'Claro'}
            <ChevronRight size={14} />
          </span>
        </button>

        {/* Item novo — botão de sair, migrado do cabeçalho do Perfil pra
            cá. Mesma lógica de sempre (limpa o token de push antes de
            deslogar), só a localização mudou. */}
        <button
          type="button"
          onClick={handleSair}
          className="flex w-full items-center gap-2 rounded-xl border border-coffee-100 px-4 py-3 text-sm font-medium text-coffee-600"
        >
          <LogOut size={16} className="text-coffee-400" />
          Sair da conta
        </button>

        <Link
          href="/termos"
          className="block pt-1 text-center text-xs text-coffee-300 underline underline-offset-2"
        >
          Termos de Uso e Política de Privacidade
        </Link>

        {/* Exclusão de conta (LGPD) — separado do resto por espaço e cor,
            pra não ficar perto de ações do dia a dia por engano. */}
        <button
          type="button"
          onClick={() => setConfirmandoExclusao(true)}
          className="flex w-full items-center justify-center gap-2 pt-3 text-center text-xs font-medium text-red-700/80"
        >
          <UserX size={14} />
          Excluir minha conta
        </button>
        {erroExclusao && (
          <p className="text-center text-xs text-red-700">{erroExclusao}</p>
        )}
      </div>

      {confirmandoExclusao && (
        <ConfirmarAcaoModal
          titulo="Excluir sua conta?"
          mensagem='Seu perfil, carteira e conquistas somem de vez. Seus posts, comentários e pedidos de oração continuam no app, mas aparecem como "Usuário removido". Essa ação não pode ser desfeita e você será desconectado(a) na hora.'
          textoConfirmar="Continuar"
          onFechar={() => setConfirmandoExclusao(false)}
          onConfirmar={() => {
            setConfirmandoExclusao(false);
            setAutenticandoExclusao(true);
          }}
        />
      )}

      {/* Última camada: mesmo código por e-mail usado na recuperação do PIN
          da Carteira, seguido da senha (ou Google) da própria conta — só
          depois disso handleExcluirConta chama a Cloud Function de verdade. */}
      {autenticandoExclusao && (
        <ConfirmarResetModal
          acao="excluir_conta"
          titulo="Excluir sua conta"
          descricao="Última etapa: confirme o código enviado por e-mail e depois sua senha pra excluir sua conta de vez. Essa ação não pode ser desfeita."
          onFechar={() => !excluindoConta && setAutenticandoExclusao(false)}
          onConfirmado={handleExcluirConta}
        />
      )}

      {/* Folha inferior do seletor de tema (ver botão "Tema do app" acima). */}
      {temaAberto && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-forte-900/40 sm:items-center"
          onClick={() => setTemaAberto(false)}
        >
          <div
            className="max-h-[70vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-cream sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-coffee-100 px-5 py-4">
              <h3 className="font-destaque text-base font-semibold text-coffee-800">Tema do app</h3>
              <button onClick={() => setTemaAberto(false)} className="text-coffee-400">
                <X size={20} />
              </button>
            </div>
            <div className="p-2">
              {!presetsDisponiveis ? (
                <div className="h-24 animate-pulse rounded-xl bg-coffee-100/60" />
              ) : (
                presetsDisponiveis.map((preset) => {
                  const IconePreset = preset.icone ? Icons[iconePascalCase(preset.icone)] : null;
                  const selecionado = preset.id === presetAtivoId;
                  return (
                    <button
                      key={preset.id}
                      onClick={() => {
                        trocarPreset(preset.id);
                        setTemaAberto(false);
                      }}
                      className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left text-sm ${
                        selecionado ? 'bg-coffee-50 font-semibold text-coffee-800' : 'text-coffee-600'
                      }`}
                    >
                      {IconePreset ? (
                        <IconePreset size={18} className={selecionado ? 'text-coffee-800' : 'text-coffee-400'} />
                      ) : (
                        <Palette size={18} className="text-coffee-400" />
                      )}
                      {preset.nome}
                      {selecionado && <Check size={16} className="ml-auto text-coffee-800" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid rgb(var(--cor-coffee-100));
          background-color: rgb(var(--cor-cream-card));
          padding: 0.875rem 1rem;
          font-size: 0.875rem;
          color: rgb(var(--cor-coffee-700));
        }
        .input:focus {
          border-color: rgb(var(--cor-coffee-400));
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
