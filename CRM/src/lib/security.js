// Funções de segurança: hash de IP com salt, sanitização de strings.
// IMPORTANTE: nunca armazenar IP em texto puro. Sem IP_HASH_SALT configurado,
// armazenamos null (preferível a hash sem salt — IPv4 é reversível por brute-force).

const encoder = new TextEncoder();

export async function hashIp(ip, salt) {
  if (!ip || !salt) return null;
  const data = encoder.encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Remove caracteres de controle (exceto \n, \r, \t) e normaliza unicode.
// Aplica limite de tamanho para evitar payloads abusivos. Retorna null se
// resultar em string vazia.
export function cleanString(value, { maxLen = 500 } = {}) {
  if (value == null) return null;
  let s = String(value);
  s = s.normalize('NFC');
  // Strip ASCII control chars except \t (0x09), \n (0x0A), \r (0x0D)
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  s = s.trim();
  if (s.length === 0) return null;
  if (s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

export function getClientIp(request) {
  return request.headers.get('CF-Connecting-IP') || null;
}

// Aceita apenas Content-Type JSON. Defesa contra confusões de parser.
export function isJsonRequest(request) {
  const ct = request.headers.get('Content-Type') || '';
  return ct.toLowerCase().startsWith('application/json');
}
