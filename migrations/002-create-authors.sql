-- 002-create-authors.sql
-- Tabla de autores para E-E-A-T (Person | Organization)

CREATE TABLE IF NOT EXISTS authors (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    slug        TEXT UNIQUE NOT NULL,
    name        TEXT NOT NULL,
    type        TEXT NOT NULL DEFAULT 'Person',  -- 'Person' | 'Organization'
    job_title   TEXT,
    bio         TEXT,
    avatar      TEXT,
    url         TEXT,
    same_as     TEXT DEFAULT '[]',               -- JSON array: ["https://linkedin.com/in/x"]
    email       TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed: autor organizacional por defecto (id=1)
INSERT OR IGNORE INTO authors (id, slug, name, type, avatar, url, same_as) VALUES
(1, 'jhedai-org', 'JhedAi', 'Organization',
 'https://jhedai.com/isotipo-jhedai.png', 'https://jhedai.com',
 '["https://www.linkedin.com/company/jhedai/","https://www.instagram.com/jhedai/","https://www.youtube.com/@jhedai"]');
