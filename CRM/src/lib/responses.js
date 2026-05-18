// Helpers de resposta HTTP. Não expõe stack traces nem detalhes internos.

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
};

export function json(data, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...SECURITY_HEADERS,
      ...headers,
    },
  });
}

export function error(code, message, { status = 400, extra = {} } = {}) {
  return json({ success: false, error: { code, message, ...extra } }, { status });
}

export function methodNotAllowed(allowed) {
  return new Response(null, {
    status: 405,
    headers: {
      Allow: allowed.join(', '),
      ...SECURITY_HEADERS,
    },
  });
}

export function noContent(headers = {}) {
  return new Response(null, { status: 204, headers: { ...SECURITY_HEADERS, ...headers } });
}
