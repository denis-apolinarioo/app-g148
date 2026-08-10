export default function EmptyState({ icone: Icone, titulo, descricao, compacto = false }) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 px-8 text-center ${
        compacto ? 'py-8' : 'py-16'
      }`}
    >
      {Icone && (
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-coffee-50">
          <Icone size={26} strokeWidth={1.5} className="text-coffee-400" />
        </div>
      )}
      <p className="font-destaque text-base font-semibold text-coffee-700">{titulo}</p>
      {descricao && <p className="max-w-xs text-sm text-coffee-400">{descricao}</p>}
    </div>
  );
}
