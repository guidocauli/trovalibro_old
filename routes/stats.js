const express = require('express');
const db = require('../db/database');
const { requireAuth, requireAdmin } = require('../auth');

const router = express.Router();

// GET /api/stats/book/:id — statistiche di un singolo libro (solo proprietario)
router.get('/book/:id', requireAuth, (req, res) => {
    const book = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
    if (!book) return res.status(404).json({ error: 'Libro non trovato.' });
    if (book.owner_id !== req.session.userId) return res.status(403).json({ error: 'Non autorizzato.' });

    const totalViews = db.prepare('SELECT COUNT(*) AS n FROM book_views WHERE book_id = ?').get(book.id).n;
    const uniqueViewers = db.prepare(`
        SELECT COUNT(DISTINCT COALESCE(viewer_id, session_id)) AS n FROM book_views WHERE book_id = ?
    `).get(book.id).n;
    const viewsByDay = db.prepare(`
        SELECT date(viewed_at) AS day, COUNT(*) AS n FROM book_views
        WHERE book_id = ? GROUP BY day ORDER BY day DESC LIMIT 30
    `).all(book.id);
    const loanCounts = db.prepare(`
        SELECT stato, COUNT(*) AS n FROM loan_requests WHERE book_id = ? GROUP BY stato
    `).all(book.id);
    const suggestionsCount = db.prepare('SELECT COUNT(*) AS n FROM suggestions WHERE book_id = ?').get(book.id).n;

    res.json({
        book_id: book.id,
        total_views: totalViews,
        unique_viewers: uniqueViewers,
        views_by_day: viewsByDay,
        loan_requests_by_status: loanCounts,
        suggestions_count: suggestionsCount,
    });
});

// GET /api/stats/mine — statistiche aggregate su tutti i libri dell'utente
router.get('/mine', requireAuth, (req, res) => {
    const books = db.prepare('SELECT id, title, thumb_path FROM books WHERE owner_id = ?').all(req.session.userId);
    const ids = books.map(b => b.id);
    if (ids.length === 0) return res.json({ books: [], totals: { views: 0, loan_requests: 0 } });

    const placeholders = ids.map(() => '?').join(',');
    const viewsPerBook = db.prepare(`
        SELECT book_id, COUNT(*) AS n FROM book_views WHERE book_id IN (${placeholders}) GROUP BY book_id
    `).all(...ids);
    const loansPerBook = db.prepare(`
        SELECT book_id, COUNT(*) AS n FROM loan_requests WHERE book_id IN (${placeholders}) GROUP BY book_id
    `).all(...ids);

    const viewsMap = Object.fromEntries(viewsPerBook.map(v => [v.book_id, v.n]));
    const loansMap = Object.fromEntries(loansPerBook.map(l => [l.book_id, l.n]));

    const result = books.map(b => ({
        ...b,
        views: viewsMap[b.id] || 0,
        loan_requests: loansMap[b.id] || 0,
    }));

    res.json({
        books: result,
        totals: {
            views: result.reduce((s, b) => s + b.views, 0),
            loan_requests: result.reduce((s, b) => s + b.loan_requests, 0),
        },
    });
});

// GET /api/stats/admin/dashboard — metriche globali della piattaforma (solo admin)
router.get('/admin/dashboard', requireAuth, requireAdmin, (req, res) => {
    const usersCount = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
    const booksCount = db.prepare(`SELECT COUNT(*) AS n FROM books WHERE status = 'pubblicato'`).get().n;
    const viewsCount = db.prepare('SELECT COUNT(*) AS n FROM book_views').get().n;
    const loanRequestsCount = db.prepare('SELECT COUNT(*) AS n FROM loan_requests').get().n;
    const usersWithGeo = db.prepare('SELECT COUNT(*) AS n FROM users WHERE share_location = 1').get().n;

    const topBooks = db.prepare(`
        SELECT b.id, b.title, b.author, COUNT(v.id) AS views
        FROM books b LEFT JOIN book_views v ON v.book_id = b.id
        GROUP BY b.id ORDER BY views DESC LIMIT 10
    `).all();

    const categoryDistribution = db.prepare(`
        SELECT c.name, COUNT(bc.book_id) AS n FROM categories c
        LEFT JOIN book_categories bc ON bc.category_id = c.id
        GROUP BY c.id ORDER BY n DESC
    `).all();

    const signupsByDay = db.prepare(`
        SELECT date(created_at) AS day, COUNT(*) AS n FROM users
        GROUP BY day ORDER BY day DESC LIMIT 30
    `).all();

    const loansByStatus = db.prepare(`
        SELECT stato, COUNT(*) AS n FROM loan_requests GROUP BY stato
    `).all();

    res.json({
        totals: { users: usersCount, books: booksCount, views: viewsCount, loan_requests: loanRequestsCount, users_with_geo: usersWithGeo },
        top_books: topBooks,
        category_distribution: categoryDistribution,
        signups_by_day: signupsByDay,
        loans_by_status: loansByStatus,
    });
});

module.exports = router;
