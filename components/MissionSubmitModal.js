'use client';

import { useState, useRef } from 'react';
import { X, Loader2, Image as ImageIcon, PartyPopper } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { submeterMissaoDiaria, submeterMissaoSemanal, concluirMissaoMensal } from '@/lib/points';
import { verificarConquistas } from '@/lib/achievements';
import { uploadFoto } from '@/lib/storage';
import { CONQUISTAS } from '@/lib/constants';

export default function MissionSubmitModal({ missao, periodicidade, onFechar, onConcluida }) {
  const { perfil } = useAuth();
  const [resposta, setResposta] = useState({});
  const [arquivoFoto, setArquivoFoto] = useState(null);
  const [previewFoto, setPreviewFoto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [conquistaNova, setConquistaNova] = useState(null);
  const inputFotoRef = useRef(null);

  function handleFotoChange(e) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setArquivoFoto(arquivo);
    setPreviewFoto(URL.createObjectURL(arquivo));
  }

  const camposPreenchidos =
    missao.tipo === 'check' ||
    missao.tipo === 'leitura' ||
    (missao.campos || []).every((campo) => (resposta[campo.chave] || '').trim());

  async function handleConfirmar() {
    if (enviando) return;
    setEnviando(true);
    setErro('');

    try {
      let fotoURL = '';
      if (missao.permiteFoto && arquivoFoto) {
        fotoURL = await uploadFoto(perfil.uid, arquivoFoto);
      }

      if (periodicidade === 'diaria') {
        await submeterMissaoDiaria(missao.id, perfil, resposta, fotoURL);
      } else if (periodicidade === 'semanal') {
        await submeterMissaoSemanal(missao.id, perfil, resposta, fotoURL);
      } else if (periodicidade === 'mensal') {
        await concluirMissaoMensal(missao.id, perfil);
      }

      const contexto =
        periodicidade === 'mensal' ? 'leitura' : missao.tipo === 'check' ? null : 'missao_diaria';
      if (contexto) {
        const novas = await verificarConquistas(perfil.uid, (perfil.streakAtual || 0) + 1, contexto);
        if (novas.length > 0) {
          setConquistaNova(CONQUISTAS.find((c) => c.id === novas[0]));
          setEnviando(false);
          return; // mostra a tela de conquista antes de fechar
        }
      }

      onConcluida?.();
      onFechar();
    } catch (err) {
      if (
        err.message === 'MISSAO_JA_ENVIADA_HOJE' ||
        err.message === 'MISSAO_JA_ENVIADA_NESTA_SEMANA' ||
        err.message === 'MISSAO_JA_CONCLUIDA_NESTE_MES'
      ) {
        setErro('Você já cumpriu essa missão neste período.');
        setTimeout(() => {
          onConcluida?.();
          onFechar();
        }, 1500);
      } else {
        console.error('Erro ao enviar missão:', err);
        setErro('Não foi possível enviar agora. Verifique sua internet e tente de novo.');
      }
    } finally {
      setEnviando(false);
    }
  }

  if (conquistaNova) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-coffee-900/50 px-6">
        <div className="w-full max-w-xs rounded-2xl bg-cream-card p-6 text-center shadow-soft">
          <PartyPopper size={36} className="mx-auto text-gold" />
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-gold">
            Nova conquista!
          </p>
          <p className="mt-1 font-display text-xl font-medium text-coffee-800">
            {conquistaNova.nome}
          </p>
          <p className="mt-2 text-sm text-coffee-400">{conquistaNova.descricao}</p>
          <button
            onClick={() => {
              onConcluida?.();
              onFechar();
            }}
            className="mt-5 w-full rounded-xl bg-coffee-700 py-3 text-sm font-semibold text-cream"
          >
            Continuar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-coffee-900/40 sm:items-center">
      <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-cream sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-coffee-100 px-5 py-4">
          <h2 className="font-display text-lg font-medium text-coffee-800">{missao.titulo}</h2>
          <button onClick={onFechar} className="text-coffee-400">
            <X size={20} />
          </button>
        </div>

        <div className="px-5 py-5">
          {missao.tipo === 'check' && (
            <p className="text-center font-display text-lg leading-relaxed text-coffee-700">
              {missao.perguntaConfirmacao}
            </p>
          )}

          {missao.tipo === 'leitura' && (
            <div>
              <p className="text-sm text-coffee-600">{missao.descricao}</p>
              {missao.linkDrive ? (
                <a
                  href={missao.linkDrive}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 block rounded-xl border border-coffee-100 bg-cream-card px-4 py-3 text-center text-sm font-semibold text-coffee-700"
                >
                  Abrir material
                </a>
              ) : (
                <p className="mt-3 text-xs text-coffee-300">
                  O link do material ainda não foi cadastrado pelo administrador.
                </p>
              )}
            </div>
          )}

          {(missao.tipo === 'texto' || missao.tipo === 'reflexao') && (
            <div className="space-y-4">
              {missao.campos.map((campo) => (
                <div key={campo.chave}>
                  <label className="mb-1.5 block text-xs font-medium text-coffee-500">
                    {campo.label}
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
              ))}

              {missao.permiteFoto && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-coffee-500">
                    Foto (opcional)
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
            </div>
          )}

          {erro && <p className="mt-4 text-center text-sm text-red-700">{erro}</p>}

          <button
            onClick={handleConfirmar}
            disabled={!camposPreenchidos || enviando}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-coffee-700 py-3.5 text-sm font-semibold text-cream disabled:opacity-40"
          >
            {enviando && <Loader2 size={16} className="animate-spin" />}
            {missao.tipo === 'check' ? 'Sim, confirmo' : missao.tipo === 'leitura' ? 'Marcar como concluído' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  );
}
