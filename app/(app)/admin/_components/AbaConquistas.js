'use client';

import { useEffect, useState, useCallback } from 'react';
import * as Icons from 'lucide-react';
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  UploadCloud,
  X,
} from 'lucide-react';
import {
  getTodasAsConquistas,
  criarConquista,
  atualizarConquista,
  apagarConquista,
  trocarOrdem,
  migrarConquistasDoCodigoParaFirestore,
  migrarConquistasNovasParaFirestore,
} from '@/lib/conquistasRepo';
import { getTodasAsMissoes } from '@/lib/missionsRepo';
import { getTodasAsCategoriasAcao } from '@/lib/categoriasAcaoRepo';
import { uploadImagemConquista } from '@/lib/storage';
import { useAuth } from '@/components/AuthProvider';
import IconGalleryPicker from '@/components/IconGalleryPicker';
import ImageCropper from '@/components/ImageCropper';
import { iconePascalCase } from '@/lib/missionIcons';

// Cada opção corresponde a um contadorTipo (ver lib/achievements.js). As
// opções "missao" e "categoria" são especiais: o valor final salvo vira
// "missao:<id da missão>" ou "categoria:<id da categoria>" (ver
// montarContadorTipo/desmontarContadorTipo abaixo). "categoria" é a Fase 2
// (Admin > Categorias) — conta quantas vezes a pessoa fez aquela categoria.
const TIPOS_CONTADOR = [
  { valor: 'streak', label: 'Sequência de dias ativos (streak)' },
  { valor: 'oracao', label: 'Orações (pedidos orados pela pessoa)' },
  { valor: 'post', label: 'Posts publicados no Feed' },
  { valor: 'missao', label: 'Quantidade de vezes que cumpriu uma missão específica' },
  { valor: 'categoria', label: 'Quantidade de vezes que usou uma categoria de ação específica' },
  { valor: 'dracma_saldo', label: 'Saldo atual de Dracma' },
  { valor: 'dracma_enviado:qtd', label: 'Dracma enviado (quantidade de transferências)' },
  { valor: 'dracma_recebido:qtd', label: 'Dracma recebido (quantidade de transferências)' },
  { valor: 'dracma_ganho_total', label: 'Dracma total ganho (histórico, desde sempre)' },
  // ---- adicionados junto com o bloco "25 conquistas novas" ----
  // Os 3 com número embutido no valor (curtidas_por_post:10,
  // categoria_audio_min:musica:60, pedido_e_oracoes:10) usam o MESMO número
  // pros 3 níveis I/II/III — o que muda de nível pra nível é o campo "Meta"
  // (quantos posts/vezes), não esse número embutido. Pra mudar o número
  // embutido (ex.: exigir 15 curtidas por post em vez de 10), é preciso
  // apagar e recriar a conquista com um contador diferente — não editável
  // por aqui.
  { valor: 'curtidas_por_post:10', label: 'Posts próprios que bateram 10 curtidas' },
  { valor: 'curtidas_dadas', label: 'Curtidas dadas (em posts diferentes)' },
  { valor: 'comentarios', label: 'Comentários feitos' },
  { valor: 'dias_3_oracoes', label: 'Dias com as 3 orações diárias no mesmo dia' },
  { valor: 'categoria_audio_min:musica:60', label: 'Posts c/ áudio 1min+ na categoria "musica"' },
  { valor: 'oracao_audio', label: 'Orações diárias enviadas com áudio' },
  { valor: 'madrugada_oracao', label: 'Orações diárias feitas de madrugada' },
  { valor: 'conquistas_desbloqueadas', label: 'Conquistas diferentes já desbloqueadas' },
  { valor: 'cadastro', label: 'Automática no cadastro (1º dia de app)' },
  { valor: 'conta_idade_dias', label: 'Dias desde a criação da conta' },
  { valor: 'pedido_e_oracoes:10', label: 'Fez pedido próprio de oração + orou por 10 pessoas' },
  { valor: 'top1_dias_seguidos', label: 'Dias seguidos em 1º no ranking' },
  { valor: 'manual', label: 'Manual — sem contador automático, eu concedo à mão' },
];

