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

// Retorna { email } se autenticado, ou lança erro.
// Uso: try { const { email } = await requireAdminAuth(request, env); ... } catch { 401 }
export async function requireAdminAuth(request, env) {
  if (!env.ACCESS_TEAM_DOMAIN) {
    throw new Error('ACCESS_TEAM_DOMAIN não configurado');
  }
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) throw new Error('jwt ausente');

  const payload = await verifyJwt(token, env.ACCESS_TEAM_DOMAIN);
  const email = (payload.email || '').toString().toLowerCase();
  if (!email) throw new Error('email ausente no jwt');
  return { email, payload };
}
