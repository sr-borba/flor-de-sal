// Flor de Sal — Worker entry point.
//
// Roteamento:
//   /api/health                          → público (health.js)
//   /api/reservas/public                 → público (reservasPublic.js)
//   /api/admin/*                         → protegido por Cloudflare Access (verifica JWT)
//   resto                                → assets (LP, /designsystem, /playbook, /admin/*)
//
// SEGURANÇA: o fallback ASSETS garante que a LP nunca quebra mesmo se
// o roteador falhar. Erros são logados, nunca retornados ao cliente.

import { handleHealth } from './routes/health.js';
import { handleReservasPublic } from './routes/reservasPublic.js';
import { handleAdminList } from './routes/admin/list.js';
import { handleAdminCreate } from './routes/admin/create.js';
import { handleAdminDetail } from './routes/admin/detail.js';
import { handleAdminStatus } from './routes/admin/status.js';
import { handleAdminObs } from './routes/admin/obs.js';
import { handleAdminDashboard } from './routes/admin/dashboard.js';
import { handleAdminCheckin } from './routes/admin/checkin.js';
import { requireAdminAuth } from './lib/auth.js';
import { error, json } from './lib/responses.js';

const API_PREFIX = '/api/';
const ADMIN_PREFIX = '/api/admin/';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path.startsWith(ADMIN_PREFIX)) {
        return await routeAdmin(request, env, ctx, path);
      }
      if (path.startsWith(API_PREFIX)) {
        return await routePublicApi(request, env, ctx, path);
      }
      return env.ASSETS.fetch(request);
    } catch (e) {
      console.error('worker fatal', e?.message || e);
      if (!path.startsWith(API_PREFIX)) {
        try { return await env.ASSETS.fetch(request); } catch {}
      }
      return error('internal', 'Erro interno.', { status: 500 });
    }
  },
};

async function routePublicApi(request, env, ctx, path) {
  switch (path) {
    case '/api/health':
      return handleHealth(request, env);
    case '/api/reservas/public':
      return handleReservasPublic(request, env, ctx);
    default:
      return error('not_found', 'Endpoint não encontrado.', { status: 404 });
  }
}

// Padrões aceitos:
//   /api/admin/me
//   /api/admin/reservas                          (GET, POST)
//   /api/admin/reservas/:id                      (GET)
//   /api/admin/reservas/:id/status               (PATCH)
//   /api/admin/reservas/:id/observacoes-internas (PATCH)
//   /api/admin/dashboard/stats                   (GET)
//   /api/admin/check-in                          (GET)
async function routeAdmin(request, env, ctx, path) {
  // Auth gate ÚNICO para tudo em /api/admin/*.
  let auth;
  try {
    auth = await requireAdminAuth(request, env);
  } catch (e) {
    console.error('auth fail', e?.message || e);
    return error('unauthorized', 'Não autenticado.', { status: 401 });
  }

  // /api/admin/me → devolve o e-mail atual (útil para o front mostrar).
  if (path === '/api/admin/me') {
    if (request.method !== 'GET') return error('method', 'Use GET', { status: 405 });
    return json({ success: true, email: auth.email });
  }

  if (path === '/api/admin/reservas') {
    if (request.method === 'GET') return handleAdminList(request, env, ctx, auth);
    if (request.method === 'POST') return handleAdminCreate(request, env, ctx, auth);
    return error('method', 'Método não permitido', { status: 405 });
  }

  if (path === '/api/admin/dashboard/stats') {
    return handleAdminDashboard(request, env, ctx, auth);
  }

  if (path === '/api/admin/check-in') {
    return handleAdminCheckin(request, env, ctx, auth);
  }

  // /api/admin/reservas/:id[/sub]
  const m = path.match(/^\/api\/admin\/reservas\/(\d+)(\/[a-z-]+)?$/);
  if (m) {
    const id = m[1];
    const sub = m[2] || '';
    if (sub === '') return handleAdminDetail(request, env, ctx, auth, id);
    if (sub === '/status') return handleAdminStatus(request, env, ctx, auth, id);
    if (sub === '/observacoes-internas') return handleAdminObs(request, env, ctx, auth, id);
  }

  return error('not_found', 'Endpoint não encontrado.', { status: 404 });
}
