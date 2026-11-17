// TrovaLibro - Biblioteca Diffusa - Guido Cauli <guido.cauli@gmail.com>
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
    { username: 'admin',  email: 'admin@bibliotecadiffusa.it', display_name: 'Amministrazione', role: 'admin',
      lat: 41.1171, lon: 16.8650, label: 'Bari, Picone', share: 1 },
    { username: 'guido.cauli', email: 'guido.cauli@gmail.com', display_name: 'Guido Cauli', role: 'utente',
      lat: 41.1126, lon: 16.8650, label: 'Bari, Picone', share: 1,
      bio: 'Fantascienza e filosofia.' },
    { username: 'teddy.ranieri', email: 'teddy.ranieri@gmail.com', display_name: 'Teodora Ranieri', role: 'utente',
      lat: 41.1126, lon: 16.8650, label: 'Bari, Picone', share: 1,
      bio: 'Narrativa, poesia, storia e saggi.' },
    { username: 'giulia', email: 'giulia@example.it', display_name: 'Giulia', role: 'utente',
      lat: 41.1256, lon: 16.8623, label: 'Bari, Murat', share: 1,
      bio: 'Appassionata di narrativa contemporanea, poesia del Novecento.' },
    { username: 'elena', email: 'elena@example.it', display_name: 'Elena', role: 'utente',
      lat: 41.0964, lon: 16.8698, label: 'Bari, Carrassi', share: 1,
      bio: 'Piccola biblioteca di famiglia: gialli, storia locale e fumetti.' },
    { username: 'nicola', email: 'nicola@example.it', display_name: 'Nicola', role: 'utente',
      lat: 41.1403, lon: 16.8556, label: 'Bitonto (BA)', share: 1,
      bio: 'Miscellanea.' },];

const BOOKS = [
    { owner: 'giulia', title: 'Se questo è un uomo', author: 'Primo Levi', year: 1947, publisher: 'Einaudi',
      cats: ['narrativa', 'storia'], condizione: 'buono',
      description: 'Edizione economica, sottolineature leggere a matita.' },
    { owner: 'teddy.ranieri', title: 'Ossi di seppia', author: 'Eugenio Montale', year: 1925, publisher: 'Mondadori',
      cats: ['poesia'], condizione: 'ottimo', description: 'Copia da collezione, ottime condizioni.' },
    { owner: 'guido.cauli', title: 'Breve storia del tempo', author: 'Stephen Hawking', year: 1988, publisher: 'Rizzoli',
      cats: ['scienza', 'saggistica'], condizione: 'buono', description: 'Prestata già due volte, sempre restituita in buono stato.' },
    { owner: 'guido.cauli', title: 'Il manuale dell\'elettricista', author: 'AA.VV.', year: 2005, publisher: 'Hoepli',
      cats: ['manuali'], condizione: 'discreto', description: 'Alcune pagine ingiallite ma completo.' },
    { owner: 'teddy.ranieri', title: 'La forma dell\'acqua', author: 'Andrea Camilleri', year: 1994, publisher: 'Sellerio',
      cats: ['gialli'], condizione: 'ottimo', description: 'Prima edizione economica.' },
    { owner: 'elena', title: 'Storia di Bari', author: 'Vito A. Melchiorre', year: 2001, publisher: 'Adda',
      cats: ['storia'], condizione: 'buono', description: 'Volume illustrato sulla storia cittadina.' },
    { owner: 'elena', title: 'Corto Maltese - Una ballata del mare salato', author: 'Hugo Pratt', year: 1967,
      publisher: 'Rizzoli Lizard', cats: ['fumetti'], condizione: 'ottimo', description: 'Ristampa cartonata.' },
    { owner: 'nicola', title: 'Dune', author: 'Frank Herbert', year: 1965, publisher: 'Fanucci',
      cats: ['fantascienza'], condizione: 'buono', description: 'Edizione con copertina rigida, ottimo stato del dorso.' },
    { owner: 'nicola', title: 'Così parlò Zarathustra', author: 'Friedrich Nietzsche', year: 1883, publisher: 'Adelphi',
      cats: ['filosofia'], condizione: 'nuovo', description: 'Mai letto, acquistato in doppia copia per errore.' },
    { owner: 'nicola', title: 'La Fondazione', author: 'Isaac Asimov', year: 1951, publisher: 'Mondadori',
      cats: ['fantascienza'], condizione: 'buono', description: null },
];

function run() {
    const insUser = db.prepare(` 
        INSERT INTO users (username, email, password_hash, display_name, bio, latitude, longitude, 
                            location_label, location_precision, share_location, role)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'quartiere', ?, ?) `);
    const insCat = db.prepare('INSERT OR IGNORE INTO categories (name, slug) VALUES (?, ?)');
    const insBook = db.prepare(`
        INSERT INTO books (owner_id, title, author, year, publisher, description, condizione, latitude, longitude, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pubblicato') `);
   const linkCat  =  db.prepare('INSERT OR IGNORE INTO book_categories (book_id, category_id) VALUES (?, ?)');
    const insView = db.prepare(`INSERT INTO book_views (book_id, viewer_id, session_id, viewed_at) VALUES (?, ?, ?, datetime('now', ?))`);
    const insLoan = db.prepare(`INSERT INTO loan_requests (book_id, requester_id, tipo, messaggio, stato) VALUES (?, ?, ?, ?, ?)`); 

    const txn = db.transaction(() => {
        // Pass comune per tutti gli utenti demo (solo per test!!!)       
        const hashDemo = bcrypt.hashSync('Prova1234!', 10); 

        const userIds = {};
         for (const u of USERS) { 
              const info = insUser.run( u.username, u.email, hashDemo, u.display_name, u.bio || null, u.lat, u.lon, u.label, u.share, u.role );
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

        // Visualizzazioni ed engagement dimostativi,  negli ultimi 14 giorni, per popolare grafici e dashboard.
        for (const bookId of bookIds) {
             const n = 3 + Math.floor(Math.random() * 20); 
            for (let i = 0; i < n; i++) {
               const daysAgo = `-${Math.floor(Math.random() * 14)} days`;
               insView.run(bookId, null, `demo-session-${Math.floor(Math.random() * 8)}`, daysAgo);
           }
        }
        insLoan.run(bookIds[0], userIds['nicola'], 'prestito', 'Ciao Giulia! sono interessato al prestito, sei disponibile questo venerdì?', 'in_attesa');
        insLoan.run(bookIds[2], userIds['elena'], 'consultazione', 'Posso venire a consultarlo per un project work universitario?', 'accettata');
    });
    txn(); 
    console.log('Seed effettuato:', USERS.length, 'utenti,',  BOOKS.length, 'libri,', CATEGORIES.length, 'categorie.');
    console.log('Credenziali demo per tutti gli utenti: password "Prova1234!"');  
}
run();  




