// TrovaLibro - Biblioteca Diffusa - Guido Cauli <guido.cauli@gmail.com>
function disegnaGrafico(containerId, data) {
    // data: array di { day, n }. Grafico a barre realizzato in puro CSS
    // (nessuna libreria esterna): ogni barra ha altezza proporzionale al
    // massimo della serie. Ordiniamo dal più vecchio al più recente.
    const el = document.getElementById(containerId);
    if (!data || data.length === 0) {
        el.innerHTML = `<p class="hint">Ancora nessun dato da mostrare.</p>`;
        return;
    }
    const sorted = [...data].sort((a, b) => a.day.localeCompare(b.day));
    const max = Math.max(...sorted.map(d => d.n), 1);
    el.innerHTML = sorted.map(d => {
        const pct = Math.max(4, Math.round((d.n / max) * 100));
        const label = new Date(d.day).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
        return `<div class="bar" style="height:${pct}%" title="${label}: ${d.n} visualizzazioni"></div>`;
    }).join('');
}

async function loadDetail(bookId, title) {
    const section = document.getElementById('book-detail-stats');
    section.hidden = false;
    document.getElementById('detail-title').textContent = `Dettaglio: ${title}`;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });

    const stats = await api.get(`/api/stats/book/${bookId}`);
    document.getElementById('detail-totals').innerHTML = `
        <div class="stat-card"><div class="value">${stats.total_views}</div><div class="label">Visualizzazioni totali</div></div>
        <div class="stat-card"><div class="value">${stats.unique_viewers}</div><div class="label">Visitatori unici</div></div>
        <div class="stat-card"><div class="value">${stats.suggestions_count}</div><div class="label">Suggerimenti ricevuti</div></div>
    `;
    disegnaGrafico('views-chart', stats.views_by_day);
}

async function init() {
    const { user } = await api.get('/api/auth/me');
    if (!user) { window.location.href = '/login.html?redirect=/dashboard.html'; return; }

    const { books, totals } = await api.get('/api/stats/mine');
    document.getElementById('totals-grid').innerHTML = `
        <div class="stat-card"><div class="value">${books.length}</div><div class="label">Libri pubblicati</div></div>
        <div class="stat-card"><div class="value">${totals.views}</div><div class="label">Visualizzazioni totali</div></div>
        <div class="stat-card"><div class="value">${totals.loan_requests}</div><div class="label">Richieste ricevute</div></div>
    `;

    const tbody = document.getElementById('stats-table-body');
    if (books.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4">Non hai ancora pubblicato libri. <a href="/pubblica.html">Pubblicane uno</a>.</td></tr>`;
        return;
    }
    tbody.innerHTML = books.map(b => `
        <tr>
            <td>${escapeHtml(b.title)}</td>
            <td>${b.views}</td>
            <td>${b.loan_requests}</td>
            <td><button class="btn btn-disab btn-sm" data-id="${b.id}" data-title="${escapeHtml(b.title)}" type="button">Vedi dettaglio</button></td>
        </tr>
    `).join('');
    tbody.querySelectorAll('button[data-id]').forEach(btn => {
        btn.addEventListener('click', () => loadDetail(btn.dataset.id, btn.dataset.title));
    });
}

document.addEventListener('DOMContentLoaded', init);
