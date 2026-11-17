#!/usr/bin/env node
// TrovaLibro - Biblioteca Diffusa - Guido Cauli <guido.cauli@gmail.com>
// Script necessario per ndividuare ed eliminare i dati senza utente nel database,
// cioè righe che fanno riferimento a utenti o libri inesistenti dopo una cancellazione.
//
// In condizioni normali questa situazione non dovrebbe verificarsi, poiché
// le chiavi esterne sono dichiarate con ON DELETE CASCADE (o SET NULL)
// e l'app applica sempre la PRAGMA foreign_keys = ON (vedi db/database.js).
// Se invece il database viene modificato al di fuori dell'app,
// ad esempio alcuni client che di default non applicano i vincoli di integrità referenziale.
// Utilizzo:
//   node db/cleanup-orphans.js            # esegue la pulizia
//   node db/cleanup-orphans.js --dry-run  # effettua la dry run senza modifiche

const db = require('./database');
const { eliminaImmagine } = require('../upload');
const dryRun = process.argv.includes('--dry-run'); 



function countOf(sql) {
    return db.prepare(sql).get().n; 
}

function report(label, n) {
    console.log(`${dryRun ? '[anteprima] ' : ''}${label}: ${n}`); 
}

const runCleanup = db.transaction(() => {
//    Rimozione dei libri senza proprietareio insieme a
//    tutto ciò che dipende da loro (categorie, richieste di
//    prestito, visualizzazioni, suggerimenti) e alle relative immagini su disco.
  const libriOrfani = db.prepare(`
                SELECT id, cover_path, thumb_path FROM books
                WHERE owner_id NOT IN (SELECT id FROM users)
  `).all(); 


    report('Libri orfani (proprietario inesistente)', libriOrfani.length);
    if (!dryRun) {
        for (const b of libriOrfani) {
          db.prepare('DELETE FROM book_categories WHERE book_id = ?').run(b.id); 
          db.prepare('DELETE FROM loan_requests WHERE book_id = ?').run(b.id);
          db.prepare('DELETE FROM book_views WHERE book_id = ?').run(b.id); 
          db.prepare('DELETE FROM suggestions WHERE book_id = ?').run(b.id);
          db.prepare('DELETE FROM books WHERE id = ?').run(b.id);
          eliminaImmagine(b.cover_path);
          eliminaImmagine(b.thumb_path); 
      }
    }



//  Associazioni che puntano a un libro o una categoria inesistenti.
    const catOrfane = countOf(`
        SELECT COUNT(*) AS n FROM book_categories
        WHERE book_id NOT IN (SELECT id FROM books) OR category_id NOT IN (SELECT id FROM categories) 
    `);
    report('Associazioni libro-categoria orfane', catOrfane);
    if (!dryRun && catOrfane) {
        db.prepare(`
            DELETE FROM book_categories 
            WHERE book_id NOT IN (SELECT id FROM books) OR category_id NOT IN (SELECT id FROM categories)
       `).run();
    }

// Richieste di prestito il cui richiedente o il cui libro sono stati eliminati.
    const prestitiOrfani = countOf(`
        SELECT COUNT(*) AS n FROM loan_requests
        WHERE requester_id NOT IN (SELECT id FROM users) OR book_id NOT IN (SELECT id FROM books)
    `);
    report('Richieste di prestito orfane', prestitiOrfani);
    if (!dryRun && prestitiOrfani) {
        db.prepare(`
            DELETE FROM loan_requests
            WHERE requester_id NOT IN (SELECT id FROM users) OR book_id NOT IN (SELECT id FROM books)
        `).run();
    }

// Visualizzazioni relative a un libro cancellato
  const visteOrfane2 = countOf(`SELECT COUNT(*) AS n FROM book_views WHERE book_id NOT IN (SELECT id FROM books)`); 
  report('Visualizzazioni orfane (libro inesistente)', visteOrfane2);
   if (!dryRun && visteOrfane2) { 
      db.prepare(`DELETE FROM book_views WHERE book_id NOT IN (SELECT id FROM books)`).run();
    }

// Visualizzazioni associate a un utente ormai cancellato: qui rispetto ai casi di prima 
// il libro esiste, quindi la riga resta utile alle statistiche e viene solamente anonimizzata
   const visteOrfane1 = countOf(`
        SELECT COUNT(*) AS n FROM book_views WHERE viewer_id IS NOT NULL AND viewer_id NOT IN (SELECT id FROM users)
   `);
   report('Visualizzazioni con utente inesistente (anonimizzate)', visteOrfane1);
    if (!dryRun && visteOrfane1) {
        db.prepare(`
            UPDATE book_views SET viewer_id = NULL 
            WHERE viewer_id IS NOT NULL AND viewer_id NOT IN (SELECT id FROM users) 
        `).run();
    }


// Eliminazione dei suggerimenti relativi a un libro ormai inesistente
    const suggOrfani2 = countOf(`SELECT COUNT(*) AS n FROM suggestions WHERE book_id NOT IN (SELECT id FROM books)`);
    report('Suggerimenti orfani (libro inesistente)', suggOrfani2);
    if (!dryRun && suggOrfani2) {
        db.prepare(`DELETE FROM suggestions WHERE book_id NOT IN (SELECT id FROM books)`).run(); 
    }

// Suggerimenti il cui autore non esiste più: il testo resta ma senza atrtibuzione.
    const suggOrfani1 = countOf(`
        SELECT COUNT(*) AS n FROM suggestions WHERE author_id IS NOT NULL AND author_id NOT IN ( SELECT id FROM users) 
    `);
    report('Suggerimenti con autore inesistente (anonimizzati)', suggOrfani1);
    if (!dryRun && suggOrfani1) {
        db.prepare(`
            UPDATE suggestions SET author_id = NULL
            WHERE author_id IS NOT NULL AND author_id NOT IN (SELECT id FROM users)
        `).run();
    }



//  Elementi dei log riguardanti consensi relativi a eevntuali utenti cancellati.
    const consensiOrfani = countOf(`SELECT COUNT(*) AS n FROM consent_log WHERE user_id NOT IN (SELECT id FROM users)`);  
    report('Voci di log consensi orfane', consensiOrfani);
     if (!dryRun && consensiOrfani) {
        db.prepare(`DELETE FROM consent_log WHERE user_id NOT IN (SELECT id FROM users)`).run(); 
     } 
});





runCleanup();

console.log(dryRun
    ? '\nAnteprima completata: nessuna modifica effettuata sul database. Eseguire senza --dry-run per applicarla.'
    : '\nPulizia effettuata.');




