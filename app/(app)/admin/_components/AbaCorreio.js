'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Coins, Gift, Loader2, Pin, Search, Trash2, X } from 'lucide-react';
import Avatar from '@/components/Avatar';
import DracmaIcon from '@/components/DracmaIcon';
import ImageCropper, { PROPORCAO_ORIGINAL } from '@/components/ImageCropper';
import { useAuth } from '@/components/AuthProvider';
import {
  getAllUsers,
  sendMailMessage,
  sendMailToMultiple,
  subscribeToMailHistory,
  deleteMailMessage,
} from '@/lib/firestore-helpers';
import { uploadFotoCorreioComThumb } from '@/lib/storage';
import { combinaComBusca } from '@/lib/searchUtils';
import { formatDateTimeBR } from '@/lib/dateUtils';
import { formatarDracma } from '@/lib/dracma';
import { useConfirm } from '@/components/ConfirmProvider';
import { useToast } from '@/components/ToastProvider';
import { useProtecaoCliqueDuplo } from '@/lib/useProtecaoCliqueDuplo';

// Item novo — igual ao Feed (CreatePostSheet.js), mas com uma 4ª opção:
// "Original" mantém a proporção nativa da foto, sem cortar nada (ver
// PROPORCAO_ORIGINAL em ImageCropper.js). As outras 3 são as mesmas do Feed.
const PROPORCOES_CORREIO = [
  { label: '1:1', w: 1, h: 1 },
  { label: '4:5', w: 4, h: 5 },
  { label: '3:4', w: 3, h: 4 },
  { label: 'Original', w: PROPORCAO_ORIGINAL, h: PROPORCAO_ORIGINAL },
];

