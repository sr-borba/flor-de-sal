// Helpers de data. Cliente envia from/to em ISO (YYYY-MM-DD). Server só valida.
// Para "hoje" do ponto de vista da operação (UTC-3), o cliente computa em local time.

const RE_ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const OPERATION_TIME_ZONE = 'America/Sao_Paulo';

export function isValidIsoDate(s) {
  if (!s || !RE_ISO_DATE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export function todayIsoSaoPaulo(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: OPERATION_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const byType = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

// Retorna { from, to } sanitizados ou null se inválidos.
// Aceita query params; se ausentes, retorna null (caller decide default).
export function parsePeriodFromQuery(searchParams) {
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  if (!from && !to) return null;
  if (!isValidIsoDate(from) || !isValidIsoDate(to)) return null;
  if (from > to) return null;
  // Cap defensivo: range máximo de 366 dias
  const fromDt = new Date(`${from}T00:00:00Z`).getTime();
  const toDt = new Date(`${to}T00:00:00Z`).getTime();
  if ((toDt - fromDt) / (24 * 3600 * 1000) > 366) return null;
  return { from, to };
}

// Adiciona/subtrai dias de uma data ISO (YYYY-MM-DD), retornando ISO.
export function addDaysIso(iso, days) {
  const dt = new Date(`${iso}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

// Resolve um preset ("today" | "yesterday" | "week" | "month" | "last_30d")
// em { from, to } ISO no fuso de operação (America/Sao_Paulo).
// Retorna null se preset desconhecido.
export function resolvePeriodPreset(preset, now = new Date()) {
  const today = todayIsoSaoPaulo(now);
  switch (preset) {
    case 'today':
      return { from: today, to: today };
    case 'yesterday': {
      const y = addDaysIso(today, -1);
      return { from: y, to: y };
    }
    case 'week': {
      // Semana operacional: domingo a sábado contendo "hoje".
      // Calcula dia da semana via Date.UTC do today (sem TZ — só pra dow).
      const [y, m, d] = today.split('-').map(Number);
      const todayDt = new Date(Date.UTC(y, m - 1, d));
      const dow = todayDt.getUTCDay(); // 0=Dom..6=Sáb
      const from = addDaysIso(today, -dow);
      const to = addDaysIso(from, 6);
      return { from, to };
    }
    case 'month': {
      const [y, m] = today.split('-').map(Number);
      const from = `${y}-${String(m).padStart(2, '0')}-01`;
      // Último dia do mês: dia 0 do mês seguinte.
      const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const to = `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
      return { from, to };
    }
    case 'last_30d': {
      return { from: addDaysIso(today, -29), to: today };
    }
    default:
      return null;
  }
}
