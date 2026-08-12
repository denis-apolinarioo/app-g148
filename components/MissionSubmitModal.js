'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { submeterMissao } from '@/lib/points';
import { verificarConquistas } from '@/lib/achievements';
import { vibrarMissaoConcluida } from '@/lib/haptics';
import { uploadFoto, uploadAudio } from '@/lib/storage';
import ImageCropper, { PROPORCOES_PADRAO } from '@/components/ImageCropper';
import AudioRecorderButton from '@/components/AudioRecorderButton';
import { useToast } from '@/components/ToastProvider';
import { useProtecaoCliqueDuplo } from '@/lib/useProtecaoCliqueDuplo';

export default function MissionSubmitModal({ missao, onFechar, onConcluida, rascunhoInicial, onEnviarOtimista, onConfirmarEnviada, onErroEnviar }) {
  const { perfil } = useAuth();
  const mostrarToast = useToast();
  // Mesma proteção contra duplo toque rápido usada em curtir/comentar/postar
  // (ver lib/useProtecaoCliqueDuplo.js) — aqui pro botão "Enviar".
  const emDebounceEnviar = useProtecaoCliqueDuplo();
  // PUBLICAÇÃO OTIMISTA — quando a tela reabre depois de um erro de envio
  // (ver onErroEnviar), `rascunhoInicial` traz de volta a resposta que a
  // pessoa tinha preenchido, pra não perder nada.
  const [resposta, setResposta] = useState(rascunhoInicial?.resposta || {});
  const [arquivoFoto, setArquivoFoto] = useState(rascunhoInicial?.arquivoFoto || null);
  const [previewFoto, setPreviewFoto] = useState('');
  const [srcCorte, setSrcCorte] = useState(''); // URL da imagem bruta pra tela de corte
  const [blobAudio, setBlobAudio] = useState(rascunhoInicial?.blobAudio || null);
  // Duração aproximada (segundos) do áudio gravado — usada só pra
  // conquistas que exigem áudio (ex.: "Paulo no Whatsapp").
  const [duracaoAudio, setDuracaoAudio] = useState(rascunhoInicial?.duracaoAudio || 0);
  const [erro, setErro] = useState(rascunhoInicial?.mensagemErro || '');
  const inputFotoRef = useRef(null);

  // Reconstrói a prévia da foto a partir do arquivo trazido pelo rascunho.
  useEffect(() => {
    if (rascunhoInicial?.arquivoFoto) {
      setPreviewFoto(URL.createObjectURL(rascunhoInicial.arquivoFoto));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function abrirCorte(arquivo) {
    setSrcCorte(URL.createObjectURL(arquivo));
  }

  function handleFotoChange(e) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    abrirCorte(arquivo);
  }

  function fecharCorte() {
    if (srcCorte) URL.revokeObjectURL(srcCorte);
    setSrcCorte('');
  }

  function handleCortado(blob) {
    fecharCorte();
    const file = new File([blob], 'foto.jpg', { type: 'image/jpeg' });
    setArquivoFoto(file);
    setPreviewFoto(URL.createObjectURL(blob));
  }

  // CORREÇÃO DE VAZAMENTO: previewFoto (blob: local) nunca era revogada —
  // ficava viva mesmo trocando de foto ou fechando a tela sem publicar.
  // Revoga a anterior sempre que ela muda (nova foto) e também ao desmontar.
  useEffect(() => {
    return () => {
      if (previewFoto) URL.revokeObjectURL(previewFoto);
    };
  }, [previewFoto]);

  // Só os campos marcados como obrigatórios travam o envio — os opcionais
  // podem ficar em branco (ver Admin > Missões > cada campo tem um toggle
  // "obrigatório / opcional").
  const camposObrigatoriosOk = (missao.campos || []).every((campo) => {
    if (!campo.obrigatorio) return true;
    if (campo.tipo === 'check') return resposta[campo.chave] === true;
    return (resposta[campo.chave] || '').trim();
  });
  const fotoOk = !missao.fotoObrigatoria || !!arquivoFoto;
  const audioOk = !missao.audioObrigatoria || !!blobAudio;

  // Proteção geral: mesmo quando nenhum campo é obrigatório (ex.: missão
  // só com checks opcionais), não dá pra enviar completamente em branco —
  // precisa ter marcado/preenchido pelo menos uma coisa.
  const temAlgumConteudo =
    (missao.campos || []).some((campo) =>
      campo.tipo === 'check' ? resposta[campo.chave] === true : (resposta[campo.chave] || '').trim()
    ) ||
    (missao.permiteFoto && !!arquivoFoto) ||
    (missao.permiteAudio && !!blobAudio);

  const podeEnviar = camposObrigatoriosOk && fotoOk && audioOk && temAlgumConteudo;

  // PUBLICAÇÃO OTIMISTA — mesma ideia de CreatePostSheet.js: a tela fecha
  // NA HORA, o card da missão já vira "concluída" na tela de Missões (ver
  // handleEnviarOtimista em app/(app)/missoes/page.js), e o upload +
  // envio de verdade roda em segundo plano. Se destravar conquista nova, o
  // pop-up aparece depois, por cima da tela de Missões (não dá mais pra
  // mostrar aqui dentro, já que o modal já fechou) — ver
  // handleConfirmarEnviada no pai. Em caso de erro, a missão volta a ficar
  // disponível e este modal reabre com a resposta preenchida de novo.
  async function handleConfirmar() {
    if (!podeEnviar || emDebounceEnviar()) return;
    setErro('');

    const rascunho = { resposta, arquivoFoto, blobAudio, duracaoAudio };

    onEnviarOtimista?.(missao.id);
    onFechar();

    try {
      let fotoURL = '';
      if (missao.permiteFoto && arquivoFoto) {
        fotoURL = await uploadFoto(perfil.uid, arquivoFoto);
      }

      let audioURL = '';
      if (missao.permiteAudio && blobAudio) {
        audioURL = await uploadAudio(perfil.uid, blobAudio);
      }

      await submeterMissao(missao.id, perfil, resposta, fotoURL, audioURL, missao.permiteAudio && blobAudio ? duracaoAudio : 0);

      vibrarMissaoConcluida();

      // A missão já foi registrada de verdade aqui — falta só checar se ela
      // destravou alguma conquista nova. As checagens rodam todas em
      // paralelo (ver lib/achievements.js), então isso é rápido.
      const novas = await verificarConquistas(perfil.uid, (perfil.streakAtual || 0) + 1, 'missao_diaria');

      mostrarToast('Missão enviada com sucesso!');
      onConcluida?.();
      onConfirmarEnviada?.(missao.id, novas[0] || null);
    } catch (err) {
      let mensagem = 'Não foi possível enviar agora. Verifique sua internet e tente de novo.';
      if (err.message === 'MISSAO_LIMITE_ATINGIDO_NO_PERIODO') {
        mensagem = 'Você já atingiu o limite de vezes que pode cumprir essa missão neste período.';
      } else if (err.message === 'MISSAO_FORA_DO_PERIODO') {
        mensagem = 'Essa missão não está disponível agora.';
      } else {
        console.error('Erro ao enviar missão:', err);
      }
      onConcluida?.();
      onErroEnviar?.(missao, rascunho, mensagem);
    }
  }

  if (srcCorte) {
    return (
      <ImageCropper
        src={srcCorte}
        razao={{ w: 1, h: 1 }}
        opcoes={PROPORCOES_PADRAO}
        onConfirmar={handleCortado}
        onCancelar={fecharCorte}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-forte-900/40 sm:items-center"
      onClick={onFechar}
    >
      <div
        className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-cream sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-coffee-100 px-5 py-4">
          <h2 className="font-destaque text-lg font-semibold text-coffee-800">{missao.titulo}</h2>
          <button onClick={onFechar} className="text-coffee-400">
            <X size={20} />
          </button>
        </div>

        <div className="px-5 py-5">
          <div className="space-y-4">
            {missao.instrucoes && (
              <p className="text-sm text-coffee-600">{missao.instrucoes}</p>
            )}

            {missao.linkDrive && (
              <a
                href={missao.linkDrive}
                target="_blank"
                rel="noreferrer"
                className="block rounded-xl border border-coffee-100 bg-cream-card px-4 py-3 text-center text-sm font-semibold text-coffee-700"
              >
                Abrir material
              </a>
            )}

            {(missao.campos || []).map((campo) => (
              <div key={campo.chave}>
                {campo.tipo === 'check' ? (
                  <label className="flex items-center gap-2.5 text-sm text-coffee-700">
                    <input
                      type="checkbox"
                      checked={resposta[campo.chave] === true}
                      onChange={(e) =>
                        setResposta((r) => ({ ...r, [campo.chave]: e.target.checked }))
                      }
                      className="h-5 w-5 flex-shrink-0 rounded border-coffee-200 text-coffee-700"
                    />
                    <span>
                      {campo.label}
                      {!campo.obrigatorio && (
                        <span className="ml-1 text-[11px] text-coffee-300">(opcional)</span>
                      )}
                    </span>
                  </label>
                ) : (
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-coffee-500">
                      {campo.label}
                      {!campo.obrigatorio && (
                        <span className="ml-1 text-[11px] font-normal text-coffee-300">(opcional)</span>
                      )}
                    </label>
                    {campo.tipo === 'texto-longo' ? (
                      <textarea
                        rows={4}
                        value={resposta[campo.chave] || ''}
                        onChange={(e) =>
                          setResposta((r) => ({ ...r, [campo.chave]: e.target.value }))
                        }
                        className="w-full resize-none rounded-xl border border-coffee-100 bg-cream-card p-3.5 text-sm text-coffee-800 placeholder:text-coffee-300"
                        placeholder="Escreva com suas palavras..."
                      />
                    ) : (
                      <input
                        type={campo.tipo === 'link' ? 'url' : 'text'}
                        value={resposta[campo.chave] || ''}
                        onChange={(e) =>
                          setResposta((r) => ({ ...r, [campo.chave]: e.target.value }))
                        }
                        className="w-full rounded-xl border border-coffee-100 bg-cream-card p-3.5 text-sm text-coffee-800 placeholder:text-coffee-300"
                        placeholder={campo.tipo === 'link' ? 'https://...' : ''}
                      />
                    )}
                  </div>
                )}
              </div>
            ))}

            {missao.permiteFoto && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-coffee-500">
                  Foto {missao.fotoObrigatoria ? '' : '(opcional)'}
                </label>
                {previewFoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewFoto}
                    alt="Prévia"
                    onClick={() => inputFotoRef.current?.click()}
                    className="max-h-52 w-full cursor-pointer rounded-xl object-cover"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => inputFotoRef.current?.click()}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-coffee-200 py-6 text-coffee-400"
                  >
                    <ImageIcon size={20} />
                    <span className="text-sm">Adicionar foto</span>
                  </button>
                )}
                <input
                  ref={inputFotoRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFotoChange}
                  className="hidden"
                />
              </div>
            )}

            {missao.permiteAudio && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-coffee-500">
                  Áudio {missao.audioObrigatoria ? '' : '(opcional)'}
                </label>
                <AudioRecorderButton
                  onGravado={(blob, segundos) => {
                    setBlobAudio(blob);
                    setDuracaoAudio(segundos || 0);
                  }}
                  onLimpar={() => {
                    setBlobAudio(null);
                    setDuracaoAudio(0);
                  }}
                />
              </div>
            )}
          </div>

          {erro && <p className="mt-4 text-center text-sm text-red-700">{erro}</p>}

          <button
            onClick={handleConfirmar}
            disabled={!podeEnviar}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-forte py-3.5 text-sm font-semibold text-texto-forte disabled:opacity-40"
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}
