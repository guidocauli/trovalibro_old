// TrovaLibro - Biblioteca Diffusa - Guido Cauli <guido.cauli@gmail.com>
const editId = new URLSearchParams(window.location.search).get('edit');
let allCategories = [];

async function requireLogin() {
    const { user } = await api.get('/api/auth/me');
    if (!user) window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    return user;
}

async function caricaCategorie(selectedIds = []) {
    const { categories } = await api.get('/api/books/categories');
    allCategories = categories;
    const wrap = document.getElementById('categories-checkboxes');
    wrap.innerHTML = categories.map(c => `
        <div class="checkbox-row">
            <input type="checkbox" id="cat-${c.id}" value="${c.id}" ${selectedIds.includes(c.id) ? 'checked' : ''}>
            <label for="cat-${c.id}" style="margin:0">${escapeHtml(c.name)}</label>
        </div>
    `).join('');
}

function catSelezionate() {
    return allCategories
        .map(c => c.id)
        .filter(id => document.getElementById(`cat-${id}`)?.checked);
}

async function loadForEdit(id) {
    const { book } = await api.get(`/api/books/${id}`);
    document.getElementById('page-title').textContent = 'Modifica libro';
    document.getElementById('submit-btn').textContent = 'Salva modifiche';
    document.getElementById('title').value = book.title;
    document.getElementById('author').value = book.author;
    document.getElementById('year').value = book.year || '';
    document.getElementById('publisher').value = book.publisher || '';
    document.getElementById('description').value = book.description || '';
    document.getElementById('condizione').value = book.condizione;
    document.getElementById('lingua').value = book.lingua || 'it';
    document.getElementById('disponibile_prestito').checked = !!book.disponibile_prestito;
    document.getElementById('disponibile_consultazione').checked = !!book.disponibile_consultazione;
    if (book.thumb_path) {
        const img = document.getElementById('cover-preview');
        img.src = book.thumb_path;
        img.style.display = 'block';
    }
    await caricaCategorie(book.categories.map(c => c.id));
}

document.addEventListener('DOMContentLoaded', async () => {
    const user = await requireLogin();
    if (!user) return;

    if (editId) {
        await loadForEdit(editId);
    } else {
        await caricaCategorie();
    }

    document.getElementById('book-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const errorBox = document.getElementById('form-error');
        const successBox = document.getElementById('form-success');
        errorBox.hidden = true; successBox.hidden = true;

        const formData = new FormData();
        formData.set('title', document.getElementById('title').value.trim());
        formData.set('author', document.getElementById('author').value.trim());
        formData.set('year', document.getElementById('year').value || '');
        formData.set('publisher', document.getElementById('publisher').value.trim());
        formData.set('description', document.getElementById('description').value.trim());
        formData.set('condizione', document.getElementById('condizione').value);
        formData.set('lingua', document.getElementById('lingua').value);
        formData.set('disponibile_prestito', document.getElementById('disponibile_prestito').checked ? '1' : '0');
        formData.set('disponibile_consultazione', document.getElementById('disponibile_consultazione').checked ? '1' : '0');
        formData.set('category_ids', JSON.stringify(catSelezionate()));
        const coverFile = document.getElementById('cover').files[0];
        if (coverFile) formData.set('cover', coverFile);

        try {
            if (editId) {
                await api.putForm(`/api/books/${editId}`, formData);
                successBox.textContent = 'Libro aggiornato con successo.';
            } else {
                const { book } = await api.postForm('/api/books', formData);
                window.location.href = `/libro.html?id=${book.id}&pubblicato=1`;
                return;
            }
            successBox.hidden = false;
        } catch (err) {
            errorBox.textContent = err.message;
            errorBox.hidden = false;
        }
    });
});
