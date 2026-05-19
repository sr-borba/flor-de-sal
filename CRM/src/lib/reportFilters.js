// Builder de filtros pros relatórios (compartilhado entre metricas e export).
//
// Espera URLSearchParams com:
//   preset    — today | yesterday | week | month | last_30d (resolvido p/ from/to)
//   from, to  — ISO datas (sobrepõem preset se ambos presentes e válidos)
//   origem    — origem efetiva: lp|manual|google|meta|instagram|direct|organic|outro
//   status    — solicitada|aguardando_resposta|confirmada|...
//   utm_campaign — string
//   horario   — 19h|19h30|...|21h30
//
// IMPORTANTE: todas as condições WHERE usam parâmetros bindados. NUNCA
// concatenar valores no SQL.

import { isValidIsoDate, resolvePeriodPreset } from './dates.js';
import { cleanString } from './security.js';
import { HORARIOS_PERMITIDOS, STATUS_PERMITIDOS } from './validate.js';

export const ORIGENS_EFETIVAS = new Set([
  'lp', 'manual', 'google', 'meta', 'instagram', 'direct', 'organic', 'outro',
]);

// CASE SQL usado em todas as queries pra calcular origem efetiva.
// Reflete a classificação documentada na memória (Fase 4).
export const ORIGEM_EFETIVA_SQL = `
  CASE
    WHEN origem = 'manual' THEN 'manual'
    WHEN LOWER(COALESCE(utm_source, '')) LIKE '%google%' THEN 'google'
    WHEN LOWER(COALESCE(utm_source, '')) IN ('facebook', 'fb', 'meta') THEN 'meta'
    WHEN LOWER(COALESCE(utm_source, '')) IN ('instagram', 'ig') THEN 'instagram'
    WHEN (utm_source IS NULL OR utm_source = '')
      AND (referrer IS NULL OR referrer = '') THEN 'direct'
    WHEN (utm_source IS NULL OR utm_source = '') THEN 'organic'
    ELSE 'outro'
  END
`;

// Constrói { where, params, period } a partir dos searchParams.
// `period` é { from, to } sempre — se nada vier, default = últimos 30 dias.
export function buildReportFilters(searchParams) {
  const errs = [];
  const where = [];
  const params = [];

  // Período: preset OR (from + to). Default = últimos 30 dias.
  let from = cleanString(searchParams.get('from'), { maxLen: 10 });
  let to = cleanString(searchParams.get('to'), { maxLen: 10 });
  const preset = cleanString(searchParams.get('preset'), { maxLen: 20 });

  if (from && to) {
    if (!isValidIsoDate(from) || !isValidIsoDate(to)) {
      errs.push({ field: 'period', message: 'datas inválidas' });
    } else if (from > to) {
      errs.push({ field: 'period', message: 'from > to' });
    }
  } else if (preset) {
    const p = resolvePeriodPreset(preset);
    if (!p) errs.push({ field: 'preset', message: 'preset inválido' });
    else { from = p.from; to = p.to; }
  } else {
    const p = resolvePeriodPreset('last_30d');
    from = p.from; to = p.to;
  }

  if (errs.length === 0) {
    where.push('data_reserva BETWEEN ? AND ?');
    params.push(from, to);
  }

  // Origem efetiva: filtra contra o CASE.
  const origem = cleanString(searchParams.get('origem'), { maxLen: 20 });
  if (origem) {
    if (!ORIGENS_EFETIVAS.has(origem)) {
      errs.push({ field: 'origem', message: 'origem inválida' });
    } else {
      where.push(`${ORIGEM_EFETIVA_SQL} = ?`);
      params.push(origem);
    }
  }

  const status = cleanString(searchParams.get('status'), { maxLen: 30 });
  if (status) {
    if (!STATUS_PERMITIDOS.has(status)) {
      errs.push({ field: 'status', message: 'status inválido' });
    } else {
      where.push('status = ?');
      params.push(status);
    }
  }

  const horario = cleanString(searchParams.get('horario'), { maxLen: 10 });
  if (horario) {
    if (!HORARIOS_PERMITIDOS.has(horario)) {
      errs.push({ field: 'horario', message: 'horário inválido' });
    } else {
      where.push('horario = ?');
      params.push(horario);
    }
  }

  // Campanha UTM: LIKE com cap de 100 chars pra evitar payloads patológicos.
  const utmCampaign = cleanString(searchParams.get('utm_campaign'), { maxLen: 100 });
  if (utmCampaign) {
    where.push('LOWER(COALESCE(utm_campaign, \'\')) = LOWER(?)');
    params.push(utmCampaign);
  }

  if (errs.length > 0) return { ok: false, errors: errs };

  return {
    ok: true,
    where: where.length ? `WHERE ${where.join(' AND ')}` : '',
    params,
    period: { from, to },
  };
}
