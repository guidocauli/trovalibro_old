// TrovaLibro - Biblioteca Diffusa - Guido Cauli <guido.cauli@gmail.com>
//API libri (db) 
const express = require('express');
const crypto = require('crypto');
const db = require('../db/database');
const { requireAuth } = require('../auth');
const { upload, salvaCopertina, eliminaImmagine } = require('../upload'); 
const router = express.Router();


function categoriesForBook(bookId) {
    return db.prepare(`
        SELECT c.id, c.name, c.slug FROM categories c
        JOIN book_categories bc ON bc.category_id = c.id
        WHERE bc.book_id = ?
    `).all(bookId);
}



function aggiungiCategorie(bookId, categoryIds = []) {
    const del = db.prepare('DELETE FROM book_categories WHERE book_id = ?');
    del.run(bookId);
    const ins = db.prepare('INSERT OR IGNORE INTO book_categories (book_id, category_id) VALUES (?, ?)');
    for (const cid of categoryIds) ins.run(bookId, cid);
}


// GET /api/books/categories
router.get('/categories', (req, res) => {
    res.json({ categories: db.prepare('SELECT * FROM categories ORDER BY name').all() });
});

// POST /api/books     pubblica un nuovo libro (con copertina opzionale)


router.post('/', requireAuth, upload.single('cover'), async (req, res) => {
    try {
        const {
            title, author, year, publisher, isbn, description,
            condizione, lingua, disponibile_prestito, disponibile_consultazione,
            category_ids, 
         } = req.body || {};


        if (!title || !author) {
            return res.status(400).json({ error: 'Titolo e autore sono obbligatori.' });
        }

        const owner = db.prepare('SELECT latitude, longitude FROM users WHERE id = ?').get(req.session.userId);  

        let coverPath = null, thumbPath = null;  
        if (req.file) {
             const processed = await salvaCopertina(req.file.buffer);
             coverPath = processed.coverPath;
             thumbPath = processed.thumbPath;
        }

        const info = db.prepare(`
            INSERT INTO books (owner_id, title, author, year, publisher, isbn, description, 
                   condizione, lingua, disponibile_prestito, disponibile_consultazione, 
                   cover_path, thumb_path, latitude, longitude, status)  
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pubblicato')`).run(
            req.session.userId, title, author, year ? Number(year) : null, publisher || null, isbn || null,
            description || null, condizione || 'buono', lingua || 'it',
            disponibile_prestito === '0' || disponibile_prestito === false ? 0 : 1,
            disponibile_consultazione === '0' || disponibile_consultazione === false ? 0 : 1,
            coverPath, thumbPath, owner.latitude, owner.longitude
        );

        let catIds = [];
        if (category_ids) {
            try { catIds = JSON.parse(category_ids); } catch { catIds = String(category_ids).split(',').map(s => Number(s.trim())).filter(Boolean); }
            aggiungiCategorie(info.lastInsertRowid, catIds);
        }

        const book = db.prepare('SELECT * FROM books WHERE id = ?').get(info.lastInsertRowid);
        res.status(201).json({ book: { ...book, categories: categoriesForBook(book.id) } });
    } catch (err) {
        res.status(400).json({ error: err.message || 'Errore nella pubblicazione del libro.' });
    }
});

// PUT /api/books/:id      modifica (solo proprietario)
router.put('/:id', requireAuth, upload.single('cover'), async (req, res) => {
    const book = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
    if (!book) return res.status(404).json({ error: 'Libro non trovato.' });
    if (book.owner_id !== req.session.userId) return res.status(403).json({ error: 'Non sei il proprietario di questo libro.' });

    const b = req.body || {};
    let coverPath = book.cover_path, thumbPath = book.thumb_path;
    if (req.file) {
        const processed = await salvaCopertina(req.file.buffer);
        eliminaImmagine(book.cover_path);
        eliminaImmagine(book.thumb_path);
        coverPath = processed.coverPath;
        thumbPath = processed.thumbPath;
    }

    db.prepare(`
        UPDATE books SET title=?, author=?, year=?, publisher=?, isbn=?, description=?,
                condizione=?, lingua=?, disponibile_prestito=?, disponibile_consultazione=?,
                cover_path=?, thumb_path=?, status=?, updated_at=datetime('now')
        WHERE id = ?`).run(
        b.title ?? book.title, b.author ?? book.author, b.year ? Number(b.year) : book.year, 
        b.publisher ?? book.publisher, b.isbn ?? book.isbn, b.description ?? book.description,
        b.condizione ?? book.condizione, b.lingua ?? book.lingua,  
        b.disponibile_prestito !== undefined ? (b.disponibile_prestito ? 1 : 0) : book.disponibile_prestito,  
        b.disponibile_consultazione !== undefined ? (b.disponibile_consultazione ? 1 : 0) : book.disponibile_consultazione, 
        coverPath, thumbPath, b.status ?? book.status, req.params.id  
     );

     if (b.category_ids) {
         let catIds = [];
         try { catIds = JSON.parse(b.category_ids); } catch { catIds = String(b.category_ids).split(',').map(s => Number(s.trim())).filter(Boolean); }
         aggiungiCategorie(req.params.id, catIds);
     }

    const updated = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
    res.json({ book: { ...updated, categories: categoriesForBook(updated.id) } });
});

