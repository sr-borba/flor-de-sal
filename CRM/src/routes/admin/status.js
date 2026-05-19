// PATCH /api/admin/reservas/:id/status — muda status, grava histórico + audit.
// Remarcação atualiza data_reserva e horario mantendo o mesmo id/reservation_code.

import { json, error, methodNotAllowed } from '../../lib/responses.js';
import { isJsonRequest } from '../../lib/security.js';
import { validateStatusChange } from '../../lib/validate.js';

export async function handleAdminStatus(request, env, ctx, { email }, id) {
  if (request.method !== 'PATCH') return methodNotAllowed(['PATCH']);

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

  // Busca estado atual para validações dependentes.
  const atual = await env.DB
    .prepare(`SELECT status, data_reserva, horario FROM reservations WHERE id = ?`)
    .bind(reservaId)
    .first();
  if (!atual) return error('not_found', 'reserva não encontrada', { status: 404 });

  const result = validateStatusChange(body, {
    statusAtual: atual.status,
    dataReserva: atual.data_reserva,
  });
  if (!result.ok) {
    return error('validation_failed', 'Dados inválidos.', {
      status: 400,
      extra: { fields: result.errors },
    });
  }
  const d = result.data;

  try {
    const statements = [];

    if (d.status_novo === 'remarcada') {
      // Atualiza status, data e horario na mesma transação.
      statements.push(
        env.DB.prepare(
          `UPDATE reservations
              SET status = ?, data_reserva = ?, horario = ?
            WHERE id = ?`
        ).bind(d.status_novo, d.nova_data, d.novo_horario, reservaId)
      );
    } else {
      statements.push(
        env.DB.prepare(`UPDATE reservations SET status = ? WHERE id = ?`).bind(d.status_novo, reservaId)
      );
    }

    statements.push(
      env.DB.prepare(
        `INSERT INTO reservation_status_history (reservation_id, status_anterior, status_novo, usuario_email, motivo)
         VALUES (?, ?, ?, ?, ?)`
      ).bind(reservaId, d.status_anterior, d.status_novo, email, d.motivo)
    );

    const auditDetails = { status_anterior: d.status_anterior, status_novo: d.status_novo };
    if (d.motivo) auditDetails.motivo = d.motivo;
    if (d.status_novo === 'remarcada') {
      auditDetails.nova_data = d.nova_data;
      auditDetails.novo_horario = d.novo_horario;
      auditDetails.data_anterior = atual.data_reserva;
      auditDetails.horario_anterior = atual.horario;
    }
    statements.push(
      env.DB.prepare(
        `INSERT INTO audit_logs (entidade, entidade_id, acao, usuario_email, detalhes)
         VALUES ('reservations', ?, 'status_change', ?, ?)`
      ).bind(reservaId, email, JSON.stringify(auditDetails))
    );

    await env.DB.batch(statements);

    return json({ success: true, status_novo: d.status_novo });
  } catch (e) {
    console.error('adminStatus: erro D1', e?.message || e);
    return error('internal', 'Falha ao atualizar status.', { status: 500 });
  }
}