function montarContadorTipo(tipoBase, missaoId, categoriaId) {
  if (tipoBase === 'missao') return `missao:${missaoId || ''}`;
  if (tipoBase === 'categoria') return `categoria:${categoriaId || ''}`;
  return tipoBase;
}

function desmontarContadorTipo(contadorTipo) {
  if ((contadorTipo || '').startsWith('missao:')) {
    return { tipoBase: 'missao', missaoId: contadorTipo.slice('missao:'.length), categoriaId: '' };
  }
  if ((contadorTipo || '').startsWith('categoria:')) {
    return { tipoBase: 'categoria', missaoId: '', categoriaId: contadorTipo.slice('categoria:'.length) };
  }
  return { tipoBase: contadorTipo || 'streak', missaoId: '', categoriaId: '' };
}

function descreverContador(conquista, missoesPorId, categoriasPorId) {
  const { tipoBase, missaoId, categoriaId } = desmontarContadorTipo(conquista.contadorTipo);
  if (tipoBase === 'manual') return 'concedida manualmente';
  if (tipoBase === 'missao') {
    const titulo = missoesPorId[missaoId]?.titulo || missaoId || 'missão apagada';
    return `${conquista.meta}x · ${titulo}`;
  }
  if (tipoBase === 'categoria') {
    const nome = categoriasPorId[categoriaId]?.nome || categoriaId || 'categoria apagada';
    return `${conquista.meta}x · categoria "${nome}"`;
  }
  const opcao = TIPOS_CONTADOR.find((t) => t.valor === tipoBase);
  return `${conquista.meta} · ${opcao?.label || tipoBase}`;
}

