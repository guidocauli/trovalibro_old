// Popola il database con utenti, categorie e libri di esempio, distribuiti
// geograficamente nell'area di Bari, per poter testare da subito la ricerca
// spaziale e la dashboard statistiche.
const bcrypt = require('bcryptjs');
const db = require('./database');

const CATEGORIES = [
    ['Narrativa', 'narrativa'], ['Saggistica', 'saggistica'], ['Poesia', 'poesia'],
    ['Storia', 'storia'], ['Scienza', 'scienza'], ['Fumetti e graphic novel', 'fumetti'],
    ['Libri per ragazzi', 'ragazzi'], ['Fantascienza', 'fantascienza'], ['Gialli e thriller', 'gialli'],
    ['Arte e fotografia', 'arte'], ['Manuali tecnici', 'manuali'], ['Filosofia', 'filosofia'],
];

const USERS = [
    { username: 'admin', email: 'admin@bibliotecadiffusa.it', display_name: 'Amministrazione', role: 'admin',
      lat: 41.1171, lon: 16.8719, label: 'Bari centro', share: 1 },
    { username: 'giulia_r', email: 'giulia.r@example.it', display_name: 'Giulia R.', role: 'utente',
      lat: 41.1256, lon: 16.8623, label: 'Bari, Murat', share: 1,
      bio: 'Appassionata di narrativa contemporanea e poesia del Novecento.' },
    { username: 'marco_libri', email: 'marco.libri@example.it', display_name: 'Marco T.', role: 'utente',
      lat: 41.1088, lon: 16.8811, label: 'Bari, Libertà', share: 1,
      bio: 'Colleziono manuali tecnici e saggistica scientifica.' },
    { username: 'elena_p', email: 'elena.p@example.it', display_name: 'Elena P.', role: 'utente',
      lat: 41.0964, lon: 16.8698, label: 'Bari, Carrassi', share: 1,
      bio: 'Piccola biblioteca di famiglia: gialli, storia locale e fumetti.' },
    { username: 'nicola_fq', email: 'nicola.fq@example.it', display_name: 'Nicola F.', role: 'utente',
      lat: 41.1403, lon: 16.8556, label: 'Bitonto (BA)', share: 1,
      bio: 'Fantascienza e filosofia, con qualche prima edizione.' },
    { username: 'anna_riservata', email: 'anna.riservata@example.it', display_name: 'Anna S.', role: 'utente',
      lat: null, lon: null, label: null, share: 0,
      bio: 'Preferisce non condividere la posizione.' },
];

const BOOKS = [
    { owner: 'giulia_r', title: 'Se questo è un uomo', author: 'Primo Levi', year: 1947, publisher: 'Einaudi',
      cats: ['narrativa', 'storia'], condizione: 'buono',
      description: 'Edizione economica, sottolineature leggere a matita.' },
    { owner: 'giulia_r', title: 'Ossi di seppia', author: 'Eugenio Montale', year: 1925, publisher: 'Mondadori',
      cats: ['poesia'], condizione: 'ottimo', description: 'Copia da collezione, ottime condizioni.' },
    { owner: 'marco_libri', title: 'Breve storia del tempo', author: 'Stephen Hawking', year: 1988, publisher: 'Rizzoli',
      cats: ['scienza', 'saggistica'], condizione: 'buono', description: 'Prestata già due volte, sempre restituita in buono stato.' },
    { owner: 'marco_libri', title: 'Il manuale dell\'elettricista', author: 'AA.VV.', year: 2005, publisher: 'Hoepli',
      cats: ['manuali'], condizione: 'discreto', description: 'Alcune pagine ingiallite ma completo.' },
    { owner: 'elena_p', title: 'La forma dell\'acqua', author: 'Andrea Camilleri', year: 1994, publisher: 'Sellerio',
      cats: ['gialli'], condizione: 'ottimo', description: 'Prima edizione economica.' },
    { owner: 'elena_p', title: 'Storia di Bari', author: 'Vito A. Melchiorre', year: 2001, publisher: 'Adda',
      cats: ['storia'], condizione: 'buono', description: 'Volume illustrato sulla storia cittadina.' },
    { owner: 'elena_p', title: 'Corto Maltese - Una ballata del mare salato', author: 'Hugo Pratt', year: 1967,
      publisher: 'Rizzoli Lizard', cats: ['fumetti'], condizione: 'ottimo', description: 'Ristampa cartonata.' },
    { owner: 'nicola_fq', title: 'Dune', author: 'Frank Herbert', year: 1965, publisher: 'Fanucci',
      cats: ['fantascienza'], condizione: 'buono', description: 'Edizione con copertina rigida, ottimo stato del dorso.' },
    { owner: 'nicola_fq', title: 'Così parlò Zarathustra', author: 'Friedrich Nietzsche', year: 1883, publisher: 'Adelphi',
      cats: ['filosofia'], condizione: 'nuovo', description: 'Mai letto, acquistato in doppia copia per errore.' },
    { owner: 'nicola_fq', title: 'Fondazione', author: 'Isaac Asimov', year: 1951, publisher: 'Mondadori',
      cats: ['fantascienza'], condizione: 'buono', description: null },
];

