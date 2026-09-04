-- =====================================================================
-- Biblioteca Diffusa — Schema del database (SQLite)
-- Piattaforma di geolocalizzazione culturale per patrimoni librari privati
-- =====================================================================
-- Nota tecnica: SQLite non ha un tipo geometrico nativo. Le coordinate
-- sono memorizzate come REAL (lat/lon, WGS84) e le query spaziali
-- (ricerca per raggio) sono realizzate con la formula di Haversine
-- direttamente in SQL, con un pre-filtro tramite bounding box che
-- sfrutta gli indici su latitude/longitude. Per un deployment di
-- produzione lo stesso schema è portabile su PostgreSQL/PostGIS
-- sostituendo lat/lon con una colonna GEOGRAPHY(Point,4326) e le
-- query Haversine con ST_DWithin (vedi relazione tecnica, sez. 4).

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------
-- UTENTI
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    username            TEXT NOT NULL UNIQUE,
    email               TEXT NOT NULL UNIQUE,
    password_hash       TEXT NOT NULL,
    display_name        TEXT NOT NULL,
    bio                 TEXT,
    avatar_path         TEXT,
    -- Geolocalizzazione: coordinate volontariamente approssimate
    -- (vedi consenso privacy) per non esporre l'indirizzo esatto.
    latitude            REAL,
    longitude           REAL,
    location_label      TEXT,              -- es. "Bari, Quartiere Libertà"
    location_precision  TEXT DEFAULT 'quartiere'  -- 'esatta' | 'quartiere' | 'citta'
                        CHECK (location_precision IN ('esatta','quartiere','citta')),
    share_location      INTEGER NOT NULL DEFAULT 0,  -- consenso esplicito (0/1)
    role                TEXT NOT NULL DEFAULT 'utente' CHECK (role IN ('utente','admin')),
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_lat ON users(latitude);
CREATE INDEX IF NOT EXISTS idx_users_lon ON users(longitude);

-- ---------------------------------------------------------------------
-- CATEGORIE (tassonomia dei volumi)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    name    TEXT NOT NULL UNIQUE,
    slug    TEXT NOT NULL UNIQUE
);

-- ---------------------------------------------------------------------
-- LIBRI
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS books (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    author          TEXT NOT NULL,
    year            INTEGER,
    publisher       TEXT,
    isbn            TEXT,
    description     TEXT,
    condizione      TEXT DEFAULT 'buono' CHECK (condizione IN ('nuovo','ottimo','buono','discreto','rovinato')),
    lingua          TEXT DEFAULT 'it',
    disponibile_prestito INTEGER NOT NULL DEFAULT 1,   -- 0/1
    disponibile_consultazione INTEGER NOT NULL DEFAULT 1,
    cover_path      TEXT,               -- immagine originale (ridimensionata)
    thumb_path      TEXT,               -- miniatura generata
    -- coordinate ereditate dal proprietario al momento della pubblicazione
    -- (denormalizzate per velocizzare le query spaziali sui libri)
    latitude        REAL,
    longitude       REAL,
    status          TEXT NOT NULL DEFAULT 'pubblicato' CHECK (status IN ('bozza','pubblicato','rimosso')),
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_books_owner ON books(owner_id);
CREATE INDEX IF NOT EXISTS idx_books_lat ON books(latitude);
CREATE INDEX IF NOT EXISTS idx_books_lon ON books(longitude);
CREATE INDEX IF NOT EXISTS idx_books_title ON books(title);
CREATE INDEX IF NOT EXISTS idx_books_author ON books(author);
CREATE INDEX IF NOT EXISTS idx_books_status ON books(status);

-- Tabella ponte libri <-> categorie (many-to-many)
CREATE TABLE IF NOT EXISTS book_categories (
    book_id     INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    PRIMARY KEY (book_id, category_id)
);

-- ---------------------------------------------------------------------
-- RICHIESTE DI PRESTITO / CONSULTAZIONE (simulate: nessuna logistica reale)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS loan_requests (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id         INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    requester_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tipo            TEXT NOT NULL DEFAULT 'prestito' CHECK (tipo IN ('prestito','consultazione')),
    messaggio       TEXT,
    stato           TEXT NOT NULL DEFAULT 'in_attesa' CHECK (stato IN ('in_attesa','accettata','rifiutata','completata','annullata')),
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_loan_book ON loan_requests(book_id);
CREATE INDEX IF NOT EXISTS idx_loan_requester ON loan_requests(requester_id);

-- ---------------------------------------------------------------------
-- STATISTICHE D'USO
-- ---------------------------------------------------------------------
-- Una riga per evento: visualizzazione scheda libro. Aggregata a runtime
-- per le dashboard (vedi routes/stats.js). session_id anonimizza le
-- visualizzazioni di utenti non autenticati.
CREATE TABLE IF NOT EXISTS book_views (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id     INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    viewer_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
    session_id  TEXT,
    viewed_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_views_book ON book_views(book_id);
CREATE INDEX IF NOT EXISTS idx_views_date ON book_views(viewed_at);

-- Suggerimenti liberi lasciati dagli utenti su un libro (usati anche
-- come metrica "engagement" nella dashboard statistiche)
CREATE TABLE IF NOT EXISTS suggestions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id     INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    author_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
    testo       TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_suggestions_book ON suggestions(book_id);

-- ---------------------------------------------------------------------
-- LOG CONSENSI PRIVACY (traccia GDPR-friendly di cosa l'utente ha accettato)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS consent_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    consent_type TEXT NOT NULL,   -- 'geolocalizzazione' | 'termini_servizio' | ...
    granted     INTEGER NOT NULL, -- 0/1
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
