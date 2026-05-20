// Matriz de permissões por role + helper de verificação.
//
// CF Access valida quem entra; este módulo decide o que cada role pode fazer.
// Permissões são VALIDADAS NO BACKEND. O frontend usa a mesma matriz só pra
// esconder botões — nunca pra autorizar.

export const ROLES = ['admin', 'gerente', 'concierge', 'marketing'];

// Capabilities atômicas. Adicionar uma nova capability é sempre seguro
// (default = negar). Remover/renomear uma é breaking change.
export const PERMISSIONS = {
  admin: new Set([
    'view_dashboard',
    'view_reservas',
    'create_reserva',
    'edit_reserva_status',
    'edit_reserva_obs',
    'export_voucher',
    'view_utms',
    'view_reports',
    'export_csv',
    'manage_users',
    'view_obs_internas', // notas operacionais internas — não expor ao marketing
  ]),
  gerente: new Set([
    'view_dashboard',
    'view_reservas',
    'create_reserva',
    'edit_reserva_status',
    'edit_reserva_obs',
    'export_voucher',
    'view_reports',
    'export_csv',
    'view_obs_internas',
  ]),
  concierge: new Set([
    'view_reservas',
    'create_reserva',
    'edit_reserva_status',
    'edit_reserva_obs',
    'export_voucher',
    'view_obs_internas',
  ]),
  marketing: new Set([
    'view_dashboard',
    'view_reservas',
    'view_utms',
    'view_reports',
    'export_csv',
    // view_obs_internas ausente intencionalmente: marketing vê só dados analíticos
  ]),
};

export function hasPermission(role, action) {
  const set = PERMISSIONS[role];
  return set ? set.has(action) : false;
}

// Devolve a lista de capabilities da role (pra o front filtrar UI).
export function rolePermissions(role) {
  const set = PERMISSIONS[role];
  return set ? Array.from(set) : [];
}

// Helper de gate. Devolve null se permitido, ou uma Response 403 com audit log.
// Uso: const denied = await requirePermission(auth, 'edit_reserva_status', request, env, ctx);
//      if (denied) return denied;
//
// audit log é gravado via ctx.waitUntil pra não bloquear a resposta.
import { error } from './responses.js';

export function requirePermission(auth, action, request, env, ctx) {
  if (!auth || !auth.user) {
    return error('unauthorized', 'Não autenticado.', { status: 401 });
  }
  if (hasPermission(auth.user.role, action)) return null;

  // Tentativa negada — registrar pra auditoria.
  const url = new URL(request.url);
  const detalhes = JSON.stringify({
    action,
    method: request.method,
    path: url.pathname,
    role: auth.user.role,
  });

  const insert = env.DB
    .prepare(
      `INSERT INTO audit_logs (entidade, entidade_id, acao, usuario_email, detalhes)
       VALUES ('access', ?, 'access_denied', ?, ?)`
    )
    .bind(auth.user.id, auth.email, detalhes)
    .run()
    .catch((e) => console.error('audit access_denied falhou', e?.message || e));

  if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(insert);

  return error('forbidden_role', 'Você não tem permissão para essa ação.', { status: 403 });
}
