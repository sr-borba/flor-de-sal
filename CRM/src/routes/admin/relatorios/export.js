// GET /api/admin/relatorios/export — devolve CSV das reservas filtradas.
//
// Permission: export_csv (admin, gerente, marketing).
// CSV inclui colunas utm_* SOMENTE pra roles que também têm view_utms
// (admin, marketing). Gerente recebe CSV sem UTMs.
//
// Cap defensivo de 5000 linhas. Se exceder, devolve 413 sugerindo
// filtrar período menor.
//
// UTF-8 com BOM pra abrir bonito no Excel BR.

import { error, methodNotAllowed } from '../../../lib/responses.js';
import { requirePermission, hasPermission } from '../../../lib/permissions.js';
import { buildReportFilters, ORIGEM_EFETIVA_SQL } from '../../../lib/reportFilters.js';

const MAX_ROWS = 5000;

// Escapa um valor pra CSV: quoting com aspas duplas, escapa aspas duplicando.
// Valor null/undefined vira string vazia.
function csvCell(v) {
  if (v == null) return '';
  const s = String(v);
  // Sempre quoting pra ser seguro (vírgulas, quebras de linha, aspas, ; em pt-BR).
  return `"${s.replace(/"/g, '""')}"`;
}

function csvRow(cells) {
  return cells.map(csvCell).join(',');
}

export async function handleRelatoriosExport(request, env, ctx, auth) {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  const denied = requirePermission(auth, 'export_csv', request, env, ctx);
  if (denied) return denied;

  const url = new URL(request.url);
  const f = buildReportFilters(url.searchParams);
  if (!f.ok) {
    return error('invalid_filters', 'Filtros inválidos.', {
      status: 400, extra: { fields: f.errors },
    });
  }
  const { where, params, period } = f;

  // Count primeiro (rápido) pra evitar gerar CSV gigante.
  const countRow = await env.DB
    .prepare(`SELECT COUNT(*) AS n FROM reservations ${where}`)
    .bind(...params)
    .first();
  const totalRows = countRow?.n || 0;
  if (totalRows > MAX_ROWS) {
    return error(
      'too_many_rows',
      `Filtro retorna ${totalRows} reservas (máximo: ${MAX_ROWS}). Refine o período.`,
      { status: 413 },
    );
  }

  // Pode ter linha repetida vinda do utm — não tem, é uma linha por reserva.
  const rows = await env.DB
    .prepare(
      `SELECT
         reservation_code, nome, sobrenome, telefone, email,
         data_reserva, horario, adultos, criancas, total_pessoas,
         ${ORIGEM_EFETIVA_SQL} AS origem_efetiva,
         origem AS origem_raw,
         status,
         utm_source, utm_medium, utm_campaign, utm_content, utm_term,
         criado_em, atualizado_em
       FROM reservations
       ${where}
       ORDER BY data_reserva ASC, horario ASC, id ASC
       LIMIT ?`
    )
    .bind(...params, MAX_ROWS + 1) // +1 só por garantia; já filtramos via count
    .all();

  const items = rows.results || [];
  const canViewUtms = hasPermission(auth.user.role, 'view_utms');

  // Cabeçalho (português, headers amigáveis pra Excel).
  const headerBase = [
    'Código', 'Nome', 'Sobrenome', 'Telefone', 'E-mail',
    'Data', 'Horário', 'Adultos', 'Crianças', 'Pessoas',
    'Origem', 'Status', 'Criado em', 'Atualizado em',
  ];
  const headerUtm = canViewUtms
    ? ['UTM source', 'UTM medium', 'UTM campaign', 'UTM content', 'UTM term']
    : [];

  // Header: o spec pede Criado/Atualizado e UTMs separados; reorganizo
  // pra UTMs ficarem antes dos timestamps (leitura natural).
  const header = canViewUtms
    ? [
        'Código', 'Nome', 'Sobrenome', 'Telefone', 'E-mail',
        'Data', 'Horário', 'Adultos', 'Crianças', 'Pessoas',
        'Origem', 'Status',
        'UTM source', 'UTM medium', 'UTM campaign', 'UTM content', 'UTM term',
        'Criado em', 'Atualizado em',
      ]
    : [
        'Código', 'Nome', 'Sobrenome', 'Telefone', 'E-mail',
        'Data', 'Horário', 'Adultos', 'Crianças', 'Pessoas',
        'Origem', 'Status', 'Criado em', 'Atualizado em',
      ];

  const lines = [csvRow(header)];
  for (const r of items) {
    const baseCells = [
      r.reservation_code, r.nome, r.sobrenome, r.telefone, r.email,
      r.data_reserva, r.horario, r.adultos, r.criancas, r.total_pessoas,
      r.origem_efetiva, r.status,
    ];
    if (canViewUtms) {
      baseCells.push(r.utm_source, r.utm_medium, r.utm_campaign, r.utm_content, r.utm_term);
    }
    baseCells.push(r.criado_em, r.atualizado_em);
    lines.push(csvRow(baseCells));
  }

  // BOM pra Excel detectar UTF-8 sem perguntar.
  const body = '﻿' + lines.join('\r\n') + '\r\n';

  // Audit log: registra exportação. Não bloqueia resposta.
  const auditDetails = JSON.stringify({
    rows: items.length,
    period,
    filters: {
      origem: url.searchParams.get('origem') || null,
      status: url.searchParams.get('status') || null,
      horario: url.searchParams.get('horario') || null,
      utm_campaign: url.searchParams.get('utm_campaign') || null,
      preset: url.searchParams.get('preset') || null,
    },
    inclui_utm: canViewUtms,
  });
  const auditPromise = env.DB
    .prepare(
      `INSERT INTO audit_logs (entidade, entidade_id, acao, usuario_email, detalhes)
       VALUES ('reports', NULL, 'export_csv', ?, ?)`
    )
    .bind(auth.email, auditDetails)
    .run()
    .catch((e) => console.error('audit export_csv falhou', e?.message || e));
  if (ctx?.waitUntil) ctx.waitUntil(auditPromise);

  // Nome do arquivo com período pra facilitar arquivamento.
  const fileName = `reservas_${period.from}_${period.to}.csv`;

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
      // Sem CORS — esse endpoint é same-origin e está atrás do CF Access.
    },
  });
}
