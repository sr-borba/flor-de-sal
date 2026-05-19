// PATCH /api/admin/users/:id — edita nome, sobrenome, role e ativo.
// Apenas admin. Bloqueia autodesativação e auto-rebaixamento.

import { json, error, methodNotAllowed } from '../../../lib/responses.js';
import { isJsonRequest } from '../../../lib/security.js';
import { validateUserUpdate } from '../../../lib/validate.js';
import { requirePermission } from '../../../lib/permissions.js';

export async function handleUsersUpdate(request, env, ctx, auth, id) {
  if (request.method !== 'PATCH') return methodNotAllowed(['PATCH']);

  const denied = requirePermission(auth, 'manage_users', request, env, ctx);
  if (denied) return denied;

  if (!isJsonRequest(request)) {
    return error('invalid_content_type', 'Content-Type deve ser application/json', { status: 415 });
  }

  const userId = parseInt(id, 10);
  if (!Number.isInteger(userId) || userId < 1) {
    return error('invalid_id', 'id inválido', { status: 400 });
  }

  let body;
  try {
    const raw = await request.text();
    if (raw.length > 4 * 1024) return error('payload_too_large', 'payload excede limite', { status: 413 });
    body = JSON.parse(raw);
  } catch {
    return error('invalid_json', 'JSON inválido', { status: 400 });
  }

  const result = validateUserUpdate(body);
  if (!result.ok) {
    return error('validation_failed', 'Dados inválidos.', {
      status: 400,
      extra: { fields: result.errors },
    });
  }
  const patch = result.data;

  const existing = await env.DB
    .prepare(`SELECT id, nome, sobrenome, email, role, ativo FROM users WHERE id = ?`)
    .bind(userId)
    .first();
  if (!existing) return error('not_found', 'usuário não encontrado', { status: 404 });

  const isSelf = existing.id === auth.user.id;

  // Guardrails:
  // 1) Ninguém pode se autodesativar (admin se trancaria do sistema).
  if (isSelf && patch.ativo === 0) {
    return error('self_deactivate', 'Você não pode desativar a si mesmo.', { status: 400 });
  }
  // 2) Admin não pode rebaixar a si mesmo (mesma lógica: evita ficar sem admin
  //    por acidente). Se quiser deixar de ser admin, outro admin precisa fazer.
  if (isSelf && patch.role !== undefined && patch.role !== existing.role) {
    return error('self_role_change', 'Você não pode alterar a própria role.', { status: 400 });
  }

  // Monta UPDATE só com os campos enviados.
  const sets = [];
  const params = [];
  const detalhes = {};
  for (const k of ['nome', 'sobrenome', 'role', 'ativo']) {
    if (patch[k] !== undefined) {
      sets.push(`${k} = ?`);
      params.push(patch[k]);
      if (existing[k] !== patch[k]) detalhes[k] = { de: existing[k], para: patch[k] };
    }
  }
  if (sets.length === 0) {
    return error('no_changes', 'Nenhuma alteração informada', { status: 400 });
  }
  params.push(userId);

  try {
    await env.DB.batch([
      env.DB.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).bind(...params),
      env.DB.prepare(
        `INSERT INTO audit_logs (entidade, entidade_id, acao, usuario_email, detalhes)
         VALUES ('users', ?, 'update', ?, ?)`
      ).bind(userId, auth.email, JSON.stringify(detalhes)),
    ]);

    const updated = await env.DB
      .prepare(
        `SELECT id, nome, sobrenome, email, role, ativo, criado_em, atualizado_em
           FROM users WHERE id = ?`
      )
      .bind(userId)
      .first();

    return json({ success: true, user: updated });
  } catch (e) {
    console.error('usersUpdate: erro D1', e?.message || e);
    return error('internal', 'Falha ao atualizar usuário.', { status: 500 });
  }
}
