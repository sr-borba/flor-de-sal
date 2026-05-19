// GET /api/admin/reservas — lista paginada + filtros + busca.
//
// Query params aceitos:
//   q          — busca em nome, telefone (dígitos), reservation_code
//   status     — solicitada|aguardando_resposta|confirmada|...
//   origem     — lp|manual
//   from, to   — período de data_reserva (YYYY-MM-DD)
//   horario    — 19h|19h30|...|21h30
//   order_by   — data_reserva|criado_em (default: data_reserva)
//   order      — asc|desc (default: asc)
//   page       — 1+ (default: 1)
//   per_page   — 1-100 (default: 25)

import { json, error, methodNotAllowed } from '../../lib/responses.js';
import {
  HORARIOS_PERMITIDOS,
  STATUS_PERMITIDOS,
  normalizePhoneBr,
} from '../../lib/validate.js';
import { isValidIsoDate } from '../../lib/dates.js';
import { cleanString } from '../../lib/security.js';
import { requirePermission } from '../../lib/permissions.js';

const ORIGENS = new Set(['lp', 'manual']);
const ORDER_BY_ALLOWED = new Set(['data_reserva', 'criado_em']);

export async function handleAdminList(request, env, ctx, auth) {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  const denied = requirePermission(auth, 'view_reservas', request, env, ctx);
  if (denied) return denied;

  const url = new URL(request.url);
  const sp = url.searchParams;

  const q = cleanString(sp.get('q'), { maxLen: 100 });
  const status = cleanString(sp.get('status'), { maxLen: 30 });
  const origem = cleanString(sp.get('origem'), { maxLen: 20 });
  const from = cleanString(sp.get('from'), { maxLen: 10 });
  const to = cleanString(sp.get('to'), { maxLen: 10 });
  const horario = cleanString(sp.get('horario'), { maxLen: 10 });
  const orderBy = ORDER_BY_ALLOWED.has(sp.get('order_by')) ? sp.get('order_by') : 'data_reserva';
  const order = sp.get('order') === 'desc' ? 'DESC' : 'ASC';
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1);
  const perPage = Math.min(100, Math.max(1, parseInt(sp.get('per_page') || '25', 10) || 25));

  const where = [];
  const params = [];

  if (status) {
    if (!STATUS_PERMITIDOS.has(status)) return error('invalid_status', 'status inválido');
    where.push('status = ?');
    params.push(status);
  }
  if (origem) {
    if (!ORIGENS.has(origem)) return error('invalid_origem', 'origem inválida');
    where.push('origem = ?');
    params.push(origem);
  }
  if (from) {
    if (!isValidIsoDate(from)) return error('invalid_from', 'from inválido');
    where.push('data_reserva >= ?');
    params.push(from);
  }
  if (to) {
    if (!isValidIsoDate(to)) return error('invalid_to', 'to inválido');
    where.push('data_reserva <= ?');
    params.push(to);
  }
  if (horario) {
    if (!HORARIOS_PERMITIDOS.has(horario)) return error('invalid_horario', 'horário inválido');
    where.push('horario = ?');
    params.push(horario);
  }
  if (q) {
    // Busca em nome (LIKE), telefone (substring de dígitos), reservation_code (LIKE).
    const phoneDigits = normalizePhoneBr(q);
    const like = `%${q}%`;
    if (phoneDigits) {
      where.push('(nome LIKE ? OR telefone LIKE ? OR reservation_code LIKE ?)');
      params.push(like, `%${phoneDigits}%`, like);
    } else {
      where.push('(nome LIKE ? OR reservation_code LIKE ?)');
      params.push(like, like);
    }
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const offset = (page - 1) * perPage;

  // Conta total + busca página em paralelo (D1 batch).
  const countStmt = env.DB.prepare(`SELECT COUNT(*) AS total FROM reservations ${whereSql}`).bind(...params);
  const listStmt = env.DB.prepare(
    `SELECT id, reservation_code, nome, sobrenome, telefone, email,
            data_reserva, horario, adultos, criancas, total_pessoas,
            status, origem, criado_em
       FROM reservations
       ${whereSql}
       ORDER BY ${orderBy} ${order}, id ${order}
       LIMIT ? OFFSET ?`
  ).bind(...params, perPage, offset);

  const [countRes, listRes] = await env.DB.batch([countStmt, listStmt]);
  const total = countRes.results[0]?.total ?? 0;
  const items = listRes.results || [];

  return json({
    success: true,
    items,
    pagination: {
      page,
      per_page: perPage,
      total,
      total_pages: Math.max(1, Math.ceil(total / perPage)),
    },
  });
}
