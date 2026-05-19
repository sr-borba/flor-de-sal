// POST /api/admin/reservas — cadastro manual.
// origem='manual', status='confirmada', criado_por=email do admin.

import { json, error, methodNotAllowed } from '../../lib/responses.js';
import { isJsonRequest } from '../../lib/security.js';
import { validateReservaManual } from '../../lib/validate.js';
import { tempCode, formatReservationCode } from '../../lib/codes.js';
import { requirePermission } from '../../lib/permissions.js';

export async function handleAdminCreate(request, env, ctx, auth) {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  const denied = requirePermission(auth, 'create_reserva', request, env, ctx);
  if (denied) return denied;
  const email = auth.email;

  if (!isJsonRequest(request)) {
    return error('invalid_content_type', 'Content-Type deve ser application/json', { status: 415 });
  }

  let body;
  try {
    const raw = await request.text();
    if (raw.length > 16 * 1024) return error('payload_too_large', 'payload excede limite', { status: 413 });
    body = JSON.parse(raw);
  } catch {
    return error('invalid_json', 'JSON inválido', { status: 400 });
  }

  const result = validateReservaManual(body);
  if (!result.ok) {
    return error('validation_failed', 'Dados inválidos.', {
      status: 400,
      extra: { fields: result.errors },
    });
  }
  const d = result.data;

  try {
    const inserted = await env.DB
      .prepare(
        `INSERT INTO reservations (
          reservation_code, nome, sobrenome, email, telefone,
          data_reserva, horario, adultos, criancas, total_pessoas,
          observacoes, observacoes_internas, origem, status, criado_por
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', 'confirmada', ?)
        RETURNING id`
      )
      .bind(
        tempCode(), d.nome, d.sobrenome, d.email, d.telefone,
        d.data_reserva, d.horario, d.adultos, d.criancas, d.total_pessoas,
        d.observacoes, d.observacoes_internas, email,
      )
      .first();

    if (!inserted || typeof inserted.id !== 'number') {
      console.error('adminCreate: insert sem id', inserted);
      return error('internal', 'Falha ao criar reserva.', { status: 500 });
    }

    const reservaId = inserted.id;
    const code = formatReservationCode(reservaId);

    await env.DB.batch([
      env.DB.prepare(`UPDATE reservations SET reservation_code = ? WHERE id = ?`).bind(code, reservaId),
      env.DB.prepare(
        `INSERT INTO reservation_status_history (reservation_id, status_anterior, status_novo, usuario_email)
         VALUES (?, NULL, 'confirmada', ?)`
      ).bind(reservaId, email),
      env.DB.prepare(
        `INSERT INTO audit_logs (entidade, entidade_id, acao, usuario_email, detalhes)
         VALUES ('reservations', ?, 'create_manual', ?, ?)`
      ).bind(reservaId, email, JSON.stringify({ code })),
    ]);

    return json({ success: true, reserva_id: reservaId, reservation_code: code }, { status: 201 });
  } catch (e) {
    console.error('adminCreate: erro D1', e?.message || e);
    return error('internal', 'Falha ao criar reserva.', { status: 500 });
  }
}
