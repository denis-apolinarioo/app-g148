export default function LoadingScreen({ mensagem = 'Carregando...' }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-cream">
      <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-coffee-200 border-t-coffee-600" />
      <p className="font-body text-sm text-coffee-400">{mensagem}</p>
    </div>
  );
}
