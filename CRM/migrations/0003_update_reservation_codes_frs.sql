-- Flor de Sal CRM — padroniza códigos de reserva
-- Modelo novo: FRS-0000001 (prefixo FRS + 7 dígitos)

UPDATE reservations
   SET reservation_code = 'FRS-' || substr('0000000' || id, -7, 7)
 WHERE reservation_code LIKE 'FDS-%';
