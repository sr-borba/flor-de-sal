// Geração do reservation_code.
// Estratégia: insert com código temporário único, RETURNING id, update com FRS-NNNNNNN.

export function tempCode() {
  return `TEMP-${crypto.randomUUID()}`;
}

export function formatReservationCode(id) {
  return `FRS-${String(id).padStart(7, '0')}`;
}
