// TrovaLibro - Biblioteca Diffusa - Guido Cauli <guido.cauli@gmail.com>
// funzioni server-side 


const path = require('path');
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const bookRoutes = require('./routes/books');
const statsRoutes = require('./routes/stats');
const adminRoutes = require('./routes/admin');
const { attachSession } = require('./auth');

require('./db/database');           //  apre o inizializza il DB all'avvio  



const app = express();
const PORT = process.env.PORT || 3000;



app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));  

app.use(session({
    store: new SQLiteStore({ db: 'sessions.db', dir: path.join(__dirname, 'db') }),
    secret: process.env.SESSION_SECRET || 'biblioteca-diffusa-dev-secret-cambiare-in-produzione',
    resave: false, 
    saveUninitialized: false,
    cookie: {               //il cookie httpOnly (non leggibile da Javascript)
             httpOnly: true,
             maxAge: 1000 * 60 * 60 * 24 * 7, // 7 giorni validita'
             sameSite: 'lax', //CORS
   },
}));

app.use(attachSession);



// caricameto frontend e immagini  
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));



// elenco delle API
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/admin', adminRoutes);




// Gestione di errori centralizzata (es. errori multer/sharp senza un catch gia' a monte)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Errore interno del server.' });
});

// listener sulla 8000 (default che si puo' personalizzare)
app.listen(PORT, () => {
   console.log('TrovaLibro - Biblioteca Diffusa - Project Work - Guido Cauli <guido.cauli@gmail.com>');
   console.log(`Server in ascolto su:  http://localhost:${PORT}`); 
});
