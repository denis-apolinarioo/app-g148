import TopBar from '@/components/TopBar';

export default function TermosPage() {
  return (
    <div className="mx-auto max-w-md">
      <TopBar titulo="Termos de Uso" voltarPara="/perfil" />

      <div className="space-y-5 px-5 py-6 text-sm leading-relaxed text-coffee-600">
        <section>
          <h2 className="mb-1.5 font-display text-base font-medium text-coffee-800">
            Sobre este app
          </h2>
          <p>
            O G148 é um aplicativo de uso interno da comunidade de jovens Geração 148, criado
            para fortalecer a vida espiritual, a comunhão e o acompanhamento das atividades do
            grupo. Não é um produto comercial e não é afiliado a nenhuma empresa fora da
            comunidade.
          </p>
        </section>

        <section>
          <h2 className="mb-1.5 font-display text-base font-medium text-coffee-800">
            Uso da conta
          </h2>
          <p>
            Cada pessoa é responsável pelas informações que publica no Mural, nos pedidos de
            oração e em qualquer outra área do app. Conteúdo ofensivo, desrespeitoso ou fora do
            propósito da comunidade pode ser removido pela administração a qualquer momento.
          </p>
        </section>

        <section>
          <h2 className="mb-1.5 font-display text-base font-medium text-coffee-800">
            Seus dados
          </h2>
          <p>
            Guardamos apenas as informações necessárias para o funcionamento do app: nome,
            foto, data de nascimento, e-mail de login e o conteúdo que você publica (posts,
            pedidos de oração, respostas de missões). Esses dados ficam armazenados no Firebase
            (Google) e são visíveis apenas para outros membros autenticados da comunidade — o
            app não é público na internet.
          </p>
        </section>

        <section>
          <h2 className="mb-1.5 font-display text-base font-medium text-coffee-800">
            Exclusão de conta
          </h2>
          <p>
            Se você quiser sair da comunidade e apagar seus dados, entre em contato com a
            administração do app para solicitar a exclusão da sua conta e do seu conteúdo.
          </p>
        </section>

        <section>
          <h2 className="mb-1.5 font-display text-base font-medium text-coffee-800">
            Alterações
          </h2>
          <p>
            Este texto pode ser atualizado conforme o app evolui. Mudanças importantes serão
            comunicadas pelo Correio dentro do próprio app.
          </p>
        </section>
      </div>
    </div>
  );
}
