// Middleware di autenticazione/autorizzazione basati su express-session.
// Il prototipo usa sessioni server-side (cookie httpOnly) invece di JWT
// per semplicità e perché non è richiesto un client mobile separato.

function requireAuth(req, res, next) {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ error: 'Accesso richiesto. Effettua il login.' });
    }
    next();
}

function requireAdmin(req, res, next) {
    if (!req.session || req.session.role !== 'admin') {
        return res.status(403).json({ error: 'Operazione riservata agli amministratori.' });
    }
    next();
}

// Non blocca la richiesta: si limita ad esporre req.session per uso
// facoltativo (es. tracciare le visualizzazioni con viewer_id se loggato).
function attachSession(req, res, next) {
    res.locals.isAuthenticated = !!(req.session && req.session.userId);
    next();
}

module.exports = { requireAuth, requireAdmin, attachSession };
