import { json, methodNotAllowed } from '../lib/responses.js';

export async function handleHealth(request, env) {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);
  return json({ ok: true, service: 'flor-de-sal-reservas' });
}
