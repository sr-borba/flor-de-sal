// POST /api/admin/users — cria usuário interno.
// Apenas admin.

import { json, error, methodNotAllowed } from '../../../lib/responses.js';
import { isJsonRequest } from '../../../lib/security.js';
import { validateUserCreate } from '../../../lib/validate.js';
import { requirePermission } from '../../../lib/permissions.js';

export async function handleUsersCreate(request, env, ctx, auth) {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  const denied = requirePermission(auth, 'manage_users', request, env, ctx);
  if (denied) return denied;

  if (!isJsonRequest(request)) {
    return error('invalid_content_type', 'Content-Type deve ser application/json', { status: 415 });
  }

  let body;
  try {
    const raw = await request.text();
    if (raw.length > 4 * 1024) return error('payload_too_large', 'payload excede limite', { status: 413 });
    body = JSON.parse(raw);
  } catch {
    return error('invalid_json', 'JSON inválido', { status: 400 });
  }

  const result = validateUserCreate(body);
  if (!result.ok) {
    return error('validation_failed', 'Dados inválidos.', {
      status: 400,
      extra: { fields: result.errors },
    });
  }
  const d = result.data;

  // Verifica duplicidade explicitamente pra devolver erro amigável
  // (UNIQUE constraint dispararia 500 genérico).
  const existing = await env.DB
    .prepare(`SELECT id FROM users WHERE email = ?`)
    .bind(d.email)
    .first();
  if (existing) {
    return error('email_taken', 'Já existe usuário com esse e-mail.', { status: 409 });
  }

  try {
    const inserted = await env.DB
      .prepare(
        `INSERT INTO users (nome, sobrenome, email, role, ativo)
         VALUES (?, ?, ?, ?, ?)
         RETURNING id, nome, sobrenome, email, role, ativo, criado_em`
      )
      .bind(d.nome, d.sobrenome, d.email, d.role, d.ativo)
      .first();

    if (!inserted || typeof inserted.id !== 'number') {
      console.error('usersCreate: insert sem id', inserted);
      return error('internal', 'Falha ao criar usuário.', { status: 500 });
    }

    await env.DB
      .prepare(
        `INSERT INTO audit_logs (entidade, entidade_id, acao, usuario_email, detalhes)
         VALUES ('users', ?, 'create', ?, ?)`
      )
      .bind(
        inserted.id,
        auth.email,
        JSON.stringify({ email: d.email, role: d.role, ativo: d.ativo }),
      )
      .run();

    return json({ success: true, user: inserted }, { status: 201 });
  } catch (e) {
    console.error('usersCreate: erro D1', e?.message || e);
    return error('internal', 'Falha ao criar usuário.', { status: 500 });
  }
}
