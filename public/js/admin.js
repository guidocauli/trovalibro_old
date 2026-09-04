const statusLabel = { in_attesa: 'In attesa', accettata: 'Accettata', rifiutata: 'Rifiutata', completata: 'Completata', annullata: 'Annullata' };

function renderBars(containerId, data, labelKey, valueKey) {
    const el = document.getElementById(containerId);
    if (!data || data.length === 0) { el.innerHTML = `<p class="hint">Ancora nessun dato.</p>`; return; }
    const max = Math.max(...data.map(d => d[valueKey]), 1);
    el.innerHTML = data.map(d => {
        const pct = Math.max(4, Math.round((d[valueKey] / max) * 100));
        return `<div class="bar" data-empty="${d[valueKey] === 0}" style="height:${pct}%" title="${escapeHtml(String(d[labelKey]))}: ${d[valueKey]}"></div>`;
    }).join('');
}

async function init() {
    const { user } = await api.get('/api/auth/me');
    if (!user) { window.location.href = '/login.html?redirect=/admin.html'; return; }
    if (user.role !== 'admin') {
        document.getElementById('not-admin').hidden = false;
        return;
    }

    let data;
    try {
        data = await api.get('/api/stats/admin/dashboard');
    } catch (err) {
        document.getElementById('not-admin').textContent = err.message;
        document.getElementById('not-admin').hidden = false;
        return;
    }

    document.getElementById('admin-app').hidden = false;
    document.getElementById('totals-grid').innerHTML = `
        <div class="stat-card"><div class="value">${data.totals.users}</div><div class="label">Utenti registrati</div></div>
        <div class="stat-card"><div class="value">${data.totals.books}</div><div class="label">Libri pubblicati</div></div>
        <div class="stat-card"><div class="value">${data.totals.views}</div><div class="label">Visualizzazioni totali</div></div>
        <div class="stat-card"><div class="value">${data.totals.loan_requests}</div><div class="label">Richieste di prestito</div></div>
        <div class="stat-card"><div class="value">${data.totals.users_with_geo}</div><div class="label">Utenti geolocalizzati</div></div>
    `;

    document.getElementById('top-books-body').innerHTML = data.top_books.map(b => `
        <tr><td>${escapeHtml(b.title)}</td><td>${escapeHtml(b.author)}</td><td>${b.views}</td></tr>
    `).join('') || '<tr><td colspan="3">Nessun dato.</td></tr>';

    renderBars('category-chart', data.category_distribution, 'name', 'n');
    document.getElementById('category-legend').textContent = data.category_distribution.map(c => `${c.name} (${c.n})`).join(' · ');

    renderBars('signups-chart', [...data.signups_by_day].sort((a, b) => a.day.localeCompare(b.day)), 'day', 'n');

    document.getElementById('loans-status-body').innerHTML = data.loans_by_status.map(l => `
        <tr><td><span class="status-pill status-${l.stato}">${statusLabel[l.stato] || l.stato}</span></td><td>${l.n}</td></tr>
    `).join('') || '<tr><td colspan="2">Nessuna richiesta ancora.</td></tr>';
}

document.addEventListener('DOMContentLoaded', init);
