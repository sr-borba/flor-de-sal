// Flor de Sal — Worker entry point.
// Estratégia: Worker convive com static assets (binding ASSETS).
// Cloudflare serve assets primeiro; só caem aqui requests que NÃO casam
// com nenhum arquivo em ./Projeto Website. Para qualquer rota não-API,
// delegamos explicitamente para env.ASSETS como rede de segurança.
//
// SEGURANÇA:
// - Nenhum segredo é exposto neste arquivo.
// - Validação e prepared statements ficam nos módulos /lib e /routes.
// - Fallback ASSETS garante que a LP nunca quebra mesmo se o roteador falhar.

import { handleHealth } from './routes/health.js';
import { handleReservasPublic } from './routes/reservasPublic.js';
import { error } from './lib/responses.js';

const API_PREFIX = '/api/';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path.startsWith(API_PREFIX)) {
        return await routeApi(request, env, ctx, path);
      }

      // Tudo que não é API → assets (LP, /designsystem, /playbook, /admin estático).
      return env.ASSETS.fetch(request);
    } catch (e) {
      console.error('worker fatal', e?.message || e);
      // Último recurso: se for rota não-API, ainda tenta servir os assets.
      if (!path.startsWith(API_PREFIX)) {
        try { return await env.ASSETS.fetch(request); } catch {}
      }
      return error('internal', 'Erro interno.', { status: 500 });
    }
  },
};

async function routeApi(request, env, ctx, path) {
  switch (path) {
    case '/api/health':
      return handleHealth(request, env);
    case '/api/reservas/public':
      return handleReservasPublic(request, env, ctx);
    default:
      return error('not_found', 'Endpoint não encontrado.', { status: 404 });
  }
}
