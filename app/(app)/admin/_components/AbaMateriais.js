'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  GripVertical,
  X,
  Box,
  Image as ImageIcon,
  FileText,
  Link as LinkIcon,
} from 'lucide-react';
import {
  getTodosOsMateriais,
  criarMaterial,
  atualizarMaterial,
  apagarMaterial,
  trocarOrdem,
  reordenarMateriais,
} from '@/lib/materiaisRepo';
import {
  uploadCapaMaterial,
  uploadConteudoImagemMaterial,
  uploadConteudoPdfMaterial,
} from '@/lib/storage';
import { useAuth } from '@/components/AuthProvider';
import { useConfirm } from '@/components/ConfirmProvider';
import ImageCropper from '@/components/ImageCropper';
import { useArrastarReordenar } from './useArrastarReordenar';

// Item novo — aba Materiais. Pedido do Denis: a "caixa" de Materiais no
// Perfil (ícone de caixa no topo) substitui a ideia antiga de 7 links
// fixos (Bíblia, Spotify, Drive do livro do bimestre, Lição da Escola
// Sabatina, Curiosidades do YouTube, calendário de eventos, Materiais de
// estudo) — cada um deles entra aqui como um material do tipo "link",
// junto com quantos outros o Admin quiser (imagem ou PDF também), sem
// ficar travado em 7.
const TIPOS_MATERIAL = [
  { valor: 'link', label: 'Link (abre numa aba nova)', icone: LinkIcon },
  { valor: 'imagem', label: 'Imagem (abre em tela cheia)', icone: ImageIcon },
  { valor: 'pdf', label: 'PDF (abre numa aba nova)', icone: FileText },
];

function Campo({ label, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-coffee-500">{label}</label>
      {children}
    </div>
  );
}

