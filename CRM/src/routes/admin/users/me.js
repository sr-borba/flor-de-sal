// GET /api/admin/users/me  — perfil do próprio usuário
// PATCH /api/admin/users/me — atualiza nome/sobrenome do próprio usuário
//
// Disponível pra qualquer role autenticada e ativa.

import { json, error, methodNotAllowed } from '../../../lib/responses.js';
import { isJsonRequest } from '../../../lib/security.js';
import { validateUserSelfUpdate } from '../../../lib/validate.js';
import { rolePermissions } from '../../../lib/permissions.js';

export async function handleUsersMeGet(request, env, ctx, auth) {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  return json({
    success: true,
    user: {
      id: auth.user.id,
      nome: auth.user.nome,
      sobrenome: auth.user.sobrenome,
      email: auth.user.email,
      role: auth.user.role,
      ativo: auth.user.ativo,
    },
    permissions: rolePermissions(auth.user.role),
  });
}

export async function handleUsersMePatch(request, env, ctx, auth) {
  if (request.method !== 'PATCH') return methodNotAllowed(['PATCH']);

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

  const result = validateUserSelfUpdate(body);
  if (!result.ok) {
    return error('validation_failed', 'Dados inválidos.', {
      status: 400,
      extra: { fields: result.errors },
    });
  }
  const patch = result.data;

  const sets = [];
  const params = [];
  const detalhes = {};
  for (const k of ['nome', 'sobrenome']) {
    if (patch[k] !== undefined) {
      sets.push(`${k} = ?`);
      params.push(patch[k]);
      if (auth.user[k] !== patch[k]) detalhes[k] = { de: auth.user[k], para: patch[k] };
    }
  }
  if (sets.length === 0) {
    return error('no_changes', 'Nenhuma alteração informada', { status: 400 });
  }
  params.push(auth.user.id);

  try {
    await env.DB.batch([
      env.DB.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).bind(...params),
      env.DB.prepare(
        `INSERT INTO audit_logs (entidade, entidade_id, acao, usuario_email, detalhes)
         VALUES ('users', ?, 'update_self', ?, ?)`
      ).bind(auth.user.id, auth.email, JSON.stringify(detalhes)),
    ]);

    const updated = await env.DB
      .prepare(
        `SELECT id, nome, sobrenome, email, role, ativo
           FROM users WHERE id = ?`
      )
      .bind(auth.user.id)
      .first();

    return json({ success: true, user: updated });
  } catch (e) {
    console.error('usersMePatch: erro D1', e?.message || e);
    return error('internal', 'Falha ao atualizar perfil.', { status: 500 });
  }
}
