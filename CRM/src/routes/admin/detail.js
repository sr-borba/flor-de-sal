// GET /api/admin/reservas/:id — detalhe completo incluindo histórico.
// Campos utm_* só são devolvidos se o usuário tem permissão view_utms.

import { json, error, methodNotAllowed } from '../../lib/responses.js';
import { requirePermission, hasPermission } from '../../lib/permissions.js';

const UTM_FIELDS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
  'referrer', 'landing_page', 'user_agent', 'ip_hash',
];

export async function handleAdminDetail(request, env, ctx, auth, id) {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  const denied = requirePermission(auth, 'view_reservas', request, env, ctx);
  if (denied) return denied;

  const reservaId = parseInt(id, 10);
  if (!Number.isInteger(reservaId) || reservaId < 1) {
    return error('invalid_id', 'id inválido', { status: 400 });
  }

  const [resvRes, histRes] = await env.DB.batch([
    env.DB.prepare(`SELECT * FROM reservations WHERE id = ?`).bind(reservaId),
    env.DB.prepare(
      `SELECT id, status_anterior, status_novo, usuario_email, motivo, alterado_em
         FROM reservation_status_history
        WHERE reservation_id = ?
        ORDER BY alterado_em ASC, id ASC`
    ).bind(reservaId),
  ]);

  const reserva = resvRes.results[0];
  if (!reserva) return error('not_found', 'reserva não encontrada', { status: 404 });

  // Filtra campos UTM/tracking se a role não pode ver.
  if (!hasPermission(auth.user.role, 'view_utms')) {
    for (const f of UTM_FIELDS) delete reserva[f];
  }

  // Filtra notas operacionais internas — marketing não tem view_obs_internas.
  if (!hasPermission(auth.user.role, 'view_obs_internas')) {
    delete reserva.observacoes_internas;
  }

  return json({
    success: true,
    reserva,
    history: histRes.results || [],
  });
}
