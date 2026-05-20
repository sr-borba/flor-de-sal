// Validação rígida de payloads de reserva (público e admin).

import { cleanString } from './security.js';
import { todayIsoSaoPaulo } from './dates.js';

export const HORARIOS_PERMITIDOS = new Set([
  '12h', '12h30', '13h', '13h30', '14h', '14h30', '15h',
  '19h', '19h30', '20h', '20h30', '21h', '21h30',
]);

export const STATUS_PERMITIDOS = new Set([
  'solicitada', 'aguardando_resposta', 'confirmada',
  'remarcada', 'cancelada', 'compareceu', 'no_show',
]);

export const ROLES_PERMITIDOS = new Set(['admin', 'gerente', 'concierge', 'marketing']);

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

  const today = todayIsoSaoPaulo();
  const todayUtc = new Date(`${today}T00:00:00Z`);
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

// normalizePhone: aceita formato BR comum, devolve só dígitos. Exportado para reuso.
export function normalizePhoneBr(raw) {
  if (raw == null) return null;
  const digits = String(raw).replace(/\D+/g, '');
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

// Cadastro manual (admin). Mais flexível na data (admin pode marcar passado se quiser),
// mas mantém o resto rígido.
export function validateReservaManual(body) {
  const errs = [];
  if (!body || typeof body !== 'object') {
    return { ok: false, errors: [{ field: '_root', message: 'payload inválido' }] };
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

  const telefone = normalizePhoneBr(body.telefone);
  if (!telefone) pushErr(errs, 'telefone', 'obrigatório (8-15 dígitos)');

  const dataReserva = cleanString(body.data_reserva, { maxLen: 10 });
  if (!dataReserva || !RE_ISO_DATE.test(dataReserva)) {
    pushErr(errs, 'data_reserva', 'data inválida (YYYY-MM-DD)');
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
  const observacoesInternas = cleanString(body.observacoes_internas, { maxLen: 2000 });

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
      observacoes_internas: observacoesInternas,
    },
  };
}

// Validação de mudança de status. statusAtual vem do DB.
// Regras: cancelada exige motivo; remarcada exige nova_data + novo_horario;
// compareceu só pode ser marcado para data_reserva <= hoje.
export function validateStatusChange(body, { statusAtual, dataReserva }) {
  const errs = [];
  if (!body || typeof body !== 'object') {
    return { ok: false, errors: [{ field: '_root', message: 'payload inválido' }] };
  }

  const statusNovo = cleanString(body.status_novo, { maxLen: 30 });
  if (!statusNovo || !STATUS_PERMITIDOS.has(statusNovo)) {
    pushErr(errs, 'status_novo', 'status inválido');
    return { ok: false, errors: errs };
  }

  const motivo = cleanString(body.motivo, { maxLen: 500 });
  let novaData = null;
  let novoHorario = null;

  if (statusNovo === 'cancelada' && !motivo) {
    pushErr(errs, 'motivo', 'cancelamento exige motivo');
  }

  if (statusNovo === 'remarcada') {
    novaData = cleanString(body.nova_data, { maxLen: 10 });
    novoHorario = cleanString(body.novo_horario, { maxLen: 10 });
    if (!novaData || !RE_ISO_DATE.test(novaData)) {
      pushErr(errs, 'nova_data', 'nova data inválida (YYYY-MM-DD)');
    }
    if (!novoHorario || !HORARIOS_PERMITIDOS.has(novoHorario)) {
      pushErr(errs, 'novo_horario', 'novo horário não permitido');
    }
  }

  if (statusNovo === 'compareceu') {
    const hoje = todayIsoSaoPaulo();
    if (dataReserva && dataReserva > hoje) {
      pushErr(errs, 'status_novo', 'compareceu só pode ser marcado a partir do dia da reserva');
    }
  }

  if (errs.length > 0) return { ok: false, errors: errs };

  return {
    ok: true,
    data: {
      status_anterior: statusAtual,
      status_novo: statusNovo,
      motivo,
      nova_data: novaData,
      novo_horario: novoHorario,
    },
  };
}

// Cadastro de usuário interno (admin → POST /api/admin/users).
// Email é único (UNIQUE COLLATE NOCASE no schema). Conferência de duplicidade
// fica no handler — aqui só validamos formato.
export function validateUserCreate(body) {
  const errs = [];
  if (!body || typeof body !== 'object') {
    return { ok: false, errors: [{ field: '_root', message: 'payload inválido' }] };
  }

  const nome = cleanString(body.nome, { maxLen: 100 });
  if (!nome || nome.length < 2) pushErr(errs, 'nome', 'obrigatório (2-100 chars)');

  const sobrenome = cleanString(body.sobrenome, { maxLen: 100 });

  const emailRaw = cleanString(body.email, { maxLen: 200 });
  let email = null;
  if (!emailRaw) {
    pushErr(errs, 'email', 'obrigatório');
  } else if (!RE_EMAIL.test(emailRaw)) {
    pushErr(errs, 'email', 'formato inválido');
  } else {
    email = emailRaw.toLowerCase();
  }

  const role = cleanString(body.role, { maxLen: 20 });
  if (!role || !ROLES_PERMITIDOS.has(role)) {
    pushErr(errs, 'role', 'role inválida');
  }

  // ativo é opcional no create; default 1.
  let ativo = 1;
  if (body.ativo === 0 || body.ativo === false) ativo = 0;
  else if (body.ativo === 1 || body.ativo === true || body.ativo == null) ativo = 1;
  else pushErr(errs, 'ativo', 'valor inválido');

  if (errs.length > 0) return { ok: false, errors: errs };
  return { ok: true, data: { nome, sobrenome, email, role, ativo } };
}

// Atualização de usuário pelo admin (PATCH /api/admin/users/:id).
// Email NUNCA muda por aqui — fluxo administrativo separado (recriar usuário).
// Devolve só os campos enviados; caller decide o que aplicar.
export function validateUserUpdate(body) {
  const errs = [];
  if (!body || typeof body !== 'object') {
    return { ok: false, errors: [{ field: '_root', message: 'payload inválido' }] };
  }

  const patch = {};

  if (body.nome !== undefined) {
    const v = cleanString(body.nome, { maxLen: 100 });
    if (!v || v.length < 2) pushErr(errs, 'nome', 'obrigatório (2-100 chars)');
    else patch.nome = v;
  }

  if (body.sobrenome !== undefined) {
    patch.sobrenome = cleanString(body.sobrenome, { maxLen: 100 });
  }

  if (body.role !== undefined) {
    const v = cleanString(body.role, { maxLen: 20 });
    if (!v || !ROLES_PERMITIDOS.has(v)) pushErr(errs, 'role', 'role inválida');
    else patch.role = v;
  }

  if (body.ativo !== undefined) {
    if (body.ativo === 0 || body.ativo === false) patch.ativo = 0;
    else if (body.ativo === 1 || body.ativo === true) patch.ativo = 1;
    else pushErr(errs, 'ativo', 'valor inválido');
  }

  if (body.email !== undefined) {
    pushErr(errs, 'email', 'e-mail não pode ser alterado por essa rota');
  }

  if (Object.keys(patch).length === 0 && errs.length === 0) {
    pushErr(errs, '_root', 'nenhum campo informado');
  }

  if (errs.length > 0) return { ok: false, errors: errs };
  return { ok: true, data: patch };
}

// Auto-update do próprio usuário (PATCH /api/admin/users/me).
// Só nome e sobrenome. Tentativa de mudar role/email/ativo é rejeitada
// silenciosamente (ignora os campos), nunca propaga.
export function validateUserSelfUpdate(body) {
  const errs = [];
  if (!body || typeof body !== 'object') {
    return { ok: false, errors: [{ field: '_root', message: 'payload inválido' }] };
  }

  const patch = {};

  if (body.nome !== undefined) {
    const v = cleanString(body.nome, { maxLen: 100 });
    if (!v || v.length < 2) pushErr(errs, 'nome', 'obrigatório (2-100 chars)');
    else patch.nome = v;
  }

  if (body.sobrenome !== undefined) {
    patch.sobrenome = cleanString(body.sobrenome, { maxLen: 100 });
  }

  // role/ativo/email enviados por aqui são erros explícitos pra deixar o
  // contrato claro pro front (em vez de aceitar e ignorar silenciosamente).
  for (const forbidden of ['role', 'ativo', 'email', 'id']) {
    if (body[forbidden] !== undefined) {
      pushErr(errs, forbidden, 'campo não pode ser alterado por essa rota');
    }
  }

  if (Object.keys(patch).length === 0 && errs.length === 0) {
    pushErr(errs, '_root', 'nenhum campo informado');
  }

  if (errs.length > 0) return { ok: false, errors: errs };
  return { ok: true, data: patch };
}
