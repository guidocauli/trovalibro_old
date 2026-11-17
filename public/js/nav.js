// TrovaLibro - Biblioteca Diffusa - Guido Cauli <guido.cauli@gmail.com>
// Aggiorna l'intestazione (login/registrazione vs profilo/logout) in base
// alla sessione corrente. Incluso in tutte le pagine dopo api.js.
async function initNav() {
    const slot = document.getElementById('nav-user-slot');
    if (!slot) return;
    try {
        const { user } = await api.get('/api/auth/me');
        if (user) {
            slot.innerHTML = `
                <span>Ciao, ${escapeHtml(user.display_name)}</span>
                <a class="btn btn-secondary btn-sm" href="/profilo.html">Profilo</a>
                <a class="btn btn-secondary btn-sm" href="/pubblica.html">Pubblica un libro</a>
                <a class="btn btn-secondary btn-sm" href="/dashboard.html">Statistiche</a>
                ${user.role === 'admin' ? '<a class="btn btn-secondary btn-sm" href="/admin.html">Amministrazione</a>' : ''}
                <button class="btn btn-disab btn-sm" id="logout-btn" type="button">Esci</button>
            `;
            document.getElementById('logout-btn').addEventListener('click', async () => {
                await api.post('/api/auth/logout');
                window.location.href = '/';
            });
        } else {
            slot.innerHTML = `
                <a class="btn btn-secondary btn-sm" href="/login.html">Accedi</a>
                <a class="btn btn-primary btn-sm" href="/registrati.html">Registrati</a>
            `;
        }
    } catch {
        // Sessione non disponibile: mostra comunque i link di accesso.
        slot.innerHTML = `<a class="btn btn-secondary btn-sm" href="/login.html">Accedi</a>`;
    }
}

function escapeHtml(str) {
    if (str == null) return '';
    return String(str).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
}

document.addEventListener('DOMContentLoaded', initNav);
