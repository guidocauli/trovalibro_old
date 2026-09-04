const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { fuzzCoordinates } = require('../utils/geo');
const { deleteImageIfExists } = require('../middleware/upload');

const router = express.Router();
const SALT_ROUNDS = 11;

function publicUser(u, { includeContacts = false } = {}) {
    if (!u) return null;
    const base = {
        id: u.id,
        username: u.username,
        display_name: u.display_name,
        bio: u.bio,
        avatar_path: u.avatar_path,
        location_label: u.share_location ? u.location_label : null,
        created_at: u.created_at,
    };
    if (includeContacts) base.email = u.email;
    return base;
}

// GET /api/users/:id — profilo pubblico
router.get('/:id', (req, res) => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'Utente non trovato.' });
    const isSelf = req.session && req.session.userId === user.id;
    res.json({ user: publicUser(user, { includeContacts: isSelf }) });
});

// PUT /api/users/me — aggiorna il proprio profilo (inclusa gestione consenso posizione)
router.put('/me', requireAuth, (req, res) => {
    const { display_name, bio, latitude, longitude, location_label, location_precision, share_location } = req.body || {};

    const current = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);

    let lat = current.latitude, lon = current.longitude;
    const precision = location_precision || current.location_precision;
    const shareLoc = share_location !== undefined ? !!share_location : !!current.share_location;

    if (shareLoc && latitude != null && longitude != null) {
        const fuzzed = fuzzCoordinates(Number(latitude), Number(longitude), precision);
        lat = fuzzed.latitude;
        lon = fuzzed.longitude;
    } else if (!shareLoc) {
        lat = null; lon = null;
    }

    db.prepare(`
        UPDATE users SET display_name = ?, bio = ?, latitude = ?, longitude = ?,
               location_label = ?, location_precision = ?, share_location = ?, updated_at = datetime('now')
        WHERE id = ?
    `).run(
        display_name ?? current.display_name,
        bio ?? current.bio,
        lat, lon,
        location_label ?? current.location_label,
        precision,
        shareLoc ? 1 : 0,
        req.session.userId
    );

    if (share_location !== undefined && !!share_location !== !!current.share_location) {
        db.prepare(`INSERT INTO consent_log (user_id, consent_type, granted) VALUES (?, 'geolocalizzazione', ?)`)
          .run(req.session.userId, shareLoc ? 1 : 0);
    }

    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
    res.json({ user: publicUser(updated, { includeContacts: true }) });
});

// PUT /api/users/me/password — cambio password (richiede la password attuale)
router.put('/me/password', requireAuth, async (req, res) => {
    const { current_password, new_password } = req.body || {};

    if (!current_password || !new_password) {
        return res.status(400).json({ error: 'Inserisci la password attuale e la nuova password.' });
    }
    if (new_password.length < 8) {
        return res.status(400).json({ error: 'La nuova password deve avere almeno 8 caratteri.' });
    }
    if (new_password === current_password) {
        return res.status(400).json({ error: 'La nuova password deve essere diversa da quella attuale.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
    const isCurrentCorrect = await bcrypt.compare(current_password, user.password_hash);
    if (!isCurrentCorrect) {
        return res.status(401).json({ error: 'La password attuale inserita non è corretta.' });
    }

    const newHash = await bcrypt.hash(new_password, SALT_ROUNDS);
    db.prepare(`UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(newHash, req.session.userId);

    res.json({ ok: true });
});

// DELETE /api/users/me — elimina definitivamente il proprio account e tutti i dati collegati
// (libri pubblicati, immagini, richieste di prestito inviate, consensi). Richiede la password
// per confermare l'operazione, che è irreversibile.
router.delete('/me', requireAuth, async (req, res) => {
    const { password } = req.body || {};
    if (!password) {
        return res.status(400).json({ error: 'Inserisci la password per confermare l\'eliminazione dell\'account.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Password non corretta.' });

    if (user.role === 'admin') {
        const adminCount = db.prepare(`SELECT COUNT(*) AS n FROM users WHERE role = 'admin'`).get().n;
        if (adminCount <= 1) {
            return res.status(400).json({ error: 'Non puoi eliminare il tuo account: sei l\'unico amministratore rimasto.' });
        }
    }

    const images = db.prepare('SELECT cover_path, thumb_path FROM books WHERE owner_id = ?').all(user.id);

    db.prepare('DELETE FROM users WHERE id = ?').run(user.id); // CASCADE su books, loan_requests, consent_log

    images.forEach(img => {
        deleteImageIfExists(img.cover_path);
        deleteImageIfExists(img.thumb_path);
    });

    req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.json({ ok: true });
    });
});

// GET /api/users/nearby?lat=&lon=&radius_km= — utenti limitrofi che condividono la posizione
router.get('/search/nearby', requireAuth, (req, res) => {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    const radiusKm = Number(req.query.radius_km) || 5;

    if (Number.isNaN(lat) || Number.isNaN(lon)) {
        return res.status(400).json({ error: 'Parametri lat/lon mancanti o non validi.' });
    }

    const latDelta = radiusKm / 111.32;
    const lonDelta = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180) || 1);

    const rows = db.prepare(`
        SELECT id, username, display_name, bio, location_label, latitude, longitude,
               HAVERSINE_KM(?, ?, latitude, longitude) AS distance_km
        FROM users
        WHERE share_location = 1
          AND id != ?
          AND latitude BETWEEN ? AND ?
          AND longitude BETWEEN ? AND ?
          AND HAVERSINE_KM(?, ?, latitude, longitude) <= ?
        ORDER BY distance_km ASC
        LIMIT 50
    `).all(lat, lon, req.session.userId, lat - latDelta, lat + latDelta, lon - lonDelta, lon + lonDelta, lat, lon, radiusKm);

    // Non esponiamo mai lat/lon esatte degli altri utenti nella risposta:
    // solo la distanza calcolata e l'etichetta di posizione (già offuscata in scrittura).
    const result = rows.map(r => ({
        id: r.id, username: r.username, display_name: r.display_name,
        bio: r.bio, location_label: r.location_label, distance_km: Math.round(r.distance_km * 10) / 10,
    }));

    res.json({ users: result, radius_km: radiusKm });
});

module.exports = router;
