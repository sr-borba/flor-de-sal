// Flor de Sal — Worker entry point.
//
// Roteamento:
//   /api/health                          → público (health.js)
//   /api/reservas/public                 → público (reservasPublic.js)
//   /api/admin/*                         → protegido por Cloudflare Access + users (DB)
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
import { handleUsersList } from './routes/admin/users/list.js';
import { handleUsersCreate } from './routes/admin/users/create.js';
import { handleUsersUpdate } from './routes/admin/users/update.js';
import { handleUsersMeGet, handleUsersMePatch } from './routes/admin/users/me.js';
import {
  requireAdminAuth,
  AuthError,
  NoAccountError,
  InactiveError,
} from './lib/auth.js';
import { rolePermissions } from './lib/permissions.js';
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
//   /api/admin/me                                (GET legado — mantém)
//   /api/admin/users                             (GET, POST)
//   /api/admin/users/me                          (GET, PATCH)
//   /api/admin/users/:id                         (PATCH)
//   /api/admin/reservas                          (GET, POST)
//   /api/admin/reservas/:id                      (GET)
//   /api/admin/reservas/:id/status               (PATCH)
//   /api/admin/reservas/:id/observacoes-internas (PATCH)
//   /api/admin/dashboard/stats                   (GET)
//   /api/admin/check-in                          (GET)
async function routeAdmin(request, env, ctx, path) {
  // Auth gate ÚNICO para tudo em /api/admin/*.
  // Erros são distintos para o front saber se é problema de autenticação
  // (re-login no CF Access) ou de autorização (falar com admin).
  let auth;
  try {
    auth = await requireAdminAuth(request, env);
  } catch (e) {
    if (e instanceof NoAccountError) {
      // E-mail passou pelo CF Access mas não está cadastrado no painel.
      // Audit log fica fora de batch porque user.id é null aqui.
      const ip = request.headers.get('Cf-Connecting-Ip') || null;
      const insert = env.DB
        .prepare(
          `INSERT INTO audit_logs (entidade, entidade_id, acao, usuario_email, detalhes)
           VALUES ('access', NULL, 'no_account', ?, ?)`
        )
        .bind(
          // Tenta extrair email do JWT pra log; se falhar, null.
          (e?.cause?.email) || null,
          JSON.stringify({ path, ip }),
        )
        .run()
        .catch(() => {});
      if (ctx?.waitUntil) ctx.waitUntil(insert);
      return error(
        'no_account',
        'Sua conta ainda não foi cadastrada no painel. Peça ao administrador para criar seu acesso.',
        { status: 403 },
      );
    }
    if (e instanceof InactiveError) {
      return error(
        'inactive_account',
        'Sua conta está desativada. Procure o administrador.',
        { status: 403 },
      );
    }
    // AuthError ou desconhecido → 401.
    console.error('auth fail', e?.message || e);
    return error('unauthorized', 'Não autenticado.', { status: 401 });
  }

  // /api/admin/me → legado: e-mail + permissões resolvidas (front usa pra
  // esconder botões). Permissões são SEMPRE re-validadas no backend.
  if (path === '/api/admin/me') {
    if (request.method !== 'GET') return error('method', 'Use GET', { status: 405 });
    return json({
      success: true,
      email: auth.email,
      user: {
        id: auth.user.id,
        nome: auth.user.nome,
        sobrenome: auth.user.sobrenome,
        email: auth.user.email,
        role: auth.user.role,
        ativo: auth.user.ativo,
      },
      permissions: rolePermissions(auth.user.role),
    });
  }

  // Users — rotas mais específicas primeiro (users/me e users/:id antes de users).
  if (path === '/api/admin/users/me') {
    if (request.method === 'GET') return handleUsersMeGet(request, env, ctx, auth);
    if (request.method === 'PATCH') return handleUsersMePatch(request, env, ctx, auth);
    return error('method', 'Método não permitido', { status: 405 });
  }
  const mUser = path.match(/^\/api\/admin\/users\/(\d+)$/);
  if (mUser) {
    return handleUsersUpdate(request, env, ctx, auth, mUser[1]);
  }
  if (path === '/api/admin/users') {
    if (request.method === 'GET') return handleUsersList(request, env, ctx, auth);
    if (request.method === 'POST') return handleUsersCreate(request, env, ctx, auth);
    return error('method', 'Método não permitido', { status: 405 });
  }

  // Reservas.
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
