const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { fuzzCoordinates } = require('../utils/geo');

const router = express.Router();

const SALT_ROUNDS = 11;

function publicUser(u) {
    if (!u) return null;
    const { password_hash, ...rest } = u;
    return rest;
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
    const {
        username, email, password, display_name,
        latitude, longitude, location_label, location_precision, share_location,
    } = req.body || {};

    if (!username || !email || !password || !display_name) {
        return res.status(400).json({ error: 'Nome utente, email, password e nome visualizzato sono obbligatori.' });
    }
    if (password.length < 8) {
        return res.status(400).json({ error: 'La password deve avere almeno 8 caratteri.' });
    }
    if (share_location && (latitude == null || longitude == null)) {
        return res.status(400).json({ error: 'Coordinate mancanti per abilitare la geolocalizzazione.' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
    if (existing) {
        return res.status(409).json({ error: 'Nome utente o email già registrati.' });
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    // Consenso esplicito richiesto prima di memorizzare qualunque coordinata.
    // Se l'utente sceglie precisione 'quartiere' o 'citta', la posizione
    // viene offuscata (jitter) PRIMA di essere salvata: il server non
    // conserva mai la posizione esatta in quel caso.
    let lat = null, lon = null;
    const precision = location_precision || 'quartiere';
    if (share_location) {
        const fuzzed = fuzzCoordinates(Number(latitude), Number(longitude), precision);
        lat = fuzzed.latitude;
        lon = fuzzed.longitude;
    }

    const info = db.prepare(`
        INSERT INTO users (username, email, password_hash, display_name, latitude, longitude,
                            location_label, location_precision, share_location)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(username, email, password_hash, display_name, lat, lon,
           location_label || null, precision, share_location ? 1 : 0);

    db.prepare(`INSERT INTO consent_log (user_id, consent_type, granted) VALUES (?, 'geolocalizzazione', ?)`)
      .run(info.lastInsertRowid, share_location ? 1 : 0);
    db.prepare(`INSERT INTO consent_log (user_id, consent_type, granted) VALUES (?, 'termini_servizio', 1)`)
      .run(info.lastInsertRowid);

    req.session.userId = info.lastInsertRowid;
    req.session.role = 'utente';

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ user: publicUser(user) });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    const { identifier, password } = req.body || {};
    if (!identifier || !password) {
        return res.status(400).json({ error: 'Inserisci nome utente/email e password.' });
    }
    const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(identifier, identifier);
    if (!user) return res.status(401).json({ error: 'Credenziali non valide.' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Credenziali non valide.' });

    req.session.userId = user.id;
    req.session.role = user.role;
    res.json({ user: publicUser(user) });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.json({ ok: true });
    });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
    if (!req.session || !req.session.userId) return res.json({ user: null });
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
    res.json({ user: publicUser(user) });
});

module.exports = router;
