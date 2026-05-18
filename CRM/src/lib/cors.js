// CORS restritivo: aceita somente o domínio oficial.
// Como a LP e a API rodam no MESMO host, a chamada é same-origin e o browser
// nem envia preflight — mas mantemos a checagem como defesa em profundidade
// caso o endpoint seja chamado de outro contexto (ex: subdomínio).

export function corsHeaders(request, env) {
  const allowed = env.ALLOWED_ORIGIN;
  const origin = request.headers.get('Origin');
  if (!allowed || !origin || origin !== allowed) {
    return {};
  }
  return {
    'Access-Control-Allow-Origin': allowed,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '600',
  };
}

export function isPreflight(request) {
  return request.method === 'OPTIONS' && request.headers.get('Access-Control-Request-Method');
}