// DELETE /api/books/:id  
router.delete('/:id', requireAuth, (req, res) => { 
    const book = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
     if (!book) return res.status(404).json({ error: 'Libro non trovato.' });  
     if (book.owner_id !== req.session.userId) return res.status(403).json({ error: 'Non sei il proprietario di questo libro.' });
    eliminaImmagine(book.cover_path); 
    eliminaImmagine(book.thumb_path); 
    db.prepare('DELETE FROM books WHERE id = ?').run(req.params.id);
    res.json({ ok: true });  

});

// GET /api/books/search      ricerca testuale e spaziale combinata
//     Parametri Query : q, category_id, lat, lon, radius_km, condizione, sort
router.get('/search', (req, res) => {
    const { q, category_id, lat, lon, radius_km, condizione, sort } = req.query;
    const hasGeo = lat != null && lon != null && lat !== '' && lon !== '';
    const rKm = Number(radius_km) || 10; 
    let sql = `
        SELECT DISTINCT b.*, u.display_name AS owner_name, u.username AS owner_username,
               u.location_label AS owner_location_label 
               ${hasGeo ? ', HAVERSINE_KM(?, ?, b.latitude, b.longitude) AS distance_km' : ''} 
        FROM books b 
        JOIN users u ON u.id = b.owner_id
        LEFT JOIN book_categories bc ON bc.book_id = b.id
        WHERE b.status = 'pubblicato'`;
    const params = [];
     if (hasGeo) params.push(Number(lat), Number(lon)); 

     if (q) {
        sql += ` AND (b.title LIKE ? OR b.author LIKE ? OR b.description LIKE ?)`; 
        const like = `%${q}%`;
        params.push(like, like, like);
    }
    if (category_id) {
        sql += ` AND bc.category_id = ?`; 
        params.push(Number(category_id)); 
    }
    if (condizione) {
        sql += ` AND b.condizione = ?`;
        params.push(condizione); 
    }
    if (hasGeo) {
       const latN = Number(lat), lonN = Number(lon);
       const latDelta = rKm / 111.32; 
       const lonDelta = rKm / (111.32 * Math.cos((latN * Math.PI) / 180) || 1);
//   Pre-filtro veloce, sfrutta gli indici su lat/lon.  
        sql += ` AND b.latitude BETWEEN ? AND ? AND b.longitude BETWEEN ? AND ?`;
        params.push(latN - latDelta, latN + latDelta, lonN - lonDelta, lonN + lonDelta);

//   Filtro sulla distanza effettiva (Haversine). SQLite non permette  
// HAVING senza il GROUP BY su una query non aggregata, quindi la funzione 
// va ripetuta in WHERE anziché referenziare l'alias distance_km. 

        sql += ` AND HAVERSINE_KM(?, ?, b.latitude, b.longitude) <= ?`;
        params.push(latN, lonN, rKm);
    }

     sql += hasGeo && sort !== 'recenti'
        ? ` ORDER BY distance_km ASC`
        : ` ORDER BY b.created_at DESC`;
     sql += ` LIMIT 100`;

     const rows = db.prepare(sql).all(...params);
     const books = rows.map(r => ({ 
        ...r,
        distance_km: r.distance_km != null ? Math.round(r.distance_km * 10) / 10 : null,
        categories: categoriesForBook(r.id), 
      }));

    res.json({ books, count: books.length });
});



// GET /api/books/mine     libri utente autenticato  
router.get('/mine', requireAuth, (req, res) => {
    const rows = db.prepare('SELECT * FROM books WHERE owner_id = ? ORDER BY created_at DESC').all(req.session.userId);
    res.json({ books: rows.map(r => ({ ...r, categories: categoriesForBook(r.id) })) });
});

