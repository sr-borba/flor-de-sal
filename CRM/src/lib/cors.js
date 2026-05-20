// CORS restritivo: aceita somente o(s) domínio(s) configurados em ALLOWED_ORIGIN.
// Como a LP e a API rodam no MESMO host, a chamada é same-origin e o browser
// nem envia preflight — mas mantemos a checagem como defesa em profundidade
// caso o endpoint seja chamado de outro contexto (ex: subdomínio).
//
// Suporta três formatos de ALLOWED_ORIGIN:
//   1) "*"                          → wildcard (sem Vary, sem espelhamento de origin)
//   2) "https://a.com,https://b.com" → lista separada por vírgula
//   3) "https://a.com"              → match exato (comportamento original)
export function corsHeaders(request, env) {
  const allowed = env.ALLOWED_ORIGIN;
  const origin = request.headers.get('Origin');

  if (!allowed || !origin) return {};

  // Caso 1: wildcard — retorna '*', sem Vary (RFC 6454).
  if (allowed.trim() === '*') {
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '600',
    };
  }

  // Casos 2 e 3: verifica se a origin está na lista (split por vírgula).
  const list = allowed.split(',').map((s) => s.trim());
  if (!list.includes(origin)) return {};

  return {
    'Access-Control-Allow-Origin': origin, // espelha a origin exata (necessário para credenciais)
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '600',
  };
}

export function isPreflight(request) {
  return request.method === 'OPTIONS' && request.headers.get('Access-Control-Request-Method');
}
