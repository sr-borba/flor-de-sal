// Validação rígida do payload público de reserva.
// Devolve { ok: true, data } ou { ok: false, errors: [...] }.

import { cleanString } from './security.js';

const HORARIOS_PERMITIDOS = new Set([
  '19h', '19h30', '20h', '20h30', '21h', '21h30',
]);

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RE_ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function pushErr(errs, field, message) {
  errs.push({ field, message });
}

function parseIntStrict(value, { min, max }) {
  const n = Number(value);
  if (!Number.isInteger(n)) return NaN;
  if (n < min || n > max) return NaN;
  return n;
}

function isValidFutureDate(iso) {
  if (!RE_ISO_DATE.test(iso)) return false;
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) return false;

  const today = new Date();
  const todayUtc = new Date(Date.UTC(
    today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()
  ));
  const maxDt = new Date(todayUtc.getTime() + 365 * 24 * 3600 * 1000);
  return dt.getTime() >= todayUtc.getTime() && dt.getTime() <= maxDt.getTime();
}

// telefone: aceita formatos brasileiros comuns, normaliza para dígitos.
function normalizePhone(raw) {
  if (raw == null) return null;
  const digits = String(raw).replace(/\D+/g, '');
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

export function validateReservaPublic(body) {
  const errs = [];
  if (!body || typeof body !== 'object') {
    return { ok: false, errors: [{ field: '_root', message: 'payload inválido' }] };
  }

  // Honeypot: se preenchido, é bot. Não devolve erro detalhado.
  if (body._hp != null && String(body._hp).trim() !== '') {
    return { ok: false, errors: [{ field: '_hp', message: 'rejeitado' }], honeypot: true };
  }

  const nome = cleanString(body.nome, { maxLen: 100 });
  if (!nome || nome.length < 2) pushErr(errs, 'nome', 'obrigatório (2-100 chars)');

  const sobrenome = cleanString(body.sobrenome, { maxLen: 100 });

  const emailRaw = cleanString(body.email, { maxLen: 200 });
  let email = null;
  if (emailRaw) {
    if (!RE_EMAIL.test(emailRaw)) pushErr(errs, 'email', 'formato inválido');
    else email = emailRaw.toLowerCase();
  }

  const telefone = normalizePhone(body.telefone ?? body.celular);
  if (!telefone) pushErr(errs, 'telefone', 'obrigatório (8-15 dígitos)');

  const dataReserva = cleanString(body.data_reserva ?? body.data, { maxLen: 10 });
  if (!dataReserva || !isValidFutureDate(dataReserva)) {
    pushErr(errs, 'data_reserva', 'data inválida ou fora do intervalo (hoje a +365 dias)');
  }

  const horario = cleanString(body.horario, { maxLen: 10 });
  if (!horario || !HORARIOS_PERMITIDOS.has(horario)) {
    pushErr(errs, 'horario', 'horário não permitido');
  }

  const adultos = parseIntStrict(body.adultos, { min: 1, max: 30 });
  if (Number.isNaN(adultos)) pushErr(errs, 'adultos', 'inteiro entre 1 e 30');

  const criancas = parseIntStrict(body.criancas ?? 0, { min: 0, max: 30 });
  if (Number.isNaN(criancas)) pushErr(errs, 'criancas', 'inteiro entre 0 e 30');

  const observacoes = cleanString(body.observacoes, { maxLen: 1000 });

  // UTMs / contexto — opcionais, tudo string curta.
  const utm = {
    utm_source:   cleanString(body.utm_source,   { maxLen: 200 }),
    utm_medium:   cleanString(body.utm_medium,   { maxLen: 200 }),
    utm_campaign: cleanString(body.utm_campaign, { maxLen: 200 }),
    utm_content:  cleanString(body.utm_content,  { maxLen: 200 }),
    utm_term:     cleanString(body.utm_term,     { maxLen: 200 }),
  };
  const referrer = cleanString(body.referrer, { maxLen: 500 });
  const landingPage = cleanString(body.landing_page, { maxLen: 500 });

  if (errs.length > 0) return { ok: false, errors: errs };

  return {
    ok: true,
    data: {
      nome,
      sobrenome,
      email,
      telefone,
      data_reserva: dataReserva,
      horario,
      adultos,
      criancas,
      total_pessoas: adultos + criancas,
      observacoes,
      ...utm,
      referrer,
      landing_page: landingPage,
    },
  };
}