export default function AbaCorreio() {
  const confirmar = useConfirm();
  const [usuarios, setUsuarios] = useState([]);
  const [busca, setBusca] = useState('');
  const [selecionados, setSelecionados] = useState([]);
  const [texto, setTexto] = useState('');
  const [fixada, setFixada] = useState(false);
  const [arquivoFoto, setArquivoFoto] = useState(null);
  const [previewFoto, setPreviewFoto] = useState('');
  const [srcCorte, setSrcCorte] = useState(''); // URL da imagem bruta pra tela de corte
  const [enviado, setEnviado] = useState(false);
  const [erroEnvio, setErroEnvio] = useState('');
  const [anexarRecompensa, setAnexarRecompensa] = useState(false);
  const [pontosAnexados, setPontosAnexados] = useState('');
  const [dracmasAnexados, setDracmasAnexados] = useState('');
  const { perfil } = useAuth();
  const mostrarToast = useToast();
  // Mesma proteção contra duplo toque rápido usada em curtir/comentar/postar/
  // enviar missão (ver lib/useProtecaoCliqueDuplo.js) — aqui pro botão "Enviar".
  const emDebounceEnviar = useProtecaoCliqueDuplo();
  const inputFotoRef = useRef(null);

  useEffect(() => {
    getAllUsers().then(setUsuarios);
  }, []);

  const usuariosFiltrados = useMemo(() => {
    if (!busca.trim()) return usuarios;
    return usuarios.filter((u) => combinaComBusca(u.nome, busca) || combinaComBusca(u.username, busca));
  }, [usuarios, busca]);

  const todosSelecionados =
    usuariosFiltrados.length > 0 && usuariosFiltrados.every((u) => selecionados.includes(u.id));

  function alternarTodos() {
    if (todosSelecionados) {
      const idsFiltrados = new Set(usuariosFiltrados.map((u) => u.id));
      setSelecionados((sel) => sel.filter((id) => !idsFiltrados.has(id)));
    } else {
      setSelecionados((sel) => [...new Set([...sel, ...usuariosFiltrados.map((u) => u.id)])]);
    }
  }

  function alternarUm(uid) {
    setSelecionados((sel) => (sel.includes(uid) ? sel.filter((id) => id !== uid) : [...sel, uid]));
  }

  // CORREÇÃO DE BUG (foto "não vai" no Correio): antes, o arquivo CRU da
  // câmera/galeria era reduzido "no escuro" (sem tela de corte) e só depois
  // comprimido de verdade na hora de enviar — ficava sujeito ao bug de
  // travamento do Web Worker em fotos grandes. Agora o Correio segue
  // EXATAMENTE o mesmo caminho do Feed (ver abrirCorte/handleCortado em
  // CreatePostSheet.js): a foto crua abre na tela de corte (ImageCropper),
  // que já redesenha a imagem num canvas de no máximo 1600px antes de
  // qualquer outra coisa — chegando pequena na hora de comprimir/enviar,
  // do mesmo jeito que sempre funcionou bem no Feed. Única diferença: aqui
  // são 4 opções de proporção em vez de 3 (ver PROPORCOES_CORREIO acima),
  // com "Original" mantendo o enquadramento da foto sem cortar nada.
  function abrirCorte(arquivo) {
    setSrcCorte(URL.createObjectURL(arquivo));
  }

  function handleFotoChange(e) {
    const arquivo = e.target.files?.[0];
    // Limpa o campo já aqui — sem isso, escolher a MESMA foto de novo
    // (ex.: depois de trocar por outra e desistir) não dispara este evento
    // de novo.
    e.target.value = '';
    if (!arquivo) return;
    setErroEnvio('');
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
  // ficava viva mesmo trocando de foto ou fechando a tela sem enviar.
  // Revoga a anterior sempre que ela muda (nova foto) e também ao desmontar.
  useEffect(() => {
    return () => {
      if (previewFoto) URL.revokeObjectURL(previewFoto);
    };
  }, [previewFoto]);

  // Mesma limpeza acima, mas pra URL bruta usada só na tela de corte.
  useEffect(() => {
    return () => {
      if (srcCorte) URL.revokeObjectURL(srcCorte);
    };
  }, [srcCorte]);

  // ENVIO OTIMISTA (CORREÇÃO DE BUG: foto grande fazia o Correio "não ir").
  // Antes, este handler ficava preso — botão só com um spinner — até
  // TERMINAR compressão da foto + upload + gravação no Firestore, tudo em
  // sequência, antes de qualquer retorno pra tela. Numa foto grande, a
  // compressão sozinha pode levar bem mais que o resto do app pra
  // resolver (ver as 3 camadas com timeout em lib/imageCompress.js —
  // até uns 27s no pior caso, antes mesmo do upload em si), e sem
  // nenhuma pista de progresso isso parecia travado.
  //
  // Agora segue o mesmo padrão de publicar post / enviar missão (ver
  // handlePublicar em CreatePostSheet.js e handleConfirmar em
  // MissionSubmitModal.js): o formulário limpa NA HORA e a compressão
  // padrão do app (mesma de sempre, só o MOMENTO em que ela roda mudou)
  // + upload + envio acontecem em segundo plano, sem travar a tela. Como
  // isso praticamente nunca falha (a não ser sem internet ou foto num
  // formato que o navegador não consegue abrir), o ganho de velocidade
  // percebida vale a troca — e no raro caso de erro, o formulário volta
  // com tudo que a pessoa tinha preenchido, sem precisar redigitar nada
  // (ver catch abaixo).
  async function handleEnviar() {
    if (selecionados.length === 0 || !texto.trim() || emDebounceEnviar()) return;
    setErroEnvio('');

    const rascunho = {
      selecionados,
      texto,
      fixada,
      arquivoFoto,
      anexarRecompensa,
      pontosAnexados,
      dracmasAnexados,
    };

    setTexto('');
    setArquivoFoto(null);
    setPreviewFoto('');
    setFixada(false);
    setAnexarRecompensa(false);
    setPontosAnexados('');
    setDracmasAnexados('');
    setSelecionados([]);
    setEnviado(true);
    setTimeout(() => setEnviado(false), 2000);

    try {
      let fotoURL = '';
      let fotoThumbURL = '';
      if (rascunho.arquivoFoto) {
        const resultado = await uploadFotoCorreioComThumb(perfil.uid, rascunho.arquivoFoto);
        fotoURL = resultado.url;
        fotoThumbURL = resultado.thumbURL;
      }
      const opts = {
        fotoURL,
        fotoThumbURL,
        fixada: rascunho.fixada,
        pontosAnexados: rascunho.anexarRecompensa ? Number(rascunho.pontosAnexados) || 0 : 0,
        dracmasAnexados: rascunho.anexarRecompensa ? Number(rascunho.dracmasAnexados) || 0 : 0,
      };
      if (rascunho.selecionados.length === 1) {
        await sendMailMessage(perfil.uid, rascunho.selecionados[0], rascunho.texto.trim(), opts);
      } else {
        await sendMailToMultiple(perfil.uid, rascunho.selecionados, rascunho.texto.trim(), opts);
      }
    } catch (err) {
      console.error('Erro ao enviar mensagem:', err);
      setEnviado(false);
      // Devolve exatamente o que a pessoa tinha preenchido — nada se perde.
      setSelecionados(rascunho.selecionados);
      setTexto(rascunho.texto);
      setFixada(rascunho.fixada);
      setArquivoFoto(rascunho.arquivoFoto);
      if (rascunho.arquivoFoto) setPreviewFoto(URL.createObjectURL(rascunho.arquivoFoto));
      setAnexarRecompensa(rascunho.anexarRecompensa);
      setPontosAnexados(rascunho.pontosAnexados);
      setDracmasAnexados(rascunho.dracmasAnexados);
      // Antes esse catch só logava no console — o admin via o carregando
      // parar e nada mais, sem nenhuma pista do que aconteceu. Agora
      // mostra uma mensagem no formulário (quando a causa for a foto, ver
      // comprimirImagem em lib/imageCompress.js, a mensagem específica
      // aparece aqui) e também um toast — o formulário já tinha limpado,
      // então a pessoa pode ter saído dele de vista quando o erro raro
      // aparecer.
      setErroEnvio(
        err.message?.includes('comprimir')
          ? err.message
          : 'Não foi possível enviar. Verifique sua internet e tente de novo.'
      );
      mostrarToast('Não foi possível enviar a mensagem. Confira o formulário.');
    }
  }

  // Tela de corte sobrepõe tudo, igual ao Feed (CreatePostSheet.js)
  if (srcCorte) {
    return (
      <ImageCropper
        src={srcCorte}
        razao={{ w: 4, h: 5 }}
        opcoes={PROPORCOES_CORREIO}
        onConfirmar={handleCortado}
        onCancelar={fecharCorte}
      />
    );
  }

  return (
    <div className="space-y-3">
      {/* Item 15º — busca de usuário, pra facilitar achar destinatário numa lista maior */}
      <div className="relative">
        <Search
          size={15}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-coffee-300"
        />
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou @username..."
          className="w-full rounded-lg border border-coffee-100 bg-cream-card py-2 pl-8 pr-3 text-sm text-coffee-800"
        />
      </div>

      <div className="rounded-xl border border-coffee-100 bg-cream-card">
        {/* Item 36 — selecionar todos */}
        <button
          type="button"
          onClick={alternarTodos}
          className="flex w-full items-center gap-2.5 border-b border-coffee-100 px-3.5 py-2.5"
        >
          <span
            className={`flex h-5 w-5 items-center justify-center rounded border ${
              todosSelecionados ? 'border-forte bg-forte text-cream' : 'border-coffee-300'
            }`}
          >
            {todosSelecionados && <Check size={13} />}
          </span>
          <span className="text-sm font-semibold text-coffee-700">
            Selecionar todos ({usuariosFiltrados.length})
          </span>
        </button>
        <div className="max-h-52 overflow-y-auto">
          {usuariosFiltrados.length === 0 && (
            <p className="px-3.5 py-3 text-center text-xs text-coffee-400">
              Ninguém encontrado com esse nome.
            </p>
          )}
          {usuariosFiltrados.map((u) => {
            const marcado = selecionados.includes(u.id);
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => alternarUm(u.id)}
                className="flex w-full items-center gap-2.5 border-b border-coffee-50 px-3.5 py-2 last:border-b-0"
              >
                <span
                  className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border ${
                    marcado ? 'border-forte bg-forte text-cream' : 'border-coffee-300'
                  }`}
                >
                  {marcado && <Check size={13} />}
                </span>
                <Avatar src={u.fotoURL} nome={u.nome} tamanho="sm" />
                <span className="truncate text-sm text-coffee-700">{u.nome}</span>
              </button>
            );
          })}
        </div>
      </div>

      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Escreva a mensagem..."
        rows={4}
        className="w-full resize-none rounded-lg border border-coffee-100 bg-cream-card px-3 py-2.5 text-sm text-coffee-800"
      />

      {/* Item 35 — anexar foto */}
      {previewFoto ? (
        <div className="relative w-32">
          <button type="button" onClick={() => abrirCorte(arquivoFoto)} className="block w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewFoto} alt="Prévia" className="w-full rounded-lg" />
          </button>
          <button
            type="button"
            onClick={() => {
              setArquivoFoto(null);
              setPreviewFoto('');
            }}
            className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-forte-800 text-cream"
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputFotoRef.current?.click()}
          className="rounded-lg border border-dashed border-coffee-200 px-3 py-2 text-xs font-medium text-coffee-500"
        >
          + Anexar foto (opcional)
        </button>
      )}
      <input
        ref={inputFotoRef}
        type="file"
        accept="image/*"
        onChange={handleFotoChange}
        className="hidden"
      />

      {/* Item 34 — fixar no topo */}
      <label className="flex items-center gap-2 text-xs text-coffee-500">
        <input type="checkbox" checked={fixada} onChange={(e) => setFixada(e.target.checked)} />
        Fixar no topo do Correio de quem receber
      </label>

      {/* Item novo — anexar pontos e/ou Dracma à mensagem. Quando marcado, a
          pessoa que receber vê um botão "Receber" no Correio e só ganha o
          valor no momento em que toca nele (ver resgatarRecompensaCorreio
          em lib/notificacoes.js). */}
      <div className="rounded-lg border border-coffee-100 bg-cream-card p-3">
        <label className="flex items-center gap-2 text-sm font-semibold text-coffee-700">
          <input
            type="checkbox"
            checked={anexarRecompensa}
            onChange={(e) => setAnexarRecompensa(e.target.checked)}
          />
          <Gift size={15} className="text-coffee-500" />
          Anexar Pontos/Dracma (a pessoa recebe ao clicar em &quot;Receber&quot;)
        </label>
        {anexarRecompensa && (
          <div className="mt-3 flex gap-3">
            <label className="flex-1">
              <span className="mb-1 flex items-center gap-1 text-xs text-coffee-400">
                <Coins size={12} /> Pontos de Comunhão
              </span>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={pontosAnexados}
                onChange={(e) => setPontosAnexados(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg border border-coffee-100 bg-cream px-3 py-2 text-sm text-coffee-800"
              />
            </label>
            <label className="flex-1">
              <span className="mb-1 flex items-center gap-1 text-xs text-coffee-400">
                <DracmaIcon size={12} /> Dracma
              </span>
              <input
                type="number"
                min="0"
                inputMode="decimal"
                value={dracmasAnexados}
                onChange={(e) => setDracmasAnexados(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg border border-coffee-100 bg-cream px-3 py-2 text-sm text-coffee-800"
              />
            </label>
          </div>
        )}
      </div>

      <button
        onClick={handleEnviar}
        disabled={selecionados.length === 0 || !texto.trim()}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-forte py-2.5 text-sm font-semibold text-cream disabled:opacity-40"
      >
        {enviado
          ? 'Enviado!'
          : `Enviar mensagem${selecionados.length > 1 ? ` (${selecionados.length} pessoas)` : ''}`}
      </button>
      {erroEnvio && <p className="text-center text-xs font-medium text-red-600">{erroEnvio}</p>}

      <HistoricoMensagens usuarios={usuarios} />
    </div>
  );
}

// Item 14º do Bloco 7 — histórico de mensagens enviadas, geral ou por
// pessoa, com exclusão. Fica na mesma aba porque é a mesma área (Correio)
// do painel Admin.
function HistoricoMensagens({ usuarios }) {
  // CORREÇÃO DE BUG: apagar uma mensagem do histórico chamava confirmar(...)
  // sem esse hook estar declarado neste componente (só existia no componente
  // pai, AbaCorreio) — estourava "confirmar is not defined" assim que o
  // admin clicasse pra apagar qualquer mensagem daqui, tanto no modo "geral"
  // quanto "por pessoa".
  const confirmar = useConfirm();
  const [modo, setModo] = useState('geral'); // 'geral' | 'pessoa'
  const [buscaPessoa, setBuscaPessoa] = useState('');
  const [pessoaId, setPessoaId] = useState('');
  const [historico, setHistorico] = useState(null);
  const [apagandoId, setApagandoId] = useState(null);

  useEffect(() => {
    if (modo === 'pessoa' && !pessoaId) {
      setHistorico(null);
      return undefined;
    }
    setHistorico(null);
    const unsub = subscribeToMailHistory(setHistorico, modo === 'pessoa' ? pessoaId : null);
    return () => unsub();
  }, [modo, pessoaId]);

  const pessoasFiltradas = useMemo(() => {
    if (!buscaPessoa.trim()) return usuarios;
    return usuarios.filter(
      (u) => combinaComBusca(u.nome, buscaPessoa) || combinaComBusca(u.username, buscaPessoa)
    );
  }, [usuarios, buscaPessoa]);

  const pessoaSelecionada = usuarios.find((u) => u.id === pessoaId);

  async function handleApagar(msg) {
    const ok = await confirmar({
      titulo: 'Apagar esta mensagem?',
      descricao: 'Some do Correio de quem recebeu (mesmo se estiver fixada).',
      perigo: true,
      labelConfirmar: 'Apagar',
    });
    if (!ok) return;
    setApagandoId(msg.id);
    try {
      await deleteMailMessage(msg.id);
    } catch (err) {
      console.error('Erro ao apagar mensagem:', err);
    } finally {
      setApagandoId(null);
    }
  }

  return (
    <div className="space-y-3 border-t border-coffee-100 pt-5">
      <h3 className="font-destaque text-sm font-semibold text-coffee-700">Histórico de mensagens</h3>

      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => setModo('geral')}
          className={`flex-1 rounded-lg py-2 text-xs font-semibold ${
            modo === 'geral' ? 'bg-forte text-cream' : 'bg-cream-card text-coffee-500'
          }`}
        >
          Geral
        </button>
        <button
          type="button"
          onClick={() => setModo('pessoa')}
          className={`flex-1 rounded-lg py-2 text-xs font-semibold ${
            modo === 'pessoa' ? 'bg-forte text-cream' : 'bg-cream-card text-coffee-500'
          }`}
        >
          Por pessoa
        </button>
      </div>

      {modo === 'pessoa' && (
        <div className="space-y-2">
          <div className="relative">
            <Search
              size={14}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-coffee-300"
            />
            <input
              type="text"
              value={pessoaSelecionada ? pessoaSelecionada.nome : buscaPessoa}
              onChange={(e) => {
                setPessoaId('');
                setBuscaPessoa(e.target.value);
              }}
              placeholder="Buscar pessoa por nome ou @username..."
              className="w-full rounded-lg border border-coffee-100 bg-cream-card py-2 pl-8 pr-3 text-sm text-coffee-800"
            />
          </div>
          {!pessoaId && buscaPessoa.trim() && (
            <div className="max-h-40 overflow-y-auto rounded-lg border border-coffee-100 bg-cream-card">
              {pessoasFiltradas.length === 0 && (
                <p className="px-3 py-2.5 text-center text-xs text-coffee-400">Ninguém encontrado.</p>
              )}
              {pessoasFiltradas.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => {
                    setPessoaId(u.id);
                    setBuscaPessoa('');
                  }}
                  className="flex w-full items-center gap-2.5 border-b border-coffee-50 px-3 py-2 last:border-b-0"
                >
                  <Avatar src={u.fotoURL} nome={u.nome} tamanho="sm" />
                  <span className="truncate text-sm text-coffee-700">{u.nome}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {modo === 'pessoa' && !pessoaId ? (
        <p className="text-xs text-coffee-300">Escolha uma pessoa pra ver o histórico com ela.</p>
      ) : historico === null ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-coffee-100/60" />
          ))}
        </div>
      ) : historico.length === 0 ? (
        <p className="text-xs text-coffee-300">Nenhuma mensagem enviada ainda.</p>
      ) : (
        <div className="space-y-2">
          {historico.map((msg) => {
            const destinatario = usuarios.find((u) => u.id === msg.destinatarioId);
            return (
              <div
                key={msg.id}
                className="flex items-start gap-2.5 rounded-lg border border-coffee-100 bg-cream-card px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 text-xs font-semibold text-coffee-700">
                    {msg.fixada && <Pin size={11} className="text-gold" fill="currentColor" />}
                    {modo === 'geral' ? destinatario?.nome || 'Alguém' : formatDateTimeBR(msg.createdAt)}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-coffee-500">{msg.texto}</p>
                  {modo === 'geral' && (
                    <p className="mt-0.5 text-[11px] text-coffee-300">
                      {msg.createdAt ? formatDateTimeBR(msg.createdAt) : 'agora'}
                    </p>
                  )}
                  {(msg.pontosAnexados > 0 || msg.dracmasAnexados > 0) && (
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-coffee-500">
                      <Gift size={11} />
                      {msg.pontosAnexados > 0 && `${msg.pontosAnexados} pts`}
                      {msg.pontosAnexados > 0 && msg.dracmasAnexados > 0 && ' + '}
                      {msg.dracmasAnexados > 0 && `${formatarDracma(msg.dracmasAnexados)} dracmas`}
                      {' — '}
                      {msg.resgatado ? 'já recebido' : 'ainda não recebido'}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleApagar(msg)}
                  disabled={apagandoId === msg.id}
                  aria-label="Apagar mensagem"
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-coffee-300 hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                >
                  {apagandoId === msg.id ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Trash2 size={13} />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
