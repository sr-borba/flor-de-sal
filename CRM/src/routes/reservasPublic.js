// POST /api/reservas/public — endpoint público chamado pela LP.
// Importante: criatividade ZERO em segurança. Tudo via prepared statements,
// validação rígida server-side, IP hashado, sem segredos no front.

import { json, error, methodNotAllowed } from '../lib/responses.js';
import { corsHeaders } from '../lib/cors.js';
import { validateReservaPublic } from '../lib/validate.js';
import { hashIp, getClientIp, isJsonRequest, cleanString } from '../lib/security.js';
import { tempCode, formatReservationCode } from '../lib/codes.js';

const ALLOWED_METHODS = ['POST', 'OPTIONS'];

export async function handleReservasPublic(request, env, ctx) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  }
  if (request.method !== 'POST') return methodNotAllowed(ALLOWED_METHODS);

  if (!isJsonRequest(request)) {
    return error('invalid_content_type', 'Content-Type deve ser application/json', { status: 415 });
  }

  // Limite defensivo de payload (~16KB suficiente para esse formulário)
  let body;
  try {
    const raw = await request.text();
    if (raw.length > 16 * 1024) {
      return error('payload_too_large', 'payload excede limite', { status: 413 });
    }
    body = JSON.parse(raw);
  } catch {
    return error('invalid_json', 'JSON inválido', { status: 400 });
  }

  const result = validateReservaPublic(body);
  const cors = corsHeaders(request, env);

  // Honeypot: respondemos 200 silencioso para não dar feedback ao bot.
  if (!result.ok && result.honeypot) {
    return json({ success: true }, { headers: cors });
  }

  if (!result.ok) {
    return error('validation_failed', 'Dados inválidos.', {
      status: 400,
      extra: { fields: result.errors },
    });
  }

  const data = result.data;
  const ip = getClientIp(request);
  const ipHash = await hashIp(ip, env.IP_HASH_SALT);
  const userAgent = cleanString(request.headers.get('User-Agent'), { maxLen: 500 });
  // Se a LP não enviou landing_page, infere do Referer.
  const landingPage = data.landing_page || cleanString(request.headers.get('Referer'), { maxLen: 500 });

  try {
    // 1) INSERT com código temporário (UNIQUE) — pega id via RETURNING.
    const inserted = await env.DB
      .prepare(
        `INSERT INTO reservations (
          reservation_code, nome, sobrenome, email, telefone,
          data_reserva, horario, adultos, criancas, total_pessoas,
          observacoes, origem, status,
          utm_source, utm_medium, utm_campaign, utm_content, utm_term,
          referrer, landing_page, user_agent, ip_hash
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, 'lp', 'solicitada',
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?
        )
        RETURNING id`
      )
      .bind(
        tempCode(),
        data.nome,
        data.sobrenome,
        data.email,
        data.telefone,
        data.data_reserva,
        data.horario,
        data.adultos,
        data.criancas,
        data.total_pessoas,
        data.observacoes,
        data.utm_source,
        data.utm_medium,
        data.utm_campaign,
        data.utm_content,
        data.utm_term,
        data.referrer,
        landingPage,
        userAgent,
        ipHash,
      )
      .first();

    if (!inserted || typeof inserted.id !== 'number') {
      // Não vaza detalhes — log no observability do Worker.
      console.error('reservasPublic: insert sem id', inserted);
      return error('internal', 'Falha ao registrar reserva.', { status: 500, headers: cors });
    }

    const reservaId = inserted.id;
    const code = formatReservationCode(reservaId);

    // 2) Batch atômico: code final + status history + audit log.
    await env.DB.batch([
      env.DB.prepare(`UPDATE reservations SET reservation_code = ? WHERE id = ?`).bind(code, reservaId),
      env.DB.prepare(
        `INSERT INTO reservation_status_history (reservation_id, status_anterior, status_novo)
         VALUES (?, NULL, 'solicitada')`
      ).bind(reservaId),
      env.DB.prepare(
        `INSERT INTO audit_logs (entidade, entidade_id, acao, detalhes)
         VALUES ('reservations', ?, 'create_public', ?)`
      ).bind(reservaId, JSON.stringify({ origem: 'lp', code })),
    ]);

    return json(
      { success: true, reserva_id: reservaId, reservation_code: code },
      { status: 201, headers: cors },
    );
  } catch (e) {
    // Não devolve a mensagem do erro ao cliente — fica no log do Worker.
    console.error('reservasPublic: erro D1', e?.message || e);
    return error('internal', 'Falha ao registrar reserva.', { status: 500 });
  }
}
