// GET /api/admin/relatorios/metricas
// Retorna tudo numa chamada: totais+taxas, por origem, por campanha,
// por horário, série diária. Filtros via querystring (ver reportFilters.js).
//
// Permission: view_reports. Métricas por campanha vêm vazias se a role
// não tem view_utms (gerente).

import { json, error, methodNotAllowed } from '../../../lib/responses.js';
import { requirePermission, hasPermission } from '../../../lib/permissions.js';
import { buildReportFilters, ORIGEM_EFETIVA_SQL } from '../../../lib/reportFilters.js';

// Arredonda taxa pra 1 casa decimal. Devolve null se denominador for 0
// (evita 0% confundindo "sem dados" com "0 de 0").
function rate(num, den) {
  if (!den) return null;
  return Math.round((num / den) * 1000) / 10;
}

export async function handleRelatoriosMetricas(request, env, ctx, auth) {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  const denied = requirePermission(auth, 'view_reports', request, env, ctx);
  if (denied) return denied;

  const url = new URL(request.url);
  const f = buildReportFilters(url.searchParams);
  if (!f.ok) {
    return error('invalid_filters', 'Filtros inválidos.', {
      status: 400, extra: { fields: f.errors },
    });
  }
  const { where, params, period } = f;

  // Totais agregados (1 query). Estratégia: SUM(CASE WHEN status=...) pra
  // contar cada status sem precisar de N subqueries. Pessoas confirmadas
  // = soma de total_pessoas DAS confirmadas. Idem compareceu.
  const totaisStmt = env.DB.prepare(
    `SELECT
       COUNT(*)                                                       AS total,
       SUM(CASE WHEN status='solicitada'          THEN 1 ELSE 0 END)  AS solicitada,
       SUM(CASE WHEN status='aguardando_resposta' THEN 1 ELSE 0 END)  AS aguardando_resposta,
       SUM(CASE WHEN status='confirmada'          THEN 1 ELSE 0 END)  AS confirmada,
       SUM(CASE WHEN status='remarcada'           THEN 1 ELSE 0 END)  AS remarcada,
       SUM(CASE WHEN status='cancelada'           THEN 1 ELSE 0 END)  AS cancelada,
       SUM(CASE WHEN status='compareceu'          THEN 1 ELSE 0 END)  AS compareceu,
       SUM(CASE WHEN status='no_show'             THEN 1 ELSE 0 END)  AS no_show,
       COALESCE(SUM(CASE WHEN status='confirmada' THEN total_pessoas END), 0) AS pessoas_confirmadas,
       COALESCE(SUM(CASE WHEN status='compareceu' THEN total_pessoas END), 0) AS pessoas_compareceu
     FROM reservations
     ${where}`
  ).bind(...params);

  // Por origem efetiva.
  const origemStmt = env.DB.prepare(
    `SELECT
       ${ORIGEM_EFETIVA_SQL}                                                  AS origem,
       COUNT(*)                                                               AS total,
       SUM(CASE WHEN status IN ('solicitada','aguardando_resposta') THEN 1 ELSE 0 END) AS solicitada,
       SUM(CASE WHEN status='confirmada' THEN 1 ELSE 0 END)                   AS confirmada,
       SUM(CASE WHEN status='compareceu' THEN 1 ELSE 0 END)                   AS compareceu,
       SUM(CASE WHEN status='cancelada'  THEN 1 ELSE 0 END)                   AS cancelada,
       SUM(CASE WHEN status='no_show'    THEN 1 ELSE 0 END)                   AS no_show
     FROM reservations
     ${where}
     GROUP BY origem
     ORDER BY total DESC`
  ).bind(...params);

  // Por campanha (só se tem view_utms — gerente não vê).
  const canViewUtms = hasPermission(auth.user.role, 'view_utms');
  const campanhaStmt = canViewUtms
    ? env.DB.prepare(
        `SELECT
           COALESCE(NULLIF(utm_campaign, ''), '(sem campanha)') AS campanha,
           COALESCE(NULLIF(utm_source, ''), '—')                AS source,
           COALESCE(NULLIF(utm_medium, ''), '—')                AS medium,
           COUNT(*)                                              AS total,
           SUM(CASE WHEN status IN ('solicitada','aguardando_resposta') THEN 1 ELSE 0 END) AS solicitada,
           SUM(CASE WHEN status='confirmada' THEN 1 ELSE 0 END)  AS confirmada,
           SUM(CASE WHEN status='compareceu' THEN 1 ELSE 0 END)  AS compareceu,
           SUM(CASE WHEN status='cancelada'  THEN 1 ELSE 0 END)  AS cancelada,
           SUM(CASE WHEN status='no_show'    THEN 1 ELSE 0 END)  AS no_show
         FROM reservations
         ${where}
         GROUP BY campanha, source, medium
         ORDER BY total DESC
         LIMIT 50`
      ).bind(...params)
    : null;

  // Por horário.
  const horarioStmt = env.DB.prepare(
    `SELECT
       horario,
       COUNT(*)                                                              AS total,
       COALESCE(SUM(total_pessoas), 0)                                       AS pessoas,
       SUM(CASE WHEN status='confirmada' THEN 1 ELSE 0 END)                  AS confirmada,
       SUM(CASE WHEN status='compareceu' THEN 1 ELSE 0 END)                  AS compareceu,
       SUM(CASE WHEN status='cancelada'  THEN 1 ELSE 0 END)                  AS cancelada
     FROM reservations
     ${where}
     GROUP BY horario
     ORDER BY horario ASC`
  ).bind(...params);

  // Série por dia.
  const diaStmt = env.DB.prepare(
    `SELECT
       data_reserva                                                          AS dia,
       COUNT(*)                                                              AS total,
       COALESCE(SUM(total_pessoas), 0)                                       AS pessoas,
       SUM(CASE WHEN status='confirmada' THEN 1 ELSE 0 END)                  AS confirmada,
       SUM(CASE WHEN status='compareceu' THEN 1 ELSE 0 END)                  AS compareceu,
       SUM(CASE WHEN status='cancelada'  THEN 1 ELSE 0 END)                  AS cancelada,
       SUM(CASE WHEN status='no_show'    THEN 1 ELSE 0 END)                  AS no_show
     FROM reservations
     ${where}
     GROUP BY data_reserva
     ORDER BY data_reserva ASC`
  ).bind(...params);

  const stmts = [totaisStmt, origemStmt, horarioStmt, diaStmt];
  if (campanhaStmt) stmts.push(campanhaStmt);

  let results;
  try {
    results = await env.DB.batch(stmts);
  } catch (e) {
    console.error('relatoriosMetricas: erro D1', e?.message || e);
    return error('internal', 'Falha ao carregar métricas.', { status: 500 });
  }

  const [tRes, oRes, hRes, dRes, cRes] = results;
  const t = tRes.results[0] || {};
  const total = t.total || 0;
  const solicitada = t.solicitada || 0;
  const aguardando = t.aguardando_resposta || 0;
  const confirmada = t.confirmada || 0;
  const compareceu = t.compareceu || 0;
  const noShow = t.no_show || 0;
  const cancelada = t.cancelada || 0;

  // Base de "solicitadas" pra taxa de confirmação: TUDO que entrou (todas
  // chegaram a ser pelo menos "solicitada" em algum momento — historia status).
  // Aproximação: usar total - manual_já_confirmada. Mas simplificando:
  // confirmação faz sentido só sobre o universo da LP (solicitada inicial).
  // Pra consistência, usamos total como base.
  const taxaConfirmacao  = rate(confirmada, total);
  const taxaComparecimento = rate(compareceu, confirmada + compareceu);
  // Compareceu já não está mais como confirmada (mudou de status). Então base
  // efetiva = confirmadas pendentes + compareceram.
  const taxaCancelamento = rate(cancelada, total);
  const taxaNoShow       = rate(noShow, compareceu + noShow);

  function addRates(row) {
    return {
      ...row,
      taxa_comparecimento: rate(row.compareceu || 0, (row.compareceu || 0) + (row.no_show || 0)),
      taxa_cancelamento:   rate(row.cancelada || 0, row.total || 0),
    };
  }

  return json({
    success: true,
    period,
    totais: {
      total,
      solicitada,
      aguardando_resposta: aguardando,
      confirmada,
      remarcada: t.remarcada || 0,
      cancelada,
      compareceu,
      no_show: noShow,
      pessoas_confirmadas: t.pessoas_confirmadas || 0,
      pessoas_compareceu:  t.pessoas_compareceu  || 0,
    },
    taxas: {
      taxa_confirmacao:   taxaConfirmacao,
      taxa_comparecimento: taxaComparecimento,
      taxa_cancelamento:  taxaCancelamento,
      taxa_no_show:       taxaNoShow,
    },
    por_origem:   (oRes.results || []).map(addRates),
    por_campanha: canViewUtms ? (cRes?.results || []).map(addRates) : null,
    por_horario:  (hRes.results || []).map(addRates),
    por_dia:      dRes.results || [],
  });
}
