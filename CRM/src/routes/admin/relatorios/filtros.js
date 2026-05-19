// GET /api/admin/relatorios/filtros
// Devolve opções pros dropdowns: campanhas e origens vistas no histórico
// (filtradas por permissão), status e horários (listas fechadas).

import { json, methodNotAllowed } from '../../../lib/responses.js';
import { requirePermission, hasPermission } from '../../../lib/permissions.js';
import { HORARIOS_PERMITIDOS, STATUS_PERMITIDOS } from '../../../lib/validate.js';
import { ORIGENS_EFETIVAS, ORIGEM_EFETIVA_SQL } from '../../../lib/reportFilters.js';

export async function handleRelatoriosFiltros(request, env, ctx, auth) {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  const denied = requirePermission(auth, 'view_reports', request, env, ctx);
  if (denied) return denied;

  // Origens efetivas com dados (ordenadas por volume).
  const origensRows = await env.DB
    .prepare(
      `SELECT ${ORIGEM_EFETIVA_SQL} AS origem, COUNT(*) AS n
         FROM reservations
        GROUP BY origem
        ORDER BY n DESC`
    )
    .all();
  const origens = (origensRows.results || [])
    .map((r) => r.origem)
    .filter((o) => ORIGENS_EFETIVAS.has(o));

  // Campanhas só pra quem vê UTMs.
  let campanhas = [];
  if (hasPermission(auth.user.role, 'view_utms')) {
    const campRows = await env.DB
      .prepare(
        `SELECT DISTINCT utm_campaign AS campanha
           FROM reservations
          WHERE utm_campaign IS NOT NULL AND utm_campaign != ''
          ORDER BY utm_campaign ASC
          LIMIT 200`
      )
      .all();
    campanhas = (campRows.results || []).map((r) => r.campanha);
  }

  return json({
    success: true,
    origens,                                 // ['lp', 'manual', ...] presentes no DB
    origens_disponiveis: Array.from(ORIGENS_EFETIVAS),
    status: Array.from(STATUS_PERMITIDOS),
    horarios: Array.from(HORARIOS_PERMITIDOS),
    campanhas,
  });
}
