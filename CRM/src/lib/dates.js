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
