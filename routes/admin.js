const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { deleteImageIfExists } = require('../middleware/upload');

const router = express.Router();
const SALT_ROUNDS = 11;

// Tutte le route di questo file sono riservate agli amministratori.
router.use(requireAuth, requireAdmin);

// GET /api/admin/users — elenco utenti con conteggio libri pubblicati
router.get('/users', (req, res) => {
    const rows = db.prepare(`
        SELECT u.id, u.username, u.email, u.display_name, u.role, u.share_location, u.created_at,
               COUNT(b.id) AS book_count
        FROM users u
        LEFT JOIN books b ON b.owner_id = u.id
        GROUP BY u.id
        ORDER BY u.created_at DESC
    `).all();
    res.json({ users: rows });
});

// PUT /api/admin/users/:id/reset-password — l'amministratore imposta una nuova password
router.put('/users/:id/reset-password', async (req, res) => {
    const targetId = Number(req.params.id);
    const { new_password } = req.body || {};

    if (targetId === req.session.userId) {
        return res.status(400).json({ error: 'Per cambiare la tua password usa la sezione "Cambia password" nel tuo profilo.' });
    }
    if (!new_password || new_password.length < 8) {
        return res.status(400).json({ error: 'La nuova password deve avere almeno 8 caratteri.' });
    }

    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(targetId);
    if (!user) return res.status(404).json({ error: 'Utente non trovato.' });

    const newHash = await bcrypt.hash(new_password, SALT_ROUNDS);
    db.prepare(`UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`).run(newHash, targetId);

    res.json({ ok: true });
});

// DELETE /api/admin/users/:id — elimina un utente e tutti i suoi dati (libri, immagini, richieste, ecc.)
router.delete('/users/:id', (req, res) => {
    const targetId = Number(req.params.id);

    if (targetId === req.session.userId) {
        return res.status(400).json({ error: 'Non puoi eliminare il tuo stesso account da qui: usa "Elimina account" nel tuo profilo.' });
    }

    const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(targetId);
    if (!user) return res.status(404).json({ error: 'Utente non trovato.' });

    if (user.role === 'admin') {
        const adminCount = db.prepare(`SELECT COUNT(*) AS n FROM users WHERE role = 'admin'`).get().n;
        if (adminCount <= 1) {
            return res.status(400).json({ error: 'Non puoi eliminare l\'ultimo amministratore rimasto.' });
        }
    }

    // Recupera i percorsi delle immagini dei libri dell'utente prima della cancellazione
    // in cascata (ON DELETE CASCADE rimuove le righe dal DB, non i file su disco).
    const images = db.prepare('SELECT cover_path, thumb_path FROM books WHERE owner_id = ?').all(targetId);

    db.prepare('DELETE FROM users WHERE id = ?').run(targetId); // CASCADE su books, loan_requests, consent_log

    images.forEach(img => {
        deleteImageIfExists(img.cover_path);
        deleteImageIfExists(img.thumb_path);
    });

    res.json({ ok: true });
});

module.exports = router;
