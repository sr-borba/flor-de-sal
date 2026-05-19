// GET /api/admin/users — lista todos os usuários internos.
// Apenas admin. Não expõe campos sensíveis (não há senha, mas mantemos
// a lista explícita de colunas pra evitar vazamento futuro).

import { json, methodNotAllowed } from '../../../lib/responses.js';
import { requirePermission } from '../../../lib/permissions.js';

export async function handleUsersList(request, env, ctx, auth) {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  const denied = requirePermission(auth, 'manage_users', request, env, ctx);
  if (denied) return denied;

  const rows = await env.DB
    .prepare(
      `SELECT id, nome, sobrenome, email, role, ativo, criado_em, atualizado_em
         FROM users
        ORDER BY ativo DESC, nome ASC, id ASC`
    )
    .all();

  return json({ success: true, items: rows.results || [] });
}
