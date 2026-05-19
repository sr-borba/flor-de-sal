// GET /api/admin/dashboard/stats?from=YYYY-MM-DD&to=YYYY-MM-DD
// Sem período → últimos 30 dias (data_reserva).

import { json, error, methodNotAllowed } from '../../lib/responses.js';
import { isValidIsoDate, todayIsoSaoPaulo } from '../../lib/dates.js';

function defaultPeriod() {
  const todayIso = todayIsoSaoPaulo();
  const past = new Date(`${todayIso}T00:00:00Z`);
  past.setUTCDate(past.getUTCDate() - 30);
  const pastIso = past.toISOString().slice(0, 10);
  return { from: pastIso, to: todayIso };
}

export async function handleAdminDashboard(request, env, ctx, { email }) {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  const url = new URL(request.url);
  let from = url.searchParams.get('from');
  let to = url.searchParams.get('to');

  if (!from && !to) {
    const p = defaultPeriod();
    from = p.from; to = p.to;
  }
  if (!isValidIsoDate(from) || !isValidIsoDate(to)) {
    return error('invalid_period', 'período inválido', { status: 400 });
  }
  if (from > to) return error('invalid_period', 'from > to', { status: 400 });

  // Uma query única agrupada — mais barato que 9 queries.
  const stmt = env.DB.prepare(
    `SELECT
       COUNT(*)                                                       AS total,
       SUM(CASE WHEN status='solicitada'           THEN 1 ELSE 0 END) AS solicitada,
       SUM(CASE WHEN status='aguardando_resposta'  THEN 1 ELSE 0 END) AS aguardando_resposta,
       SUM(CASE WHEN status='confirmada'           THEN 1 ELSE 0 END) AS confirmada,
       SUM(CASE WHEN status='remarcada'            THEN 1 ELSE 0 END) AS remarcada,
       SUM(CASE WHEN status='cancelada'            THEN 1 ELSE 0 END) AS cancelada,
       SUM(CASE WHEN status='compareceu'           THEN 1 ELSE 0 END) AS compareceu,
       SUM(CASE WHEN status='no_show'              THEN 1 ELSE 0 END) AS no_show,
       COALESCE(SUM(CASE WHEN status='confirmada' THEN total_pessoas END), 0) AS pessoas_confirmadas,
       COALESCE(SUM(CASE WHEN status='compareceu' THEN total_pessoas END), 0) AS pessoas_compareceu
     FROM reservations
     WHERE data_reserva BETWEEN ? AND ?`
  ).bind(from, to);

  const row = await stmt.first();

  const confirmadas = row.confirmada || 0;
  const compareceu = row.compareceu || 0;
  const noShow = row.no_show || 0;
  const cancelada = row.cancelada || 0;
  const total = row.total || 0;

  // Taxas: base = reservas que chegaram ao dia (confirmada+compareceu+no_show+remarcada já passada... simplificamos)
  const baseAtendimento = compareceu + noShow;
  const taxaComparecimento = baseAtendimento > 0 ? compareceu / baseAtendimento : 0;
  const taxaNoShow = baseAtendimento > 0 ? noShow / baseAtendimento : 0;
  const taxaCancelamento = total > 0 ? cancelada / total : 0;

  return json({
    success: true,
    period: { from, to },
    stats: {
      total,
      solicitada: row.solicitada || 0,
      aguardando_resposta: row.aguardando_resposta || 0,
      confirmada: confirmadas,
      remarcada: row.remarcada || 0,
      cancelada,
      compareceu,
      no_show: noShow,
      pessoas_confirmadas: row.pessoas_confirmadas || 0,
      pessoas_compareceu: row.pessoas_compareceu || 0,
      taxa_comparecimento: Math.round(taxaComparecimento * 10000) / 100,
      taxa_no_show: Math.round(taxaNoShow * 10000) / 100,
      taxa_cancelamento: Math.round(taxaCancelamento * 10000) / 100,
    },
  });
}
