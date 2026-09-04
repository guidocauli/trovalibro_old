const path = require('path');
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const bookRoutes = require('./routes/books');
const statsRoutes = require('./routes/stats');
const adminRoutes = require('./routes/admin');
const { attachSession } = require('./middleware/auth');

require('./db/database'); // apre/inizializza il DB al boot

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(session({
    store: new SQLiteStore({ db: 'sessions.db', dir: path.join(__dirname, 'db') }),
    secret: process.env.SESSION_SECRET || 'biblioteca-diffusa-dev-secret-cambiare-in-produzione',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 giorni
        sameSite: 'lax',
    },
}));

app.use(attachSession);

// File statici: frontend + immagini caricate
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/admin', adminRoutes);

// Gestione errori centralizzata (es. errori multer/sharp non catturati a monte)
app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Errore interno del server.' });
});

app.listen(PORT, () => {
    console.log(`Biblioteca Diffusa in ascolto su http://localhost:${PORT}`);
});
