// GET /api/admin/reservas/:id — detalhe completo incluindo histórico.

import { json, error, methodNotAllowed } from '../../lib/responses.js';

export async function handleAdminDetail(request, env, ctx, { email }, id) {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

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

  return json({
    success: true,
    reserva,
    history: histRes.results || [],
  });
}
