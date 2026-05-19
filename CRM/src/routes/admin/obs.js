// PATCH /api/admin/reservas/:id/observacoes-internas — atualiza nota interna.

import { json, error, methodNotAllowed } from '../../lib/responses.js';
import { isJsonRequest, cleanString } from '../../lib/security.js';
import { requirePermission } from '../../lib/permissions.js';

export async function handleAdminObs(request, env, ctx, auth, id) {
  if (request.method !== 'PATCH') return methodNotAllowed(['PATCH']);

  const denied = requirePermission(auth, 'edit_reserva_obs', request, env, ctx);
  if (denied) return denied;
  const email = auth.email;

  if (!isJsonRequest(request)) {
    return error('invalid_content_type', 'Content-Type deve ser application/json', { status: 415 });
  }

  const reservaId = parseInt(id, 10);
  if (!Number.isInteger(reservaId) || reservaId < 1) {
    return error('invalid_id', 'id inválido', { status: 400 });
  }

  let body;
  try {
    const raw = await request.text();
    if (raw.length > 4 * 1024) return error('payload_too_large', 'payload excede limite', { status: 413 });
    body = JSON.parse(raw);
  } catch {
    return error('invalid_json', 'JSON inválido', { status: 400 });
  }

  const obsInternas = cleanString(body.observacoes_internas, { maxLen: 2000 });

  try {
    const exists = await env.DB.prepare(`SELECT id FROM reservations WHERE id = ?`).bind(reservaId).first();
    if (!exists) return error('not_found', 'reserva não encontrada', { status: 404 });

    await env.DB.batch([
      env.DB.prepare(`UPDATE reservations SET observacoes_internas = ? WHERE id = ?`).bind(obsInternas, reservaId),
      env.DB.prepare(
        `INSERT INTO audit_logs (entidade, entidade_id, acao, usuario_email, detalhes)
         VALUES ('reservations', ?, 'update_obs_internas', ?, ?)`
      ).bind(reservaId, email, JSON.stringify({ length: obsInternas ? obsInternas.length : 0 })),
    ]);

    return json({ success: true });
  } catch (e) {
    console.error('adminObs: erro D1', e?.message || e);
    return error('internal', 'Falha ao atualizar.', { status: 500 });
  }
}
