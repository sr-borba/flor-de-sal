-- Flor de Sal CRM — usuários internos e papéis (Fase 3)
-- Auth continua sendo via Cloudflare Access. Esta tabela controla AUTORIZAÇÃO
-- (o que cada e-mail pode fazer), não autenticação.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  nome           TEXT NOT NULL,
  sobrenome      TEXT,
  email          TEXT UNIQUE NOT NULL COLLATE NOCASE,
  role           TEXT NOT NULL DEFAULT 'concierge'
    CHECK (role IN ('admin', 'gerente', 'concierge', 'marketing')),
  ativo          INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
  criado_em      DATETIME DEFAULT CURRENT_TIMESTAMP,
  atualizado_em  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_ativo ON users(ativo);

CREATE TRIGGER IF NOT EXISTS trg_users_touch
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
  UPDATE users SET atualizado_em = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

-- Seed: primeiro admin (operador atual).
-- Necessário pra desbloquear o painel após a migration. Sem isso, o primeiro
-- login receberia 403 ("conta não cadastrada") e ninguém conseguiria criar
-- outros usuários. Esse e-mail também precisa estar na policy do CF Access.
INSERT OR IGNORE INTO users (nome, sobrenome, email, role, ativo)
VALUES ('Marketing', 'Tropicalis', 'marketing@tropicalishotel.com.br', 'admin', 1);