// GET /api/books/:id     dettaglio e registrazione della visualizzazione
router.get('/:id', (req, res) => { 
    const book = db.prepare(`
         SELECT b.*, u.display_name AS owner_name, u.username AS owner_username,
                 u.location_label AS owner_location_label
         FROM books b JOIN users u ON u.id = b.owner_id WHERE b.id = ?`).get(req.params.id);
     if (!book) return res.status(404).json({ error: 'Libro non trovato.' });

  // Traccia la visualizzazione (utente loggato oppure sessione anonima tramite cookie) 
     if (!req.session.anonId) req.session.anonId = crypto.randomBytes(6).toString('hex');  
       db.prepare('INSERT INTO book_views (book_id, viewer_id, session_id)  VALUES (?, ?, ?)').run(book.id, req.session.userId || null, req.session.anonId);  

    const suggestions = db.prepare(`
       SELECT s.*, u.display_name AS author_name FROM suggestions s
       LEFT JOIN users u ON u.id = s.author_id  
       WHERE s.book_id = ? ORDER BY s.created_at DESC
    `).all(book.id);

    res.json({ book: { ...book, categories: categoriesForBook(book.id) }, suggestions });
});

// POST /api/books/:id/loan-request       richiesta di loan=prestito\consultazione   
router.post('/:id/loan-request', requireAuth, (req, res) => { 
    const book = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
     if (!book) return res.status(404).json({ error: 'Libro non trovato.' });
     if (book.owner_id === req.session.userId) { 
        return res.status(400).json({ error: 'Non puoi richiedere in prestito un tuo libro.' }); 
     }
    const { tipo, messaggio } = req.body || {};
    const info = db.prepare(`   
        INSERT INTO loan_requests (book_id, requester_id, tipo, messaggio) VALUES (?, ?, ?, ?) 
    `).run(book.id, req.session.userId, tipo === 'consultazione' ? 'consultazione' : 'prestito', messaggio || null);
    res.status(201).json({ request: db.prepare('SELECT * FROM loan_requests WHERE id = ?').get(info.lastInsertRowid) });  
});

// GET /api/books/:id/loan-requests      richieste ricevute dal proprietario 
router.get('/:id/loan-requests', requireAuth, (req, res) => {  
    const book = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
      if (!book) return res.status(404).json({ error: 'Libro non trovato.' });
      if (book.owner_id !== req.session.userId) return res.status(403).json({ error: 'Non autorizzato.' });
    const rows = db.prepare(`  
        SELECT lr.*, u.display_name AS requester_name, u.username AS requester_username 
        FROM loan_requests lr JOIN users u ON u.id = lr.requester_id 
        WHERE lr.book_id = ? ORDER BY lr.created_at DESC 
    `).all(book.id);
    res.json({ requests: rows });
});

// PUT /api/loan-requests/:id       cambia lo stato  (accetta/rifiuta/completa) — (router separato) 
router.put('/loan-requests/:id/status', requireAuth, (req, res) => {
    const request = db.prepare('SELECT * FROM loan_requests WHERE id = ?').get(req.params.id);
     if (!request) return res.status(404).json({ error: 'Richiesta non trovata.' });  
    const book = db.prepare('SELECT * FROM books WHERE id = ?').get(request.book_id);
     if (book.owner_id !== req.session.userId) return res.status(403).json({ error: 'Non autorizzato.' }); 

    const { stato } = req.body || {}; 
    const valid = ['in_attesa', 'accettata', 'rifiutata', 'completata', 'annullata'];
     if (!valid.includes(stato)) return res.status(400).json({ error: 'Stato non valido.' });

    db.prepare(`UPDATE loan_requests SET stato = ?, updated_at = datetime('now') WHERE id = ?`).run(stato, req.params.id);  
    res.json({ request: db.prepare('SELECT * FROM loan_requests WHERE id = ?').get(req.params.id) });
});

// POST /api/books/:id/suggestions    lascia suggerimenti e commenti sul libro   
router.post('/:id/suggestions', requireAuth, (req, res) => {
    const { testo } = req.body || {}; 
     if (!testo || !testo.trim()) return res.status(400).json({ error: 'Il testo del suggerimento è obbligatorio.' });
    const info = db.prepare('INSERT INTO suggestions (book_id, author_id, testo) VALUES (?, ?, ?)')
        .run(req.params.id, req.session.userId, testo.trim());  
    res.status(201).json({ suggestion: db.prepare('SELECT * FROM suggestions WHERE id = ?').get(info.lastInsertRowid) }); 
});

module.exports = router;


