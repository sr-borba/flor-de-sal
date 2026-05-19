// Verificação de JWT do Cloudflare Access.
//
// Cloudflare Access protege rotas (configurado no dashboard Zero Trust).
// Quando um request atravessa Access, CF anexa dois headers:
//   - Cf-Access-Jwt-Assertion : JWT assinado por chave RS256 do team
//   - Cf-Access-Authenticated-User-Email : e-mail do usuário autenticado
//
// O Worker NÃO confia cegamente no header de e-mail (poderia ser spoofado
// se Access estivesse desconfigurado). Em vez disso, valida o JWT:
//   1) Assinatura contra JWKS público do team
//   2) `iss` bate com team domain
//   3) `exp` não passou
//   4) Extrai e-mail do claim `email`
//
// As chaves do JWKS são cacheadas em memória do isolate por 1h.
// Sem AUD check porque temos só 1 app — adicionar quando criar a 2ª.

let jwksCache = null;
let jwksCacheExpiry = 0;
const JWKS_TTL_MS = 60 * 60 * 1000; // 1h

async function fetchJwks(teamDomain) {
  const now = Date.now();
  if (jwksCache && now < jwksCacheExpiry) return jwksCache;

  const url = `https://${teamDomain}/cdn-cgi/access/certs`;
  const res = await fetch(url, { cf: { cacheTtl: 3600, cacheEverything: true } });
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
  const body = await res.json();
  if (!body.keys || !Array.isArray(body.keys)) throw new Error('JWKS malformado');
  jwksCache = body.keys;
  jwksCacheExpiry = now + JWKS_TTL_MS;
  return jwksCache;
}

function base64UrlToUint8Array(b64url) {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function base64UrlDecodeJson(b64url) {
  const bytes = base64UrlToUint8Array(b64url);
  const text = new TextDecoder().decode(bytes);
  return JSON.parse(text);
}

async function importJwk(jwk) {
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
}

async function verifyJwt(token, teamDomain) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('jwt malformado');

  const [headerB64, payloadB64, signatureB64] = parts;
  const header = base64UrlDecodeJson(headerB64);
  const payload = base64UrlDecodeJson(payloadB64);

  if (header.alg !== 'RS256') throw new Error('alg não suportado');
  if (!header.kid) throw new Error('kid ausente');

  const expectedIss = `https://${teamDomain}`;
  if (payload.iss !== expectedIss) throw new Error('iss inválido');

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp < now) throw new Error('expirado');
  if (typeof payload.iat === 'number' && payload.iat > now + 60) throw new Error('iat futuro');

  const keys = await fetchJwks(teamDomain);
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('kid não encontrado no JWKS');

  const cryptoKey = await importJwk(jwk);
  const signature = base64UrlToUint8Array(signatureB64);
  const signed = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, signature, signed);
  if (!ok) throw new Error('assinatura inválida');

  return payload;
}

// Erros que o caller distingue:
//   AuthError    → 401 (sem JWT, JWT inválido, expirado)
//   NoAccountError → 403 com mensagem "conta não cadastrada"
//   InactiveError  → 403 com mensagem "conta desativada"
export class AuthError extends Error {}
export class NoAccountError extends Error {}
export class InactiveError extends Error {}

// Retorna { email, user, payload } se autenticado E autorizado, ou lança.
// `user` é o registro da tabela users — fonte de verdade pra role/ativo.
// Uso:
//   try {
//     const auth = await requireAdminAuth(request, env);
//   } catch (e) {
//     if (e instanceof NoAccountError) return 403 "conta não cadastrada"
//     if (e instanceof InactiveError) return 403 "conta desativada"
//     return 401
//   }
export async function requireAdminAuth(request, env) {
  if (!env.ACCESS_TEAM_DOMAIN) {
    throw new AuthError('ACCESS_TEAM_DOMAIN não configurado');
  }
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) throw new AuthError('jwt ausente');

  let payload;
  try {
    payload = await verifyJwt(token, env.ACCESS_TEAM_DOMAIN);
  } catch (e) {
    throw new AuthError(e?.message || 'jwt inválido');
  }

  const email = (payload.email || '').toString().toLowerCase();
  if (!email) throw new AuthError('email ausente no jwt');

  // Busca o registro do usuário. Email é UNIQUE COLLATE NOCASE.
  let user;
  try {
    user = await env.DB
      .prepare(
        `SELECT id, nome, sobrenome, email, role, ativo
           FROM users
          WHERE email = ?`
      )
      .bind(email)
      .first();
  } catch (e) {
    // Erro de DB não deve mascarar como "sem conta". Loga e falha como auth.
    console.error('requireAdminAuth: lookup falhou', e?.message || e);
    throw new AuthError('falha ao carregar conta');
  }

  if (!user) throw new NoAccountError('conta não cadastrada');
  if (user.ativo !== 1) throw new InactiveError('conta desativada');

  return { email, user, payload };
}
