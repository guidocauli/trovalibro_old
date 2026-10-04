#!/usr/bin/env node
// Script di manutenzione: individua ed elimina le entry "orfane" nel database,
// cioè righe che fanno riferimento a utenti o libri ormai inesistenti.
//
// In condizioni normali questa situazione non dovrebbe verificarsi, perché
// tutte le chiavi esterne sono dichiarate con ON DELETE CASCADE (o SET NULL)
// e l'app applica sempre PRAGMA foreign_keys = ON (vedi db/database.js).
// Può però capitare se il database viene modificato al di fuori dell'app,
// ad esempio con il client "sqlite3" da riga di comando (che di default NON
// applica i vincoli di integrità referenziale) o con un altro strumento che
// scrive direttamente sul file .db.
//
// Uso:
//   node db/cleanup-orphans.js            # esegue la pulizia
//   node db/cleanup-orphans.js --dry-run  # mostra solo cosa verrebbe rimosso, senza modificare nulla

const db = require('./database');
const { deleteImageIfExists } = require('../upload');

const dryRun = process.argv.includes('--dry-run');

function countOf(sql) {
    return db.prepare(sql).get().n;
}
function report(label, n) {
    console.log(`${dryRun ? '[anteprima] ' : ''}${label}: ${n}`);
}

const runCleanup = db.transaction(() => {
    // 1. Libri il cui proprietario non esiste più: vanno rimossi insieme a
    //    tutto ciò che dipende da loro (categorie associate, richieste di
    //    prestito, visualizzazioni, suggerimenti) e alle relative immagini su disco.
    const orphanBooks = db.prepare(`
        SELECT id, cover_path, thumb_path FROM books
        WHERE owner_id NOT IN (SELECT id FROM users)
    `).all();
    report('Libri orfani (proprietario inesistente)', orphanBooks.length);
    if (!dryRun) {
        for (const b of orphanBooks) {
            db.prepare('DELETE FROM book_categories WHERE book_id = ?').run(b.id);
            db.prepare('DELETE FROM loan_requests WHERE book_id = ?').run(b.id);
            db.prepare('DELETE FROM book_views WHERE book_id = ?').run(b.id);
            db.prepare('DELETE FROM suggestions WHERE book_id = ?').run(b.id);
            db.prepare('DELETE FROM books WHERE id = ?').run(b.id);
            deleteImageIfExists(b.cover_path);
            deleteImageIfExists(b.thumb_path);
        }
    }

    // 2. Associazioni libro-categoria che puntano a un libro o una categoria inesistenti.
    const orphanBookCats = countOf(`
        SELECT COUNT(*) AS n FROM book_categories
        WHERE book_id NOT IN (SELECT id FROM books) OR category_id NOT IN (SELECT id FROM categories)
    `);
    report('Associazioni libro-categoria orfane', orphanBookCats);
    if (!dryRun && orphanBookCats) {
        db.prepare(`
            DELETE FROM book_categories
            WHERE book_id NOT IN (SELECT id FROM books) OR category_id NOT IN (SELECT id FROM categories)
        `).run();
    }

    // 3. Richieste di prestito il cui richiedente o il cui libro non esistono più.
    const orphanLoans = countOf(`
        SELECT COUNT(*) AS n FROM loan_requests
        WHERE requester_id NOT IN (SELECT id FROM users) OR book_id NOT IN (SELECT id FROM books)
    `);
    report('Richieste di prestito orfane', orphanLoans);
    if (!dryRun && orphanLoans) {
        db.prepare(`
            DELETE FROM loan_requests
            WHERE requester_id NOT IN (SELECT id FROM users) OR book_id NOT IN (SELECT id FROM books)
        `).run();
    }

    // 4. Visualizzazioni relative a un libro ormai inesistente: l'evento perde
    //    significato senza il libro a cui si riferisce, quindi va eliminato.
    const orphanViewsByBook = countOf(`SELECT COUNT(*) AS n FROM book_views WHERE book_id NOT IN (SELECT id FROM books)`);
    report('Visualizzazioni orfane (libro inesistente)', orphanViewsByBook);
    if (!dryRun && orphanViewsByBook) {
        db.prepare(`DELETE FROM book_views WHERE book_id NOT IN (SELECT id FROM books)`).run();
    }

    // 5. Visualizzazioni associate a un utente ormai cancellato: qui invece il
    //    libro esiste ancora, quindi la riga resta utile alle statistiche e
    //    viene solo anonimizzata (stesso comportamento previsto da ON DELETE SET NULL).
    const orphanViewsByUser = countOf(`
        SELECT COUNT(*) AS n FROM book_views WHERE viewer_id IS NOT NULL AND viewer_id NOT IN (SELECT id FROM users)
    `);
    report('Visualizzazioni con utente inesistente (anonimizzate)', orphanViewsByUser);
    if (!dryRun && orphanViewsByUser) {
        db.prepare(`
            UPDATE book_views SET viewer_id = NULL
            WHERE viewer_id IS NOT NULL AND viewer_id NOT IN (SELECT id FROM users)
        `).run();
    }

    // 6. Suggerimenti relativi a un libro ormai inesistente: vanno eliminati.
    const orphanSuggByBook = countOf(`SELECT COUNT(*) AS n FROM suggestions WHERE book_id NOT IN (SELECT id FROM books)`);
    report('Suggerimenti orfani (libro inesistente)', orphanSuggByBook);
    if (!dryRun && orphanSuggByBook) {
        db.prepare(`DELETE FROM suggestions WHERE book_id NOT IN (SELECT id FROM books)`).run();
    }

    // 7. Suggerimenti il cui autore non esiste più: il testo resta (ha valore
    //    per chi legge la scheda libro) ma l'attribuzione viene rimossa.
    const orphanSuggByUser = countOf(`
        SELECT COUNT(*) AS n FROM suggestions WHERE author_id IS NOT NULL AND author_id NOT IN (SELECT id FROM users)
    `);
    report('Suggerimenti con autore inesistente (anonimizzati)', orphanSuggByUser);
    if (!dryRun && orphanSuggByUser) {
        db.prepare(`
            UPDATE suggestions SET author_id = NULL
            WHERE author_id IS NOT NULL AND author_id NOT IN (SELECT id FROM users)
        `).run();
    }

    // 8. Voci di log dei consensi relative a utenti ormai cancellati.
    const orphanConsent = countOf(`SELECT COUNT(*) AS n FROM consent_log WHERE user_id NOT IN (SELECT id FROM users)`);
    report('Voci di log consensi orfane', orphanConsent);
    if (!dryRun && orphanConsent) {
        db.prepare(`DELETE FROM consent_log WHERE user_id NOT IN (SELECT id FROM users)`).run();
    }
});

runCleanup();

console.log(dryRun
    ? '\nAnteprima completata: nessuna modifica è stata scritta sul database. Esegui senza --dry-run per applicarla.'
    : '\nPulizia completata.');
