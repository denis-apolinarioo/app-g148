'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Loader2, Trash2, RefreshCw } from 'lucide-react';
import { updatePost } from '@/lib/firestore-helpers';
import { uploadFotoComThumb, uploadAudio } from '@/lib/storage';
import AudioRecorderButton from '@/components/AudioRecorderButton';
import AudioPlayer from '@/components/AudioPlayer';

/**
 * Correção do bug "dá pra editar o título da missão": antes, o botão
 * Editar do PostCard só mexia em `post.texto` — que pra um post MANUAL
 * (criado direto no Feed) é a legenda escrita pela pessoa, mas pra um post
 * AUTOMÁTICO de missão (post.origemMissaoId preenchido) é o TÍTULO da
 * missão (ver lib/points.js -> criarPostDeMissao: `texto: missao.titulo`).
 * Editar isso mudava o título da missão no post, o que nunca fez sentido.
 *
 * Agora: pra post de missão, `texto` nunca aparece como editável aqui (o
 * título fica travado, mostrado com mais destaque no PostCard) — só os
 * ITENS da missão (foto, áudio, respostas de texto, checks marcados) são
 * editáveis. Pra post manual, continua editando a legenda (`texto`) e,
 * se for foto/áudio, também dá pra trocar a mídia.
 *
 * A janela de 24h pra edição já é checada antes de abrir este modal (ver
 * PostCard.js -> postAindaEditavel) e reforçada no firestore.rules
 * (podeEditarConteudoDoPost) — aqui só monta os campos e salva.
 */
