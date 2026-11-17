// TrovaLibro - Biblioteca Diffusa - Guido Cauli <guido.cauli@gmail.com>
const bookId = new URLSearchParams(window.location.search).get('id');

function etichettaCondizione(c) {
    return { nuovo: 'Nuovo', ottimo: 'Ottimo', buono: 'Buono', discreto: 'Discreto', rovinato: 'Rovinato' }[c] || c;
}
const statusLabel = { in_attesa: 'In attesa', accettata: 'Accettata', rifiutata: 'Rifiutata', completata: 'Completata', annullata: 'Annullata' };

function renderBook(book) {
    document.title = `${book.title} — TrovaLibro`;
    document.getElementById('page-title').textContent = `${book.title} — TrovaLibro`;
    const initials = (book.owner_name || '?').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();

    document.getElementById('book-content').innerHTML = `
        <article class="book-detail">
            <div>
                <div class="book-detail__cover" style="${book.thumb_path ? `background-image:url('${book.cover_path || book.thumb_path}')` : ''}">
                    ${book.thumb_path ? '' : `<span class="placeholder" style="font-family:var(--font-display);padding:1rem;text-align:center">${escapeHtml(book.title)}</span>`}
                </div>
            </div>
            <div>
                <h1>${escapeHtml(book.title)}</h1>
                <p class="book-card__author" style="font-size:1.05rem">${escapeHtml(book.author)}${book.year ? ' · ' + book.year : ''}${book.publisher ? ' · ' + escapeHtml(book.publisher) : ''}</p>
                <div class="tag-list">
                    <span class="badge">${etichettaCondizione(book.condizione)}</span>
                    ${book.disponibile_prestito ? '<span class="tag">Disponibile per il prestito</span>' : ''}
                    ${book.disponibile_consultazione ? '<span class="tag">Disponibile per consultazione</span>' : ''}
                    ${(book.categories || []).map(c => `<span class="tag">${escapeHtml(c.name)}</span>`).join('')}
                </div>
                ${book.description ? `<p>${escapeHtml(book.description)}</p>` : ''}

                <div class="book-detail__owner">
                    <div class="owner-row">
                        <div class="avatar-circle" aria-hidden="true">${escapeHtml(initials)}</div>
                        <div>
                            <strong>${escapeHtml(book.owner_name)}</strong>
                            <p class="hint" style="margin:0">${book.owner_location_label ? escapeHtml(book.owner_location_label) : 'Posizione non condivisa'}</p>
                        </div>
                    </div>
                </div>
            </div>
        </article>
    `;
}

function mostraSuggerimenti(suggestions) {
    const list = document.getElementById('suggestions-list');
    if (suggestions.length === 0) {
        list.innerHTML = `<p class="hint">Nessun suggerimento ancora. Sii il primo a lasciarne uno.</p>`;
        return;
    }
    list.innerHTML = suggestions.map(s => `
        <div class="loan-request">
            <div class="loan-request__head">
                <strong>${escapeHtml(s.author_name || 'Utente')}</strong>
                <span class="hint">${new Date(s.created_at).toLocaleDateString('it-IT')}</span>
            </div>
            <p style="margin:0.4rem 0 0">${escapeHtml(s.testo)}</p>
        </div>
    `).join('');
}

async function caricaRichieste(id) {
    try {
        const { requests } = await api.get(`/api/books/${id}/loan-requests`);
        const section = document.getElementById('owner-requests-section');
        const list = document.getElementById('owner-requests-list');
        section.style.display = 'block';
        if (requests.length === 0) {
            list.innerHTML = `<p class="hint">Nessuna richiesta ricevuta finora.</p>`;
            return;
        }
        list.innerHTML = requests.map(r => `
            <div class="loan-request">
                <div class="loan-request__head">
                    <strong>${escapeHtml(r.requester_name)}</strong>
                    <span class="status-pill status-${r.stato}">${statusLabel[r.stato]}</span>
                </div>
                <p class="hint" style="margin:0.3rem 0">${r.tipo === 'consultazione' ? 'Consultazione' : 'Prestito'} · ${new Date(r.created_at).toLocaleDateString('it-IT')}</p>
                ${r.messaggio ? `<p style="margin:0.3rem 0">${escapeHtml(r.messaggio)}</p>` : ''}
                ${r.stato === 'in_attesa' ? `
                    <button class="btn btn-secondary btn-sm" data-status="accettata" data-id="${r.id}" type="button">Accetta</button>
                    <button class="btn btn-disab btn-sm" data-status="rifiutata" data-id="${r.id}" type="button">Rifiuta</button>
                ` : ''}
            </div>
        `).join('');
        list.querySelectorAll('[data-status]').forEach(btn => {
            btn.addEventListener('click', async () => {
                await api.put(`/api/books/loan-requests/${btn.dataset.id}/status`, { stato: btn.dataset.status });
                caricaRichieste(id);
            });
        });
    } catch { /* non proprietario: nessuna azione */ }
}

async function init() {
    if (!bookId) { document.getElementById('book-content').innerHTML = '<p>Libro non specificato.</p>'; return; }
    if (new URLSearchParams(window.location.search).get('pubblicato')) {
        document.getElementById('published-banner').hidden = false;
    }

    const { book, suggestions } = await api.get(`/api/books/${bookId}`);
    renderBook(book);
    mostraSuggerimenti(suggestions);

    const { user } = await api.get('/api/auth/me');
    if (user && user.id !== book.owner_id) {
        document.getElementById('loan-section').style.display = 'block';
    }
    if (user && user.id === book.owner_id) {
        caricaRichieste(bookId);
    }
    if (!user) {
        document.getElementById('suggestion-form-card').innerHTML = `<p class="hint"><a href="/login.html?redirect=${encodeURIComponent(window.location.href)}">Accedi</a> per lasciare un suggerimento.</p>`;
    }

    document.getElementById('loan-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const errorBox = document.getElementById('loan-error');
        const successBox = document.getElementById('loan-success');
        errorBox.hidden = true; successBox.hidden = true;
        const tipo = document.querySelector('input[name="tipo"]:checked').value;
        const messaggio = document.getElementById('messaggio').value.trim();
        try {
            await api.post(`/api/books/${bookId}/loan-request`, { tipo, messaggio });
            successBox.textContent = 'Richiesta inviata al proprietario (simulata).';
            successBox.hidden = false;
            document.getElementById('messaggio').value = '';
        } catch (err) {
            errorBox.textContent = err.message;
            errorBox.hidden = false;
        }
    });

    document.getElementById('suggestion-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = document.getElementById('suggestion-text').value.trim();
        if (!text) return;
        try {
            await api.post(`/api/books/${bookId}/suggestions`, { testo: text });
            document.getElementById('suggestion-text').value = '';
            const { suggestions } = await api.get(`/api/books/${bookId}`);
            mostraSuggerimenti(suggestions);
        } catch { /* utente non autenticato: form nascosto già in precedenza */ }
    });
}

document.addEventListener('DOMContentLoaded', init);
