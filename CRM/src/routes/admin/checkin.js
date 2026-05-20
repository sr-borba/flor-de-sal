// GET /api/admin/check-in?date=YYYY-MM-DD (default = hoje em UTC)
// Retorna reservas do dia agrupadas por horário.

import { json, error, methodNotAllowed } from '../../lib/responses.js';
import { isValidIsoDate, todayIsoSaoPaulo } from '../../lib/dates.js';
import { HORARIOS_PERMITIDOS } from '../../lib/validate.js';
import { requirePermission } from '../../lib/permissions.js';

const HORARIOS_ORDEM = [
  '12h', '12h30', '13h', '13h30', '14h', '14h30', '15h',
  '19h', '19h30', '20h', '20h30', '21h', '21h30',
];

export async function handleAdminCheckin(request, env, ctx, auth) {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  // Check-in usa as mesmas capabilities de listar + mudar status.
  const denied = requirePermission(auth, 'view_reservas', request, env, ctx);
  if (denied) return denied;

  const url = new URL(request.url);
  let date = url.searchParams.get('date');
  if (!date) {
    date = todayIsoSaoPaulo();
  }
  if (!isValidIsoDate(date)) return error('invalid_date', 'data inválida', { status: 400 });

  const rows = await env.DB
    .prepare(
      `SELECT id, reservation_code, nome, sobrenome, telefone, email,
              horario, adultos, criancas, total_pessoas,
              observacoes, observacoes_internas, status, origem, criado_em
         FROM reservations
        WHERE data_reserva = ?
          AND status NOT IN ('cancelada')
        ORDER BY horario ASC, id ASC`
    )
    .bind(date)
    .all();

  const byHorario = {};
  for (const h of HORARIOS_ORDEM) byHorario[h] = [];
  for (const r of rows.results || []) {
    if (HORARIOS_PERMITIDOS.has(r.horario)) {
      byHorario[r.horario].push(r);
    }
  }

  const grupos = HORARIOS_ORDEM.map((h) => ({ horario: h, reservas: byHorario[h] }));

  return json({ success: true, date, grupos, total: rows.results?.length || 0 });
}