export default function EditarPostModal({ post, onFechar }) {
  const ehPostDeMissao = !!post.origemMissaoId;
  const itensOriginais = Array.isArray(post.itens) ? post.itens : null;

  const [texto, setTexto] = useState(post.texto || '');
  const [itens, setItens] = useState(
    itensOriginais ? itensOriginais.map((item) => ({ ...item })) : null
  );
  const [trocandoAudioIdx, setTrocandoAudioIdx] = useState(null);

  // Post manual com foto/áudio (fora do fluxo de missão) — troca de mídia.
  const [arquivoFotoManual, setArquivoFotoManual] = useState(null);
  const [previewFotoManual, setPreviewFotoManual] = useState(
    post.tipo === 'foto' ? post.midiaURL : ''
  );
  const [blobAudioManual, setBlobAudioManual] = useState(null);
  const [previewAudioManual, setPreviewAudioManual] = useState('');
  const [trocandoAudioManual, setTrocandoAudioManual] = useState(false);

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const inputFotoManualRef = useRef(null);
  const inputsFotoItemRef = useRef({});

  // Revoga prévias locais (blob:) trocadas durante a edição, sem mexer nas
  // URLs originais do Firebase Storage.
  useEffect(() => {
    return () => {
      if (previewFotoManual?.startsWith('blob:')) URL.revokeObjectURL(previewFotoManual);
      if (previewAudioManual) URL.revokeObjectURL(previewAudioManual);
      itens?.forEach((item) => {
        if (item._preview?.startsWith('blob:')) URL.revokeObjectURL(item._preview);
        if (item._audioPreviewURL) URL.revokeObjectURL(item._audioPreviewURL);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFotoManualChange(e) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    if (previewFotoManual?.startsWith('blob:')) URL.revokeObjectURL(previewFotoManual);
    setArquivoFotoManual(arquivo);
    setPreviewFotoManual(URL.createObjectURL(arquivo));
  }

  function handleTrocarFotoItem(index, arquivo) {
    if (!arquivo) return;
    const preview = URL.createObjectURL(arquivo);
    setItens((atual) =>
      atual.map((item, i) => {
        if (i !== index) return item;
        if (item._preview?.startsWith('blob:')) URL.revokeObjectURL(item._preview);
        return { ...item, _novoArquivo: arquivo, _preview: preview };
      })
    );
  }

  function handleTrocarAudioItem(index, blob) {
    const preview = URL.createObjectURL(blob);
    setItens((atual) =>
      atual.map((item, i) => {
        if (i !== index) return item;
        if (item._audioPreviewURL) URL.revokeObjectURL(item._audioPreviewURL);
        return { ...item, _novoBlobAudio: blob, _audioPreviewURL: preview };
      })
    );
    setTrocandoAudioIdx(null);
  }

  function handleTextoItemChange(index, valor) {
    setItens((atual) => atual.map((item, i) => (i === index ? { ...item, valor } : item)));
  }

  function handleRemoverItem(index) {
    setItens((atual) => atual.filter((_, i) => i !== index));
  }

  async function handleSalvar() {
    if (salvando) return;
    // Pode excluir os itens livremente, mas não dá pra salvar um post de
    // missão sem nenhum item restante — trava aqui, na hora de salvar (a
    // exclusão em si continua livre, sem nenhum aviso ou bloqueio na hora
    // de excluir).
    if (itens && itens.length === 0) {
      setErro('Não é possível salvar sem nenhum item. Deixe pelo menos 1.');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      const dados = {};

      if (!ehPostDeMissao) {
        dados.texto = texto.trim();

        if (post.tipo === 'foto' && arquivoFotoManual) {
          const { url, thumbURL } = await uploadFotoComThumb(post.autorId, arquivoFotoManual);
          dados.midiaURL = url;
          dados.midiaThumbURL = thumbURL;
        } else if (post.tipo === 'audio' && blobAudioManual) {
          dados.midiaURL = await uploadAudio(post.autorId, blobAudioManual);
        }
      }

      if (itens) {
        const itensFinal = [];
        // eslint-disable-next-line no-restricted-syntax
        for (const item of itens) {
          if (item.tipo === 'foto') {
            let { url } = item;
            if (item._novoArquivo) {
              // eslint-disable-next-line no-await-in-loop
              const resultado = await uploadFotoComThumb(post.autorId, item._novoArquivo);
              url = resultado.url;
            }
            itensFinal.push({ tipo: 'foto', url });
          } else if (item.tipo === 'audio') {
            let { url } = item;
            if (item._novoBlobAudio) {
              // eslint-disable-next-line no-await-in-loop
              url = await uploadAudio(post.autorId, item._novoBlobAudio);
            }
            itensFinal.push({ tipo: 'audio', url });
          } else if (item.tipo === 'check') {
            itensFinal.push({ tipo: 'check', label: item.label });
          } else {
            itensFinal.push({ tipo: item.tipo, label: item.label, valor: (item.valor || '').trim() });
          }
        }
        dados.itens = itensFinal;

        // Mantém os campos legados (tipo/midiaURL) sincronizados com o
        // primeiro item de foto/áudio, do mesmo jeito que
        // lib/points.js -> criarPostDeMissao monta na criação — sem isso,
        // telas que ainda leem post.midiaURL direto (ex.: cache local de
        // imagem) ficariam apontando pra mídia antiga.
        const fotoItem = itensFinal.find((i) => i.tipo === 'foto');
        const audioItem = itensFinal.find((i) => i.tipo === 'audio');
        dados.tipo = fotoItem ? 'foto' : audioItem ? 'audio' : 'texto';
        dados.midiaURL = fotoItem?.url || audioItem?.url || '';
      }

      await updatePost(post.id, dados);
      onFechar();
    } catch (err) {
      console.error('Erro ao salvar edição do post:', err);
      setErro('Não foi possível salvar agora. Verifique sua internet e tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-coffee-900/40 sm:items-center"
      onClick={onFechar}
    >
      <div
        className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-cream sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-coffee-100 px-5 py-4">
          <h2 className="font-destaque text-lg font-semibold text-coffee-800">Editar post</h2>
          <button onClick={onFechar} className="text-coffee-400" aria-label="Fechar">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          {!ehPostDeMissao && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-coffee-500">Legenda</p>
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-xl border border-coffee-100 bg-cream-card p-3.5 text-sm text-coffee-800"
              />
            </div>
          )}

          {!ehPostDeMissao && post.tipo === 'foto' && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-coffee-500">Foto</p>
              {previewFotoManual && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewFotoManual}
                  alt="Prévia"
                  className="mb-2 max-h-56 w-full rounded-xl object-cover"
                />
              )}
              <button
                type="button"
                onClick={() => inputFotoManualRef.current?.click()}
                className="flex items-center gap-1.5 rounded-full border border-coffee-200 px-3 py-1.5 text-xs font-medium text-coffee-600"
              >
                <RefreshCw size={13} /> Trocar foto
              </button>
              <input
                ref={inputFotoManualRef}
                type="file"
                accept="image/*"
                onChange={handleFotoManualChange}
                className="hidden"
              />
            </div>
          )}

          {!ehPostDeMissao && post.tipo === 'audio' && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-coffee-500">Áudio</p>
              {!trocandoAudioManual ? (
                <>
                  <AudioPlayer
                    src={previewAudioManual || post.midiaURL}
                    className="mb-2 rounded-2xl border border-coffee-100 bg-cream-card px-4 py-2"
                  />
                  <button
                    type="button"
                    onClick={() => setTrocandoAudioManual(true)}
                    className="flex items-center gap-1.5 rounded-full border border-coffee-200 px-3 py-1.5 text-xs font-medium text-coffee-600"
                  >
                    <RefreshCw size={13} /> Trocar áudio
                  </button>
                </>
              ) : (
                <AudioRecorderButton
                  onGravado={(blob) => {
                    setBlobAudioManual(blob);
                    setPreviewAudioManual(URL.createObjectURL(blob));
                    setTrocandoAudioManual(false);
                  }}
                  onLimpar={() => setTrocandoAudioManual(false)}
                />
              )}
            </div>
          )}

          {itens && itens.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-coffee-500">Itens da missão</p>

              {itens.map((item, i) => (
                <div key={`${item.tipo}-${i}`} className="rounded-xl border border-coffee-100 bg-cream-card p-3">
                  {item.tipo === 'foto' && (
                    <div>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item._preview || item.url}
                        alt="Foto da missão"
                        className="mb-2 max-h-52 w-full rounded-lg object-cover"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => inputsFotoItemRef.current[i]?.click()}
                          className="flex items-center gap-1.5 rounded-full border border-coffee-200 px-3 py-1.5 text-xs font-medium text-coffee-600"
                        >
                          <RefreshCw size={13} /> Trocar foto
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoverItem(i)}
                          className="flex items-center gap-1.5 rounded-full border border-coffee-200 px-3 py-1.5 text-xs font-medium text-red-600"
                        >
                          <Trash2 size={13} /> Remover
                        </button>
                      </div>
                      <input
                        ref={(el) => {
                          inputsFotoItemRef.current[i] = el;
                        }}
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const arquivo = e.target.files?.[0];
                          if (arquivo) handleTrocarFotoItem(i, arquivo);
                        }}
                        className="hidden"
                      />
                    </div>
                  )}

                  {item.tipo === 'audio' && (
                    <div>
                      {trocandoAudioIdx === i ? (
                        <AudioRecorderButton
                          onGravado={(blob) => handleTrocarAudioItem(i, blob)}
                          onLimpar={() => setTrocandoAudioIdx(null)}
                        />
                      ) : (
                        <>
                          <AudioPlayer
                            src={item._audioPreviewURL || item.url}
                            className="mb-2 rounded-2xl border border-coffee-100 bg-cream-card px-4 py-2"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setTrocandoAudioIdx(i)}
                              className="flex items-center gap-1.5 rounded-full border border-coffee-200 px-3 py-1.5 text-xs font-medium text-coffee-600"
                            >
                              <RefreshCw size={13} /> Trocar áudio
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoverItem(i)}
                              className="flex items-center gap-1.5 rounded-full border border-coffee-200 px-3 py-1.5 text-xs font-medium text-red-600"
                            >
                              <Trash2 size={13} /> Remover
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {item.tipo === 'check' && (
                    <label className="flex items-center gap-2.5 text-sm text-coffee-700">
                      <input
                        type="checkbox"
                        checked
                        onChange={() => handleRemoverItem(i)}
                        className="h-5 w-5 flex-shrink-0 rounded border-coffee-200 text-coffee-700"
                      />
                      <span>{item.label}</span>
                    </label>
                  )}

                  {(item.tipo === 'texto-curto' || item.tipo === 'texto-longo' || item.tipo === 'link') && (
                    <div>
                      {item.label && (
                        <p className="mb-1.5 text-xs font-medium text-coffee-500">{item.label}</p>
                      )}
                      {item.tipo === 'texto-longo' ? (
                        <textarea
                          rows={3}
                          value={item.valor}
                          onChange={(e) => handleTextoItemChange(i, e.target.value)}
                          className="w-full resize-none rounded-xl border border-coffee-100 bg-cream p-3 text-sm text-coffee-800"
                        />
                      ) : (
                        <input
                          type={item.tipo === 'link' ? 'url' : 'text'}
                          value={item.valor}
                          onChange={(e) => handleTextoItemChange(i, e.target.value)}
                          className="w-full rounded-xl border border-coffee-100 bg-cream p-3 text-sm text-coffee-800"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoverItem(i)}
                        className="mt-1.5 flex items-center gap-1 text-xs font-medium text-red-600"
                      >
                        <Trash2 size={12} /> Remover
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {erro && <p className="text-sm text-red-700">{erro}</p>}

          <button
            onClick={handleSalvar}
            disabled={salvando || (itens && itens.length === 0)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-coffee-700 py-3.5 text-sm font-semibold text-cream disabled:opacity-50"
          >
            {salvando && <Loader2 size={16} className="animate-spin" />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