function run() {
    const insUser = db.prepare(`
        INSERT INTO users (username, email, password_hash, display_name, bio, latitude, longitude,
                            location_label, location_precision, share_location, role)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'quartiere', ?, ?)
    `);
    const insCat = db.prepare('INSERT OR IGNORE INTO categories (name, slug) VALUES (?, ?)');
    const insBook = db.prepare(`
        INSERT INTO books (owner_id, title, author, year, publisher, description, condizione, latitude, longitude, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pubblicato')
    `);
    const linkCat = db.prepare('INSERT OR IGNORE INTO book_categories (book_id, category_id) VALUES (?, ?)');
    const insView = db.prepare(`INSERT INTO book_views (book_id, viewer_id, session_id, viewed_at) VALUES (?, ?, ?, datetime('now', ?))`);
    const insLoan = db.prepare(`INSERT INTO loan_requests (book_id, requester_id, tipo, messaggio, stato) VALUES (?, ?, ?, ?, ?)`);

    const txn = db.transaction(() => {
        // Password comune per tutti gli utenti demo (solo per sviluppo/test!)
        const demoPasswordHash = bcrypt.hashSync('Prova1234!', 10);

        const userIds = {};
        for (const u of USERS) {
            const info = insUser.run(
                u.username, u.email, demoPasswordHash, u.display_name, u.bio || null,
                u.lat, u.lon, u.label, u.share, u.role
            );
            userIds[u.username] = info.lastInsertRowid;
        }

        const catIds = {};
        for (const [name, slug] of CATEGORIES) {
            insCat.run(name, slug);
            catIds[slug] = db.prepare('SELECT id FROM categories WHERE slug = ?').get(slug).id;
        }

        const bookIds = [];
        for (const b of BOOKS) {
            const owner = db.prepare('SELECT latitude, longitude FROM users WHERE id = ?').get(userIds[b.owner]);
            const info = insBook.run(
                userIds[b.owner], b.title, b.author, b.year, b.publisher, b.description,
                b.condizione, owner.latitude, owner.longitude
            );
            bookIds.push(info.lastInsertRowid);
            for (const slug of b.cats) linkCat.run(info.lastInsertRowid, catIds[slug]);
        }

        // Visualizzazioni ed engagement fittizi, distribuiti negli ultimi 14 giorni,
        // utili a popolare subito grafici e dashboard statistiche.
        for (const bookId of bookIds) {
            const n = 3 + Math.floor(Math.random() * 20);
            for (let i = 0; i < n; i++) {
                const daysAgo = `-${Math.floor(Math.random() * 14)} days`;
                insView.run(bookId, null, `demo-session-${Math.floor(Math.random() * 8)}`, daysAgo);
            }
        }
        insLoan.run(bookIds[0], userIds['nicola_fq'], 'prestito', 'Ciao Giulia, sarei interessato al prestito, sei disponibile questo weekend?', 'in_attesa');
        insLoan.run(bookIds[2], userIds['elena_p'], 'consultazione', 'Posso venire a consultarlo per un lavoro universitario?', 'accettata');
    });

    txn();
    console.log('Seed completato:', USERS.length, 'utenti,', BOOKS.length, 'libri,', CATEGORIES.length, 'categorie.');
    console.log('Credenziali demo (tutti gli utenti): password "Prova1234!"');
}

run();