export default function AbaMateriais() {
  const { perfil } = useAuth();
  const confirmar = useConfirm();
  const [materiais, setMateriais] = useState(null);
  const [materialEditando, setMaterialEditando] = useState(null); // objeto = editar, 'novo' = criar
  const [apagando, setApagando] = useState(null);

  const carregar = useCallback(() => {
    getTodosOsMateriais().then(setMateriais);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function handleApagar(material) {
    const ok = await confirmar({
      titulo: `Apagar o material "${material.nome}"?`,
      descricao: 'Some da caixa de Materiais de todo mundo. Não dá pra desfazer.',
      perigo: true,
      labelConfirmar: 'Apagar',
    });
    if (!ok) return;
    setApagando(material.id);
    try {
      await apagarMaterial(material.id, perfil, material.nome);
      carregar();
    } catch (err) {
      console.error('Erro ao apagar material:', err);
    } finally {
      setApagando(null);
    }
  }

  const { itensVisuais: materiaisArrastaveis, propsDoItem, propsDaAlca } = useArrastarReordenar(
    materiais || [],
    (novaOrdem) => reordenarMateriais(novaOrdem).then(carregar)
  );

  async function handleMover(index, direcao) {
    const alvo = index + direcao;
    if (!materiaisArrastaveis || alvo < 0 || alvo >= materiaisArrastaveis.length) return;
    try {
      await trocarOrdem(materiaisArrastaveis[index], materiaisArrastaveis[alvo]);
      carregar();
    } catch (err) {
      console.error('Erro ao reordenar material:', err);
    }
  }

  if (!materiais) return <div className="h-40 animate-pulse rounded-xl2 bg-coffee-100/60" />;

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="font-destaque text-sm font-semibold text-coffee-700">Materiais</h3>
          <button
            onClick={() => setMaterialEditando('novo')}
            className="flex items-center gap-1 text-xs font-semibold text-coffee-600"
          >
            <Plus size={13} /> Novo
          </button>
        </div>
        <p className="mb-2 text-[11px] text-coffee-300">
          Aparecem na caixa de Materiais do Perfil (ícone de caixa no topo).
        </p>

        {materiais.length === 0 && (
          <p className="text-xs text-coffee-300">Nenhum material cadastrado ainda.</p>
        )}

        <div className="space-y-2">
          {materiaisArrastaveis.map((material, index) => {
            const tipoInfo = TIPOS_MATERIAL.find((t) => t.valor === material.tipo);
            const IconeTipo = tipoInfo?.icone || LinkIcon;
            return (
              <div
                key={material.id}
                {...propsDoItem(index)}
                className={`flex items-center gap-1.5 rounded-xl border border-coffee-100 bg-cream-card px-3.5 py-2.5 ${
                  material.ativo === false ? 'opacity-50' : ''
                }`}
              >
                <span
                  {...propsDaAlca(index)}
                  className="flex-shrink-0 cursor-grab touch-none text-coffee-200 active:cursor-grabbing"
                  aria-label="Arrastar para reordenar"
                >
                  <GripVertical size={15} />
                </span>
                <div className="flex flex-shrink-0 flex-col">
                  <button
                    onClick={() => handleMover(index, -1)}
                    disabled={index === 0}
                    className="text-coffee-300 disabled:opacity-20"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    onClick={() => handleMover(index, 1)}
                    disabled={index === materiaisArrastaveis.length - 1}
                    className="text-coffee-300 disabled:opacity-20"
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>

                <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-coffee-50">
                  {material.capaURL ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={material.capaURL} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Box size={16} className="text-coffee-200" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-coffee-800">
                    {material.nome}
                    {material.ativo === false && (
                      <span className="ml-1.5 text-[10px] font-medium text-coffee-400">(inativo)</span>
                    )}
                  </p>
                  <p className="flex items-center gap-1 truncate text-xs text-coffee-400">
                    <IconeTipo size={11} />
                    {tipoInfo?.label.split(' (')[0] || material.tipo}
                  </p>
                </div>

                <button
                  onClick={() => setMaterialEditando(material)}
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-coffee-200 text-coffee-600"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => handleApagar(material)}
                  disabled={apagando === material.id}
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-coffee-200 text-red-600 disabled:opacity-40"
                >
                  {apagando === material.id ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Trash2 size={13} />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {materialEditando && (
        <MaterialFormModal
          materialInicial={materialEditando === 'novo' ? null : materialEditando}
          onFechar={() => setMaterialEditando(null)}
          onSalvo={() => {
            setMaterialEditando(null);
            carregar();
          }}
        />
      )}
    </div>
  );
}

function MaterialFormModal({ materialInicial, onFechar, onSalvo }) {
  const { perfil } = useAuth();
  const editando = !!materialInicial;

  const [nome, setNome] = useState(materialInicial?.nome || '');
  const [tipo, setTipo] = useState(materialInicial?.tipo || 'link');
  const [linkURL, setLinkURL] = useState(
    materialInicial?.tipo === 'link' ? materialInicial?.conteudoURL || '' : ''
  );
  const [ativo, setAtivo] = useState(materialInicial?.ativo ?? true);

  const [previewCapa, setPreviewCapa] = useState(materialInicial?.capaURL || '');
  const [arquivoCapa, setArquivoCapa] = useState(null);
  const [srcCorte, setSrcCorte] = useState('');

  // Arquivo do CONTEÚDO (imagem cheia ou PDF, conforme `tipo`) — nunca os
  // dois ao mesmo tempo, por isso um estado só serve pros dois casos.
  const [arquivoConteudo, setArquivoConteudo] = useState(null);
  const [nomeArquivoConteudo, setNomeArquivoConteudo] = useState('');

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    return () => {
      if (srcCorte) URL.revokeObjectURL(srcCorte);
    };
  }, [srcCorte]);
  useEffect(() => {
    return () => {
      if (arquivoCapa && previewCapa) URL.revokeObjectURL(previewCapa);
    };
  }, [arquivoCapa, previewCapa]);

  function handleEscolherCapa(e) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setSrcCorte(URL.createObjectURL(arquivo));
    e.target.value = '';
  }

  function handleCapaCortada(blob) {
    setSrcCorte('');
    const file = new File([blob], 'capa.jpg', { type: 'image/jpeg' });
    setArquivoCapa(file);
    setPreviewCapa(URL.createObjectURL(blob));
  }

  function handleEscolherConteudo(e) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setArquivoConteudo(arquivo);
    setNomeArquivoConteudo(arquivo.name);
    e.target.value = '';
  }

  // Trocar o tipo descarta um arquivo de conteúdo já escolhido pro tipo
  // anterior — sem isso, dava pra selecionar uma imagem com `tipo` ainda
  // em "Imagem", trocar pra "PDF" sem escolher um PDF de verdade, e subir
  // aquele arquivo de imagem só que com contentType 'application/pdf'
  // (um "PDF" que na prática não abre em lugar nenhum).
  function handleMudarTipo(novoTipo) {
    setTipo(novoTipo);
    setArquivoConteudo(null);
    setNomeArquivoConteudo('');
  }

  async function handleSalvar() {
    if (!nome.trim() || salvando) return;
    if (!editando && !arquivoCapa) {
      setErro('Escolha uma imagem de capa.');
      return;
    }
    if (tipo === 'link' && !linkURL.trim()) {
      setErro('Cole o link do material.');
      return;
    }
    // Precisa de um arquivo novo quando: é material novo (nunca teve
    // conteúdo) OU o tipo mudou em relação ao que já estava salvo (o
    // conteúdo antigo não serve mais — era link/imagem/pdf diferente).
    const tipoMudou = editando && materialInicial?.tipo !== tipo;
    if (tipo !== 'link' && (!editando || tipoMudou) && !arquivoConteudo) {
      setErro(tipo === 'pdf' ? 'Escolha o arquivo PDF.' : 'Escolha a imagem do material.');
      return;
    }

    setSalvando(true);
    setErro('');
    try {
      const dados = { nome: nome.trim(), tipo, ativo };
      if (tipo === 'link') dados.conteudoURL = linkURL.trim();

      let idFinal;
      if (editando) {
        idFinal = materialInicial.id;
        await atualizarMaterial(idFinal, dados, perfil);
      } else {
        idFinal = await criarMaterial(dados, perfil);
      }

      if (arquivoCapa) {
        const capaURL = await uploadCapaMaterial(idFinal, arquivoCapa);
        await atualizarMaterial(idFinal, { capaURL }, perfil);
      }

      if (arquivoConteudo && tipo === 'imagem') {
        const conteudoURL = await uploadConteudoImagemMaterial(idFinal, arquivoConteudo);
        await atualizarMaterial(idFinal, { conteudoURL }, perfil);
      } else if (arquivoConteudo && tipo === 'pdf') {
        const conteudoURL = await uploadConteudoPdfMaterial(idFinal, arquivoConteudo);
        await atualizarMaterial(idFinal, { conteudoURL }, perfil);
      }

      onSalvo();
    } catch (err) {
      console.error('Erro ao salvar material:', err);
      setErro('Não foi possível salvar agora. Verifique sua internet e tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  if (srcCorte) {
    return (
      <ImageCropper
        src={srcCorte}
        razao={{ w: 1, h: 1 }}
        onConfirmar={handleCapaCortada}
        onCancelar={() => setSrcCorte('')}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-forte-900/40 sm:items-center"
      onClick={onFechar}
    >
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-cream sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-coffee-100 px-5 py-4">
          <h3 className="font-destaque text-base font-semibold text-coffee-800">
            {editando ? 'Editar material' : 'Novo material'}
          </h3>
          <button onClick={onFechar} className="text-coffee-400">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <Campo label="Capa (imagem, corte quadrado)">
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl bg-coffee-50">
                {previewCapa ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewCapa} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Box size={20} className="text-coffee-200" />
                  </div>
                )}
              </div>
              <label className="cursor-pointer rounded-lg border border-coffee-200 px-3 py-2 text-xs font-semibold text-coffee-700">
                {previewCapa ? 'Trocar capa' : 'Enviar capa'}
                <input type="file" accept="image/*" onChange={handleEscolherCapa} className="hidden" />
              </label>
            </div>
          </Campo>

          <Campo label="Nome">
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Bíblia, Lição da Escola Sabatina…"
              className="w-full rounded-lg border border-coffee-100 bg-cream-card px-3 py-2.5 text-sm text-coffee-800"
            />
          </Campo>

          <Campo label="O que abre ao tocar">
            <select
              value={tipo}
              onChange={(e) => handleMudarTipo(e.target.value)}
              className="w-full rounded-lg border border-coffee-100 bg-cream-card px-3 py-2.5 text-sm text-coffee-800"
            >
              {TIPOS_MATERIAL.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.label}
                </option>
              ))}
            </select>
          </Campo>

          {tipo === 'link' && (
            <Campo label="Link">
              <input
                value={linkURL}
                onChange={(e) => setLinkURL(e.target.value)}
                placeholder="https://…"
                className="w-full rounded-lg border border-coffee-100 bg-cream-card px-3 py-2.5 text-sm text-coffee-800"
              />
            </Campo>
          )}

          {tipo === 'imagem' && (
            <Campo label={editando && materialInicial?.tipo === 'imagem' ? 'Trocar imagem (opcional)' : 'Imagem'}>
              <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-coffee-200 px-3 py-3 text-xs font-semibold text-coffee-600">
                <ImageIcon size={14} />
                {nomeArquivoConteudo || 'Escolher imagem'}
                <input type="file" accept="image/*" onChange={handleEscolherConteudo} className="hidden" />
              </label>
              {editando && materialInicial?.tipo === 'imagem' && !nomeArquivoConteudo && (
                <p className="mt-1.5 text-[11px] text-coffee-400">Deixe em branco pra manter a imagem atual.</p>
              )}
            </Campo>
          )}

          {tipo === 'pdf' && (
            <Campo label={editando && materialInicial?.tipo === 'pdf' ? 'Trocar PDF (opcional)' : 'Arquivo PDF'}>
              <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-coffee-200 px-3 py-3 text-xs font-semibold text-coffee-600">
                <FileText size={14} />
                {nomeArquivoConteudo || 'Escolher PDF'}
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={handleEscolherConteudo}
                  className="hidden"
                />
              </label>
              {editando && materialInicial?.tipo === 'pdf' && !nomeArquivoConteudo && (
                <p className="mt-1.5 text-[11px] text-coffee-400">Deixe em branco pra manter o PDF atual.</p>
              )}
            </Campo>
          )}

          <label className="flex items-center gap-2 text-xs text-coffee-500">
            <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
            Ativo (visível no app)
          </label>

          {erro && <p className="text-center text-sm text-red-700">{erro}</p>}

          <button
            onClick={handleSalvar}
            disabled={!nome.trim() || salvando}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-forte py-3 text-sm font-semibold text-cream disabled:opacity-40"
          >
            {salvando && <Loader2 size={14} className="animate-spin" />}
            {editando ? 'Salvar alterações' : 'Criar material'}
          </button>
        </div>
      </div>
    </div>
  );
}
