-- Flor de Sal CRM — schema inicial
-- Rodar com: wrangler d1 migrations apply flor-de-sal-reservas --remote
-- Local (dev): wrangler d1 migrations apply flor-de-sal-reservas --local

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS reservations (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  reservation_code     TEXT UNIQUE NOT NULL,
  nome                 TEXT NOT NULL,
  sobrenome            TEXT,
  email                TEXT,
  telefone             TEXT NOT NULL,
  data_reserva         DATE NOT NULL,
  horario              TEXT NOT NULL,
  adultos              INTEGER NOT NULL DEFAULT 1,
  criancas             INTEGER NOT NULL DEFAULT 0,
  total_pessoas        INTEGER NOT NULL DEFAULT 1,
  observacoes          TEXT,
  observacoes_internas TEXT,
  origem               TEXT NOT NULL DEFAULT 'lp',
  status               TEXT NOT NULL DEFAULT 'solicitada'
    CHECK (status IN (
      'solicitada','aguardando_resposta','confirmada',
      'remarcada','cancelada','compareceu','no_show'
    )),
  utm_source           TEXT,
  utm_medium           TEXT,
  utm_campaign         TEXT,
  utm_content          TEXT,
  utm_term             TEXT,
  referrer             TEXT,
  landing_page         TEXT,
  user_agent           TEXT,
  ip_hash              TEXT,
  criado_por           TEXT,
  criado_em            DATETIME DEFAULT CURRENT_TIMESTAMP,
  atualizado_em        DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reservations_data       ON reservations(data_reserva);
CREATE INDEX IF NOT EXISTS idx_reservations_status     ON reservations(status);
CREATE INDEX IF NOT EXISTS idx_reservations_criado_em  ON reservations(criado_em);
CREATE INDEX IF NOT EXISTS idx_reservations_ip_hash    ON reservations(ip_hash);

-- Mantém atualizado_em em sincronia
CREATE TRIGGER IF NOT EXISTS trg_reservations_touch
AFTER UPDATE ON reservations
FOR EACH ROW
BEGIN
  UPDATE reservations SET atualizado_em = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

CREATE TABLE IF NOT EXISTS reservation_status_history (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  reservation_id  INTEGER NOT NULL,
  status_anterior TEXT,
  status_novo     TEXT NOT NULL,
  usuario_email   TEXT,
  motivo          TEXT,
  alterado_em     DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_status_history_reservation ON reservation_status_history(reservation_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  entidade      TEXT NOT NULL,
  entidade_id   INTEGER,
  acao          TEXT NOT NULL,
  usuario_email TEXT,
  detalhes      TEXT,
  criado_em     DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_entidade   ON audit_logs(entidade, entidade_id);
CREATE INDEX IF NOT EXISTS idx_audit_criado_em  ON audit_logs(criado_em);
