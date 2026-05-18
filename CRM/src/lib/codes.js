// Geração do reservation_code.
// Estratégia: insert com código temporário único, RETURNING id, update com FDS-NNNNNN.

export function tempCode() {
  return `TEMP-${crypto.randomUUID()}`;
}

export function formatReservationCode(id) {
  return `FDS-${String(id).padStart(6, '0')}`;
}
