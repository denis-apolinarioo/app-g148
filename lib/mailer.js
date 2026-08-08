// ============================================================================
// Envio de e-mail via Gmail (SMTP), usando a biblioteca nodemailer.
// ----------------------------------------------------------------------------
// PRECISA DE DUAS VARIÁVEIS DE AMBIENTE NA VERCEL (ação manual — ver aviso
// no início da resposta):
//   GMAIL_USER          -> o e-mail do Gmail que vai mandar as mensagens
//   GMAIL_APP_PASSWORD  -> a "Senha de app" gerada nas configurações da
//                          conta Google (não é a senha normal de login)
//
// Sem essas duas variáveis, as rotas que usam este helper respondem 500 e
// a tela correspondente mostra "não foi possível enviar".
//
// Usado por app/api/recuperar-pin/route.js e app/api/confirmar-reset/route.js.
// ============================================================================
import nodemailer from 'nodemailer';

let transporterCache = null;

export function getTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;

  if (!transporterCache) {
    transporterCache = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });
  }
  return transporterCache;
}

export function remetentePadrao() {
  const user = process.env.GMAIL_USER || '';
  return `G148 <${user}>`;
}

/**
 * CORREÇÃO DE SEGURANÇA: estas duas rotas de e-mail não checavam quem
 * estava chamando — qualquer request POST externo (curl, Postman, um
 * script), mesmo sem estar logado no app, conseguia usar o Gmail
 * configurado aqui como um "relay" pra mandar e-mail com essa aparência
 * pra qualquer endereço. Esta checagem confirma que o pedido veio do
 * próprio app (mesma origem do host da requisição) antes de mandar
 * qualquer e-mail — não é uma autenticação forte (um request forjado com
 * curl pode simular o cabeçalho Origin/Referer), mas já barra o abuso
 * casual/automatizado sem exigir nenhuma dependência ou variável de
 * ambiente nova. Server Actions e chamadas normais de fetch('/api/...')
 * feitas pelo próprio app sempre enviam Origin ou Referer batendo com o
 * host, então isso não afeta o uso legítimo.
 */
export function origemValida(request) {
  const host = request.headers.get('host');
  if (!host) return false;

  const candidato = request.headers.get('origin') || request.headers.get('referer');
  if (!candidato) return false;

  try {
    return new URL(candidato).host === host;
  } catch {
    return false;
  }
}