export default function AbaConquistas() {
  const { perfil } = useAuth();
  const [conquistas, setConquistas] = useState(null);
  const [missoes, setMissoes] = useState([]);
  const [categoriasAcao, setCategoriasAcao] = useState([]);
  const [migrando, setMigrando] = useState(false);
  const [resultadoMigracao, setResultadoMigracao] = useState(null);
  const [migrandoNovas, setMigrandoNovas] = useState(false);
  const [resultadoMigracaoNovas, setResultadoMigracaoNovas] = useState(null);
  const [conquistaEditando, setConquistaEditando] = useState(null); // objeto = editar, 'nova' = criar
  const [apagando, setApagando] = useState(null);

  const carregar = useCallback(() => {
    getTodasAsConquistas().then(setConquistas);
    getTodasAsMissoes().then(setMissoes);
    getTodasAsCategoriasAcao().then(setCategoriasAcao);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const missoesPorId = Object.fromEntries(missoes.map((m) => [m.id, m]));
  const categoriasPorId = Object.fromEntries(categoriasAcao.map((c) => [c.id, c]));

  async function handleMigrar() {
    if (migrando) return;
    setMigrando(true);
    setResultadoMigracao(null);
    try {
      const criadas = await migrarConquistasDoCodigoParaFirestore();
      setResultadoMigracao(
        criadas > 0
          ? `${criadas} conquista(s) migrada(s) com sucesso.`
          : 'Nada pra migrar — todas as conquistas do código já estavam aqui.'
      );
      carregar();
    } catch (err) {
      console.error('Erro na migração de conquistas:', err);
      setResultadoMigracao('Não foi possível migrar agora. Tente de novo em instantes.');
    } finally {
      setMigrando(false);
    }
  }

  async function handleMigrarNovas() {
    if (migrandoNovas) return;
    setMigrandoNovas(true);
    setResultadoMigracaoNovas(null);
    try {
      const criadas = await migrarConquistasNovasParaFirestore();
      setResultadoMigracaoNovas(
        criadas > 0
          ? `${criadas} conquista(s) nova(s) criada(s) com sucesso.`
          : 'Nada pra criar — as 25 conquistas novas já estavam aqui.'
      );
      carregar();
    } catch (err) {
      console.error('Erro na migração das conquistas novas:', err);
      setResultadoMigracaoNovas('Não foi possível criar agora. Tente de novo em instantes.');
    } finally {
      setMigrandoNovas(false);
    }
  }

  async function handleApagar(conquista) {
    if (
      !confirm(
        `Apagar a conquista "${conquista.nome}"? Quem já desbloqueou continua com ela — só sai do catálogo pra quem ainda não tinha.`
      )
    )
      return;
    setApagando(conquista.id);
    try {
      await apagarConquista(conquista.id, perfil, conquista.nome);
      carregar();
    } catch (err) {
      console.error('Erro ao apagar conquista:', err);
    } finally {
      setApagando(null);
    }
  }

  async function handleMover(index, direcao) {
    const alvo = index + direcao;
    if (!conquistas || alvo < 0 || alvo >= conquistas.length) return;
    try {
      await trocarOrdem(conquistas[index], conquistas[alvo]);
      carregar();
    } catch (err) {
      console.error('Erro ao reordenar conquista:', err);
    }
  }

  if (!conquistas) return <div className="h-40 animate-pulse rounded-xl2 bg-coffee-100/60" />;

  return (
    <div className="space-y-6">
      <div className="rounded-xl2 border border-coffee-100 bg-cream-card p-4">
        <p className="text-xs text-coffee-500">
          Se você acabou de ativar isso, clique aqui uma vez pra trazer as conquistas que já
          existiam no código pra dentro desta lista. É seguro clicar mais de uma vez — só cria o
          que ainda não existir.
        </p>
        <button
          onClick={handleMigrar}
          disabled={migrando}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-coffee-200 py-2.5 text-sm font-semibold text-coffee-700 disabled:opacity-40"
        >
          {migrando ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
          Migrar conquistas do código
        </button>
        {resultadoMigracao && (
          <p className="mt-2 text-center text-xs text-coffee-500">{resultadoMigracao}</p>
        )}
      </div>

      <div className="rounded-xl2 border border-coffee-100 bg-cream-card p-4">
        <p className="text-xs text-coffee-500">
          Clique aqui pra criar de uma vez as 25 conquistas novas (com os níveis I/II/III de cada
          uma — 65 no total). Depois de criadas, edite ou apague à vontade aqui embaixo, igual
          qualquer outra conquista. Seguro clicar mais de uma vez — só cria o que ainda não
          existir.
        </p>
        <button
          onClick={handleMigrarNovas}
          disabled={migrandoNovas}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-coffee-200 py-2.5 text-sm font-semibold text-coffee-700 disabled:opacity-40"
        >
          {migrandoNovas ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
          Criar as 25 conquistas novas
        </button>
        {resultadoMigracaoNovas && (
          <p className="mt-2 text-center text-xs text-coffee-500">{resultadoMigracaoNovas}</p>
        )}
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="font-destaque text-sm font-semibold text-coffee-700">Conquistas</h3>
          <button
            onClick={() => setConquistaEditando('nova')}
            className="flex items-center gap-1 text-xs font-semibold text-coffee-600"
          >
            <Plus size={13} /> Nova
          </button>
        </div>
        <p className="mb-2 text-[11px] text-coffee-300">
          Aparecem em círculo na aba de conquistas do perfil, de 5 em 5 por linha.
        </p>

        {conquistas.length === 0 && (
          <p className="text-xs text-coffee-300">Nenhuma conquista cadastrada ainda.</p>
        )}

        <div className="space-y-2">
          {conquistas.map((conquista, index) => {
            const Icone = Icons[iconePascalCase(conquista.icone)] || Icons.Award;
            return (
              <div
                key={conquista.id}
                className={`flex items-center gap-2 rounded-xl border border-coffee-100 bg-cream-card px-3.5 py-2.5 ${
                  conquista.ativa === false ? 'opacity-50' : ''
                }`}
              >
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
                    disabled={index === conquistas.length - 1}
                    className="text-coffee-300 disabled:opacity-20"
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>

                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gold to-coffee-600">
                  {conquista.imagemURL ? (
                    <img
                      src={conquista.imagemURL}
                      alt=""
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    <Icone size={17} strokeWidth={1.8} className="text-cream" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-coffee-800">
                    {conquista.nome}
                    {conquista.ativa === false && (
                      <span className="ml-1.5 text-[10px] font-medium text-coffee-400">(inativa)</span>
                    )}
                  </p>
                  <p className="truncate text-xs text-coffee-400">
                    {descreverContador(conquista, missoesPorId, categoriasPorId)}
                  </p>
                </div>

                <button
                  onClick={() => setConquistaEditando(conquista)}
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-coffee-200 text-coffee-600"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => handleApagar(conquista)}
                  disabled={apagando === conquista.id}
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-coffee-200 text-red-600 disabled:opacity-40"
                >
                  {apagando === conquista.id ? (
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

      {conquistaEditando && (
        <ConquistaFormModal
          conquistaInicial={conquistaEditando === 'nova' ? null : conquistaEditando}
          missoes={missoes}
          categoriasAcao={categoriasAcao}
          onFechar={() => setConquistaEditando(null)}
          onSalvo={() => {
            setConquistaEditando(null);
            carregar();
          }}
        />
      )}
    </div>
  );
}

function Campo({ label, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-coffee-500">{label}</label>
      {children}
    </div>
  );
}

function ConquistaFormModal({ conquistaInicial, missoes, categoriasAcao, onFechar, onSalvo }) {
  const { perfil } = useAuth();
  const editando = !!conquistaInicial;
  const iniciais = desmontarContadorTipo(conquistaInicial?.contadorTipo);

  const [nome, setNome] = useState(conquistaInicial?.nome || '');
  const [descricao, setDescricao] = useState(conquistaInicial?.descricao || '');
  const [icone, setIcone] = useState(conquistaInicial?.icone || 'award');
  const [tipoBase, setTipoBase] = useState(iniciais.tipoBase);
  const [missaoId, setMissaoId] = useState(iniciais.missaoId);
  const [categoriaId, setCategoriaId] = useState(iniciais.categoriaId);
  const [meta, setMeta] = useState(conquistaInicial?.meta ?? 10);
  const [ativa, setAtiva] = useState(conquistaInicial?.ativa ?? true);

  const [previewImagem, setPreviewImagem] = useState(conquistaInicial?.imagemURL || '');
  const [arquivoImagem, setArquivoImagem] = useState(null);
  const [srcCorte, setSrcCorte] = useState('');

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    return () => {
      if (srcCorte) URL.revokeObjectURL(srcCorte);
    };
  }, [srcCorte]);
  useEffect(() => {
    return () => {
      if (arquivoImagem && previewImagem) URL.revokeObjectURL(previewImagem);
    };
  }, [arquivoImagem, previewImagem]);

  function handleEscolherImagem(e) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setSrcCorte(URL.createObjectURL(arquivo));
    e.target.value = '';
  }

  function handleCortado(blob) {
    setSrcCorte('');
    const file = new File([blob], 'conquista.jpg', { type: 'image/jpeg' });
    setArquivoImagem(file);
    setPreviewImagem(URL.createObjectURL(blob));
  }

  async function handleSalvar() {
    if (!nome.trim() || salvando) return;
    setSalvando(true);
    setErro('');
    try {
      const dados = {
        nome: nome.trim(),
        descricao: descricao.trim(),
        icone,
        contadorTipo: montarContadorTipo(tipoBase, missaoId, categoriaId),
        meta: tipoBase === 'manual' ? null : Number(meta) || 0,
        ativa,
      };

      let idFinal;
      if (editando) {
        idFinal = conquistaInicial.id;
        await atualizarConquista(idFinal, dados, perfil);
      } else {
        idFinal = await criarConquista(dados, null, perfil);
      }

      if (arquivoImagem) {
        const imagemURL = await uploadImagemConquista(idFinal, arquivoImagem);
        await atualizarConquista(idFinal, { imagemURL }, perfil);
      }

      onSalvo();
    } catch (err) {
      console.error('Erro ao salvar conquista:', err);
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
        onConfirmar={handleCortado}
        onCancelar={() => setSrcCorte('')}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-coffee-900/40 sm:items-center">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-cream sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-coffee-100 px-5 py-4">
          <h3 className="font-destaque text-base font-semibold text-coffee-800">
            {editando ? 'Editar conquista' : 'Nova conquista'}
          </h3>
          <button onClick={onFechar} className="text-coffee-400">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <Campo label="Imagem circular (opcional — sem imagem, usa o ícone abaixo)">
            <div className="flex items-center gap-3">
              <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-gold to-coffee-600">
                {previewImagem ? (
                  <img src={previewImagem} alt="" className="h-full w-full object-cover" />
                ) : (
                  (() => {
                    const IconePreview = Icons[iconePascalCase(icone)] || Icons.Award;
                    return <IconePreview size={22} className="text-cream" strokeWidth={1.8} />;
                  })()
                )}
              </span>
              <label className="cursor-pointer rounded-lg border border-coffee-200 px-3 py-2 text-xs font-semibold text-coffee-700">
                {previewImagem ? 'Trocar imagem' : 'Enviar imagem'}
                <input type="file" accept="image/*" onChange={handleEscolherImagem} className="hidden" />
              </label>
              {previewImagem && (
                <button
                  type="button"
                  onClick={() => {
                    setPreviewImagem('');
                    setArquivoImagem(null);
                  }}
                  className="text-xs text-coffee-400 underline"
                >
                  Remover
                </button>
              )}
            </div>
          </Campo>

          <Campo label="Ícone de reserva (usado enquanto não há imagem)">
            <IconGalleryPicker value={icone} onChange={(valor) => setIcone(valor || 'award')} />
          </Campo>

          <Campo label="Nome">
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Terminei a Carreira"
              className="w-full rounded-lg border border-coffee-100 bg-cream-card px-3 py-2.5 text-sm text-coffee-800"
            />
          </Campo>

          <Campo label="Texto (aparece quando a pessoa toca na conquista)">
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
              placeholder="Ex: Completou 1 ano de app."
              className="w-full rounded-lg border border-coffee-100 bg-cream-card px-3 py-2.5 text-sm text-coffee-800"
            />
          </Campo>

          <Campo label="O que conta pra essa conquista">
            <select
              value={tipoBase}
              onChange={(e) => setTipoBase(e.target.value)}
              className="w-full rounded-lg border border-coffee-100 bg-cream-card px-3 py-2.5 text-sm text-coffee-800"
            >
              {TIPOS_CONTADOR.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.label}
                </option>
              ))}
            </select>
          </Campo>

          {tipoBase === 'missao' && (
            <Campo label="Qual missão">
              <select
                value={missaoId}
                onChange={(e) => setMissaoId(e.target.value)}
                className="w-full rounded-lg border border-coffee-100 bg-cream-card px-3 py-2.5 text-sm text-coffee-800"
              >
                <option value="">Selecione…</option>
                {missoes.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.titulo}
                  </option>
                ))}
              </select>
            </Campo>
          )}

          {tipoBase === 'categoria' && (
            <Campo label="Qual categoria de ação">
              <select
                value={categoriaId}
                onChange={(e) => setCategoriaId(e.target.value)}
                className="w-full rounded-lg border border-coffee-100 bg-cream-card px-3 py-2.5 text-sm text-coffee-800"
              >
                <option value="">Selecione…</option>
                {categoriasAcao.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
              {categoriasAcao.length === 0 && (
                <p className="mt-1.5 text-[11px] text-coffee-400">
                  Nenhuma categoria criada ainda — vá na aba Categorias primeiro.
                </p>
              )}
            </Campo>
          )}

          {tipoBase !== 'manual' && (
            <Campo label="Quantas vezes é preciso fazer (meta)">
              <input
                type="number"
                min="1"
                value={meta}
                onChange={(e) => setMeta(e.target.value)}
                className="w-full rounded-lg border border-coffee-100 bg-cream-card px-3 py-2.5 text-sm text-coffee-800"
              />
            </Campo>
          )}

          {tipoBase === 'manual' && (
            <p className="text-xs text-coffee-400">
              Conquista manual não é desbloqueada sozinha — precisa ser concedida à mão (recurso
              ainda não tem uma tela própria; por enquanto é feito direto no Firestore).
            </p>
          )}

          <label className="flex items-center gap-2 text-xs text-coffee-500">
            <input type="checkbox" checked={ativa} onChange={(e) => setAtiva(e.target.checked)} />
            Ativa (entra no catálogo e passa a valer pra quem usa o app)
          </label>

          {erro && <p className="text-center text-sm text-red-700">{erro}</p>}

          <button
            onClick={handleSalvar}
            disabled={!nome.trim() || salvando}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-coffee-700 py-3 text-sm font-semibold text-cream disabled:opacity-40"
          >
            {salvando && <Loader2 size={14} className="animate-spin" />}
            {editando ? 'Salvar alterações' : 'Criar conquista'}
          </button>
        </div>
      </div>
    </div>
  );
}
