'use client';

import { useEffect, useState, useCallback } from 'react';
import * as Icons from 'lucide-react';
import { Loader2, Plus, Pencil, Trash2, X, Star, Lock } from 'lucide-react';
import {
  getTodosOsPresets,
  criarPreset,
  atualizarPreset,
  apagarPreset,
} from '@/lib/presetsEsteticaRepo';
import { CHAVE_PRESET_PADRAO, salvarConfiguracoesApp } from '@/lib/appConfig';
import { useAppConfig } from '@/lib/useAppConfig';
import { gerarPaletaCompleta } from '@/lib/paletaGerador';
import { iconePascalCase } from '@/lib/missionIcons';
import IconGalleryPicker from '@/components/IconGalleryPicker';
import RoletaCor from '@/components/RoletaCor';
import { useAuth } from '@/components/AuthProvider';
import { useConfirm } from '@/components/ConfirmProvider';

export default function AbaEstetica() {
  const { perfil } = useAuth();
  const confirmar = useConfirm();
  const config = useAppConfig();
  const [presets, setPresets] = useState(null);
  const [presetEditando, setPresetEditando] = useState(null); // objeto = editar, 'novo' = criar
  const [apagando, setApagando] = useState(null);
  const [definindoPadrao, setDefinindoPadrao] = useState(null);

  const carregar = useCallback(() => {
    getTodosOsPresets().then(setPresets);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const presetPadraoId = config?.[CHAVE_PRESET_PADRAO] || 'claro';

  async function handleApagar(preset) {
    const ok = await confirmar({
      titulo: `Apagar o preset "${preset.nome}"?`,
      descricao:
        'Quem estava usando essa cor nesse aparelho volta pro preset padrão do app na próxima abertura. Essa ação não pode ser desfeita.',
      perigo: true,
      labelConfirmar: 'Apagar',
    });
    if (!ok) return;

    setApagando(preset.id);
    try {
      await apagarPreset(preset.id, perfil, preset.nome);
      carregar();
    } catch (err) {
      console.error('Erro ao apagar preset:', err);
    } finally {
      setApagando(null);
    }
  }

  async function handleDefinirPadrao(preset) {
    if (definindoPadrao) return;
    setDefinindoPadrao(preset.id);
    try {
      await salvarConfiguracoesApp({ [CHAVE_PRESET_PADRAO]: preset.id }, perfil);
    } catch (err) {
      console.error('Erro ao definir preset padrão:', err);
    } finally {
      setDefinindoPadrao(null);
    }
  }

  if (!presets) return <div className="h-40 animate-pulse rounded-xl2 bg-coffee-100/60" />;

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="font-destaque text-sm font-semibold text-coffee-700">Estética</h3>
          <button
            onClick={() => setPresetEditando('novo')}
            className="flex items-center gap-1 text-xs font-semibold text-coffee-600"
          >
            <Plus size={13} /> Novo preset
          </button>
        </div>
        <p className="mb-2 text-[11px] text-coffee-300">
          Cada pessoa pode escolher, no próprio Perfil, qualquer preset ATIVO daqui. A estrela
          marca o preset PADRÃO do app — quem ainda não escolheu um no aparelho vê esse. Presets
          inativos somem do seletor, mas quem já tinha escolhido continua com ele até trocar.
        </p>

        {presets.length === 0 && (
          <p className="text-xs text-coffee-300">Nenhum preset cadastrado ainda.</p>
        )}

        <div className="space-y-2">
          {presets.map((preset) => {
            const IconePreset = preset.icone ? Icons[iconePascalCase(preset.icone)] : null;
            const ehPadrao = preset.id === presetPadraoId;
            return (
              <div
                key={preset.id}
                className={`flex items-center gap-3 rounded-xl border border-coffee-100 bg-cream-card px-3.5 py-3 ${
                  preset.ativo === false ? 'opacity-50' : ''
                }`}
              >
                <PreviaCores preset={preset} />

                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-coffee-50">
                  {IconePreset ? (
                    <IconePreset size={16} className="text-coffee-600" />
                  ) : (
                    <span className="h-4 w-4 rounded-full bg-coffee-300" />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-coffee-800">
                    {preset.nome}
                    {preset.protegido && <Lock size={11} className="flex-shrink-0 text-coffee-300" />}
                  </p>
                  <p className="text-[11px] text-coffee-400">
                    {preset.ativo === false ? 'Inativo' : ehPadrao ? 'Padrão do app' : 'Ativo'}
                  </p>
                </div>

                <button
                  onClick={() => handleDefinirPadrao(preset)}
                  disabled={ehPadrao || preset.ativo === false || definindoPadrao === preset.id}
                  aria-label="Definir como padrão do app"
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-coffee-200 text-coffee-600 disabled:opacity-30"
                >
                  {definindoPadrao === preset.id ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Star size={13} className={ehPadrao ? 'fill-gold text-gold' : ''} />
                  )}
                </button>
                <button
                  onClick={() => setPresetEditando(preset)}
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-coffee-200 text-coffee-600"
                >
                  <Pencil size={13} />
                </button>
                {!preset.protegido && (
                  <button
                    onClick={() => handleApagar(preset)}
                    disabled={apagando === preset.id}
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-coffee-200 text-red-600 disabled:opacity-40"
                  >
                    {apagando === preset.id ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Trash2 size={13} />
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {presetEditando && (
        <PresetFormModal
          presetInicial={presetEditando === 'novo' ? null : presetEditando}
          onFechar={() => setPresetEditando(null)}
          onSalvo={() => {
            setPresetEditando(null);
            carregar();
          }}
        />
      )}
    </div>
  );
}

/** Tira 4 (as cores-base) da paleta do preset e mostra como bolinhas —
 * dá pra reconhecer o preset na lista sem precisar abrir pra editar. */
function PreviaCores({ preset }) {
  const cores = preset.coresBase
    ? [preset.coresBase.fundo, preset.coresBase.principal, preset.coresBase.destaque]
    : [preset.variaveis?.cream, preset.variaveis?.coffee700, preset.variaveis?.gold];
  return (
    <div className="flex flex-shrink-0 -space-x-1.5">
      {cores.map((cor, i) => (
        <span
          key={i}
          className="h-5 w-5 rounded-full border-2 border-cream-card"
          style={{ backgroundColor: cor || '#CBAD8A' }}
        />
      ))}
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

function CampoCor({ label, valor, onChange }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-coffee-500">{label}</label>
      <RoletaCor valor={valor} onChange={onChange} />
    </div>
  );
}

function PresetFormModal({ presetInicial, onFechar, onSalvo }) {
  const { perfil } = useAuth();
  const editando = !!presetInicial;

  const [nome, setNome] = useState(presetInicial?.nome || '');
  const [icone, setIcone] = useState(presetInicial?.icone || 'palette');
  const [ativo, setAtivo] = useState(presetInicial?.ativo ?? true);
  const [coresBase, setCoresBase] = useState(
    presetInicial?.coresBase || { fundo: '#FAF6EF', cartao: '#FFFDF9', principal: '#6B4A2F', destaque: '#B8863B' }
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  function atualizarCor(chave, valor) {
    setCoresBase((atual) => ({ ...atual, [chave]: valor }));
  }

  async function handleSalvar() {
    if (!nome.trim() || salvando) return;
    setSalvando(true);
    setErro('');
    try {
      const dados = { nome: nome.trim(), icone, ativo, coresBase };
      if (editando) {
        await atualizarPreset(presetInicial.id, dados, perfil);
      } else {
        await criarPreset(dados, perfil);
      }
      onSalvo();
    } catch (err) {
      console.error('Erro ao salvar preset:', err);
      setErro('Não foi possível salvar agora. Verifique sua internet e tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  // Prévia ao vivo — recalcula a paleta inteira a cada mudança de cor, só
  // pra mostrar (não salva nada até "Salvar").
  const previa = gerarPaletaCompleta(coresBase);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-forte-900/40 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-cream sm:rounded-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-coffee-100 bg-cream px-5 py-4">
          <h3 className="font-destaque text-base font-semibold text-coffee-800">
            {editando ? 'Editar preset' : 'Novo preset'}
          </h3>
          <button onClick={onFechar} className="text-coffee-400">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <Campo label="Nome">
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Azul, Natal, Aniversário G148..."
              className="w-full rounded-lg border border-coffee-100 bg-cream-card px-3 py-2.5 text-sm text-coffee-800"
            />
          </Campo>

          <Campo label="Ícone">
            <IconGalleryPicker value={icone} onChange={(v) => setIcone(v || 'palette')} />
          </Campo>

          {/* Item novo — pilha de 1 coluna: a roleta de cor precisa de mais
              espaço horizontal (roda + hex + barra de luminosidade lado a
              lado) do que o antigo swatch simples cabia num grid de 2
              colunas apertado. */}
          <div className="space-y-4">
            <CampoCor label="Fundo" valor={coresBase.fundo} onChange={(v) => atualizarCor('fundo', v)} />
            <CampoCor label="Cartões" valor={coresBase.cartao} onChange={(v) => atualizarCor('cartao', v)} />
            <CampoCor
              label="Principal"
              valor={coresBase.principal}
              onChange={(v) => atualizarCor('principal', v)}
            />
            <CampoCor
              label="Destaque"
              valor={coresBase.destaque}
              onChange={(v) => atualizarCor('destaque', v)}
            />
          </div>
          <p className="text-[11px] text-coffee-300">
            Fundo e Cartões são usados exatamente como escolhidos. Principal e Destaque geram o
            resto da paleta (textos, bordas, botões) automaticamente, de forma coerente com o
            tom do Fundo.
          </p>

          {/* Prévia ao vivo, isolada num quadro com a própria paleta (via
              variável CSS inline) — não mexe na cor do resto da tela do
              Admin enquanto a pessoa está só experimentando. */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-coffee-500">Prévia</label>
            <div
              className="space-y-2 rounded-xl border p-3.5"
              style={{
                '--cor-cream': hexParaRgbStr(previa.variaveis.cream),
                '--cor-cream-card': hexParaRgbStr(previa.variaveis.creamCard),
                '--cor-coffee-100': hexParaRgbStr(previa.variaveis.coffee100),
                '--cor-coffee-700': hexParaRgbStr(previa.variaveis.coffee700),
                '--cor-coffee-800': hexParaRgbStr(previa.variaveis.coffee800),
                '--cor-forte': hexParaRgbStr(previa.variaveis.forte),
                '--cor-gold': hexParaRgbStr(previa.variaveis.gold),
                backgroundColor: 'rgb(var(--cor-cream))',
                borderColor: 'rgb(var(--cor-coffee-100))',
              }}
            >
              <div
                className="rounded-lg p-3"
                style={{ backgroundColor: 'rgb(var(--cor-cream-card))', border: '1px solid rgb(var(--cor-coffee-100))' }}
              >
                <p style={{ color: 'rgb(var(--cor-coffee-800))', fontWeight: 600, fontSize: '0.875rem' }}>
                  Assim vai ficar um cartão
                </p>
                <p style={{ color: 'rgb(var(--cor-coffee-700))', fontSize: '0.8rem', marginTop: '0.2rem' }}>
                  Texto normal de exemplo, pra ver a legibilidade.
                </p>
              </div>
              <button
                type="button"
                disabled
                style={{
                  backgroundColor: 'rgb(var(--cor-forte))',
                  color: '#FFFDF9',
                  borderRadius: '0.75rem',
                  padding: '0.5rem 1rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                }}
              >
                Botão de exemplo
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-coffee-500">
            <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
            Ativo (aparece como opção no seletor de Perfil)
          </label>

          {erro && <p className="text-center text-sm text-red-700">{erro}</p>}

          <button
            onClick={handleSalvar}
            disabled={!nome.trim() || salvando}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-forte py-3 text-sm font-semibold text-cream disabled:opacity-40"
          >
            {salvando && <Loader2 size={14} className="animate-spin" />}
            {editando ? 'Salvar alterações' : 'Criar preset'}
          </button>
        </div>
      </div>
    </div>
  );
}

function hexParaRgbStr(hex) {
  if (!hex) return '0 0 0';
  const h = hex.replace('#', '');
  return `${parseInt(h.substring(0, 2), 16)} ${parseInt(h.substring(2, 4), 16)} ${parseInt(h.substring(4, 6), 16)}`;
}
