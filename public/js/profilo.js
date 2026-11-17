// TrovaLibro - Biblioteca Diffusa - Guido Cauli <guido.cauli@gmail.com>
let newCoords = null;

function etichettaCondizione(c) {
    return { nuovo: 'Nuovo', ottimo: 'Ottimo', buono: 'Buono', discreto: 'Discreto', rovinato: 'Rovinato' }[c] || c;
}

async function requireLogin() {
    const { user } = await api.get('/api/auth/me');
    if (!user) {
        window.location.href = '/login.html?redirect=/profilo.html';
        return null;
    }
    return user;
}

function fillForm(user) {
    document.getElementById('display_name').value = user.display_name || '';
    document.getElementById('email').value = user.email || '';
    document.getElementById('bio').value = user.bio || '';
    document.getElementById('share_location').checked = !!user.share_location;
    document.getElementById('location-options').style.display = user.share_location ? 'block' : 'none';
    if (user.location_label) document.getElementById('location_label').value = user.location_label;
}

async function loadMyBooks() {
    const { books } = await api.get('/api/books/mine');
    const list = document.getElementById('my-books-list');
    if (books.length === 0) {
        list.innerHTML = `<div class="empty-state">Non hai ancora pubblicato nessun libro.</div>`;
        return;
    }
    list.innerHTML = books.map(b => `
        <div class="loan-request">
            <div class="loan-request__head">
                <strong><a href="/libro.html?id=${b.id}">${escapeHtml(b.title)}</a></strong>
                <span class="badge">${etichettaCondizione(b.condizione)}</span>
            </div>
            <p class="hint" style="margin:0.4rem 0">${escapeHtml(b.author)}${b.year ? ' · ' + b.year : ''} — stato: ${b.status}</p>
            <a class="btn btn-disab btn-sm" href="/pubblica.html?edit=${b.id}">Modifica</a>
            <button class="btn btn-disab btn-sm" data-delete="${b.id}" type="button">Rimuovi</button>
        </div>
    `).join('');

    list.querySelectorAll('[data-delete]').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm('Rimuovere questo libro dal catalogo?')) return;
            await api.del(`/api/books/${btn.dataset.delete}`);
            loadMyBooks();
        });
    });
}

function setupElimina(user) {
    const form = document.getElementById('delete-account-form');
    if (user.role === 'admin') {
        form.hidden = true;
        const notice = document.createElement('p');
        notice.className = 'banner banner-info';
        notice.textContent = 'Gli account amministratore non possono essere eliminati autonomamente. Se necessario, chiedi a un altro amministratore di eliminare il tuo account dal pannello di gestione utenti.';
        form.insertAdjacentElement('afterend', notice);
        return;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const errorBox = document.getElementById('delete-account-error');
        errorBox.hidden = true;

        if (!confirm('Sei sicuro di voler eliminare definitivamente il tuo account e tutti i libri pubblicati? L\'operazione non è reversibile.')) {
            return;
        }

        const password = document.getElementById('delete_password').value;
        try {
            await api.request('DELETE', '/api/users/me', { password });
            window.location.href = '/';
        } catch (err) {
            errorBox.textContent = err.message;
            errorBox.hidden = false;
        }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    const user = await requireLogin();
    if (!user) return;
    fillForm(user);
    loadMyBooks();
    setupElimina(user);

    document.getElementById('share_location').addEventListener('change', (e) => {
        document.getElementById('location-options').style.display = e.target.checked ? 'block' : 'none';
    });

    document.getElementById('locate-btn').addEventListener('click', () => {
        const status = document.getElementById('geo-status');
        if (!navigator.geolocation) { status.textContent = 'Geolocalizzazione non supportata.'; return; }
        status.textContent = 'Richiesta posizione al browser…';
        navigator.geolocation.getCurrentPosition(
            (pos) => { newCoords = { lat: pos.coords.latitude, lon: pos.coords.longitude }; status.textContent = 'Posizione rilevata ✓'; },
            () => { status.textContent = 'Posizione non disponibile.'; }
        );
    });

    document.getElementById('profile-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const errorBox = document.getElementById('form-error');
        const successBox = document.getElementById('form-success');
        errorBox.hidden = true; successBox.hidden = true;

        const shareLocation = document.getElementById('share_location').checked;
        const payload = {
            display_name: document.getElementById('display_name').value.trim(),
            email: document.getElementById('email').value.trim(),
            bio: document.getElementById('bio').value.trim(),
            share_location: shareLocation,
            location_precision: document.getElementById('location_precision').value,
            location_label: document.getElementById('location_label').value.trim() || null,
        };
        if (newCoords) { payload.latitude = newCoords.lat; payload.longitude = newCoords.lon; }

        try {
            await api.put('/api/users/me', payload);
            successBox.textContent = 'Profilo aggiornato con successo.';
            successBox.hidden = false;
        } catch (err) {
            errorBox.textContent = err.message;
            errorBox.hidden = false;
        }
    });

    document.getElementById('password-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const errorBox = document.getElementById('password-error');
        const successBox = document.getElementById('password-success');
        errorBox.hidden = true; successBox.hidden = true;

        const current_password = document.getElementById('current_password').value;
        const new_password = document.getElementById('new_password').value;
        const confirm = document.getElementById('new_password_confirm').value;

        if (new_password !== confirm) {
            errorBox.textContent = 'La nuova password e la conferma non coincidono.';
            errorBox.hidden = false;
            return;
        }

        try {
            await api.put('/api/users/me/password', { current_password, new_password });
            successBox.textContent = 'Password aggiornata con successo.';
            successBox.hidden = false;
            document.getElementById('password-form').reset();
        } catch (err) {
            errorBox.textContent = err.message;
            errorBox.hidden = false;
        }
    });

});
