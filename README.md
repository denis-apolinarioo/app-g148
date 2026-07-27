# App G148 — Guia de Publicação (sem programar nada)

Esse guia assume que você já tem conta criada em **GitHub**, **Firebase** e
**Vercel** (se ainda não tem, veja o rodapé deste arquivo).

---

## Passo 1 — Subir o código pro GitHub

1. Extraia (descompacte) o arquivo `.zip` que você baixou, em qualquer pasta
   do seu computador.
2. Entre no repositório que você já criou no GitHub (`app-g148` ou o nome
   que você escolheu).
3. Clique em **"Add file" → "Upload files"**.
4. Abra a pasta extraída no seu computador, selecione **todos os arquivos e
   pastas de dentro dela** (Ctrl+A) e arraste pra dentro da área de upload
   do GitHub.
   - ⚠️ Arraste o **conteúdo de dentro** da pasta `app-g148`, não a pasta
     `app-g148` em si — senão os arquivos ficam uma "gaveta" a mais dentro
     do repositório e a Vercel não encontra o projeto.
5. Espere o upload terminar (pode demorar 1-2 minutos) e clique em
   **"Commit changes"**.

## Passo 2 — Publicar na Vercel

1. Entre na Vercel → **"Add New" → "Project"**.
2. Escolha o repositório `app-g148` na lista e clique em **"Import"**.
3. Não precisa mexer em nenhuma configuração — a Vercel já reconhece que é
   um projeto Next.js automaticamente.
4. Clique em **"Deploy"**.
5. Espere 1-2 minutos. Quando aparecer a tela de confete 🎉, seu app está
   no ar! A Vercel te dá um link tipo `app-g148.vercel.app`.

## Passo 3 — Aplicar as regras de segurança no Firebase

Isso é essencial — sem esse passo, o banco de dados fica com as regras de
"modo de teste" (temporárias) e vai parar de funcionar em 30 dias.

**Firestore:**
1. No Firebase Console, vá em **Firestore Database → Regras**.
2. Apague todo o conteúdo que estiver lá.
3. Abra o arquivo `firestore.rules` (está na pasta que você extraiu) num
   bloco de notas, copie tudo, e cole no lugar.
4. Clique em **"Publicar"**.

**Storage:**
1. Antes disso, você precisa upgradar o projeto pro plano **Blaze** (Firebase
   Console → ⚙️ Configurações → Uso e faturamento → "Modificar plano" →
   Blaze → cadastrar cartão). Sem isso, fotos e áudios não funcionam.
2. Depois do upgrade, vá em **Storage** (se for a primeira vez, clique em
   "Vamos começar" e aceite as opções padrão).
3. Vá na aba **Regras**, apague o conteúdo, cole o que está no arquivo
   `storage.rules`, e clique em **"Publicar"**.

## Passo 4 — Tornar você (Denis) o primeiro admin

Como nenhum admin existe ainda, esse passo só pode ser feito manualmente,
uma única vez, direto no banco:

1. Abra o app publicado (link da Vercel) e crie sua conta normalmente
   (Google ou e-mail).
2. No Firebase Console, vá em **Firestore Database → Dados**.
3. Abra a coleção `users` e clique no documento com o seu `uid` (você
   reconhece pelo seu nome/username nos campos).
4. Clique no campo `isAdmin`, mude o valor de `false` para `true`, e
   confirme.
5. Feche e reabra o app — o ícone de escudo (Painel Admin) já aparece no
   seu perfil.

## Passo 5 — Testar

Abra o link em modo anônimo (ou peça pra alguém de confiança testar) e
percorra: cadastro → postar no mural → cumprir uma missão → fazer um
pedido de oração → ver o ranking. Qualquer erro, me manda o print de tela
inteira (com a mensagem de erro, se aparecer) que eu já te digo o que
ajustar.

---

## Sobre atualizações futuras

Sempre que eu te passar arquivos novos ou alterados, o processo é sempre o
mesmo: subir os arquivos atualizados pro GitHub (mesmo processo do Passo 1,
o GitHub substitui automaticamente os arquivos antigos pelos novos) → a
Vercel republica sozinha em menos de 1 minuto.

## O que fica de fora dessa v1 (propositalmente)

Pra garantir que o essencial saísse **funcionando e sem bugs** dentro do
prazo, ficaram de fora por enquanto (e podem entrar depois, sem
retrabalho):
- Notificações push (fora do app, tipo notificação de celular)
- Vídeo no Mural (só foto e áudio por ora, pelos motivos de custo que já
  conversamos)
- Interface visual pra criar missões novas do zero (dá pra ajustar
  *pontos* das missões existentes pelo Painel Admin; criar uma missão
  totalmente nova ainda exige eu editar o código)
- Promover alguém a admin pelo próprio app (por segurança, ainda é manual
  pelo Firebase Console — Passo 4 acima)
- Rotatividade de grupos nas missões coletivas

## Como funciona a segurança dos pontos (leia isso)

O app usa Firestore + regras de segurança, mas **não usa Cloud Functions**
(que exigiria linha de comando pra publicar — incompatível com o fluxo 100%
arrastar-e-soltar que combinamos). Isso significa que a pontuação é gravada
pelo próprio aplicativo da pessoa, com proteções fortes contra os erros
mais comuns (duplo envio, corrida de cliques simultâneos), mas sem ser
"à prova de hacker" no sentido mais técnico. Pra uma comunidade pequena e de
confiança (25-50 pessoas conhecidas), isso é adequado. Se um dia quiser
fechar essa brecha por completo, me avisa — é uma evolução natural de v2.

---

## Se ainda não tem as contas

- **GitHub**: github.com → criar conta grátis
- **Firebase**: firebase.google.com → entrar com sua conta Google → criar
  projeto → ativar Authentication (Google + E-mail/senha) e Firestore
  Database (modo de teste)
- **Vercel**: vercel.com → criar conta com "Continue com GitHub"
