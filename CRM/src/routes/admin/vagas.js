// GET /api/admin/vagas?data=YYYY-MM-DD&turno=almoco|jantar
// GET /api/admin/vagas/dia?data=YYYY-MM-DD
// Retorna ocupação de pessoas confirmadas por turno (capacidade = 25 por turno).

import { json, error, methodNotAllowed } from '../../lib/responses.js';
import { isValidIsoDate, todayIsoSaoPaulo } from '../../lib/dates.js';
import { requirePermission } from '../../lib/permissions.js';

export const CAPACIDADE_TURNO = 25;

export const TURNOS = {
  almoco: ['12h', '12h30', '13h', '13h30', '14h', '14h30'],
  jantar: ['19h', '19h30', '20h', '20h30', '21h', '21h30'],
};

// Statuses que contam como ocupação de turno.
const STATUS_ATIVOS = "('confirmada', 'remarcada', 'compareceu')";

// GET /api/admin/vagas?data=YYYY-MM-DD&turno=almoco|jantar
export async function handleAdminVagasTurno(request, env, ctx, auth) {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);
  const denied = requirePermission(auth, 'view_reservas', request, env, ctx);
  if (denied) return denied;

  const url = new URL(request.url);
  const data = url.searchParams.get('data');
  const turno = url.searchParams.get('turno');

  if (!data || !isValidIsoDate(data)) {
    return error('invalid_date', 'data inválida (use YYYY-MM-DD)', { status: 400 });
  }
  if (!TURNOS[turno]) {
    return error('invalid_turno', 'turno deve ser almoco ou jantar', { status: 400 });
  }

  const horarios = TURNOS[turno];
  // D1 não suporta array bind — gera placeholders manualmente.
  const placeholders = horarios.map(() => '?').join(', ');

  const row = await env.DB
    .prepare(
      `SELECT COALESCE(SUM(total_pessoas), 0) AS total_pessoas
         FROM reservations
        WHERE data_reserva = ?
          AND horario IN (${placeholders})
          AND status IN ${STATUS_ATIVOS}`
    )
    .bind(data, ...horarios)
    .first();

  const total = Number(row?.total_pessoas ?? 0);
  return json({
    data,
    turno,
    total_pessoas: total,
    capacidade: CAPACIDADE_TURNO,
    lotado: total >= CAPACIDADE_TURNO,
  });
}

// GET /api/admin/vagas/dia?data=YYYY-MM-DD (default = hoje em São Paulo)
export async function handleAdminVagasDia(request, env, ctx, auth) {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);
  const denied = requirePermission(auth, 'view_reservas', request, env, ctx);
  if (denied) return denied;

  const url = new URL(request.url);
  let data = url.searchParams.get('data');
  if (!data) data = todayIsoSaoPaulo();
  if (!isValidIsoDate(data)) {
    return error('invalid_date', 'data inválida (use YYYY-MM-DD)', { status: 400 });
  }

  // Uma única query agrega por horário; atribuímos ao turno no JS.
  const rows = await env.DB
    .prepare(
      `SELECT horario, COALESCE(SUM(total_pessoas), 0) AS total_pessoas
         FROM reservations
        WHERE data_reserva = ?
          AND status IN ${STATUS_ATIVOS}
        GROUP BY horario`
    )
    .bind(data)
    .all();

  const byHorario = {};
  for (const r of (rows.results || [])) {
    byHorario[r.horario] = Number(r.total_pessoas);
  }

  const turnos = Object.entries(TURNOS).map(([nome, horarios]) => {
    const total = horarios.reduce((s, h) => s + (byHorario[h] || 0), 0);
    return {
      turno: nome,
      horarios,
      total_pessoas: total,
      capacidade: CAPACIDADE_TURNO,
      lotado: total >= CAPACIDADE_TURNO,
    };
  });

  return json({ data, turnos });
}
