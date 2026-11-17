// TrovaLibro - Biblioteca Diffusa - Guido Cauli <guido.cauli@gmail.com>
// pagina amministrzione

const statusLabel = { in_attesa: 'In attesa', accettata: 'Accettata', rifiutata: 'Rifiutata', completata: 'Completata', annullata: 'Annullata' };

function renderBars(containerId, data, labelKey, valueKey) {
    const el = document.getElementById(containerId); 
    if (!data || data.length === 0) { el.innerHTML = `<p class="hint">Ancora nessun dato.</p>`; return; }
    const max = Math.max(...data.map(d => d[valueKey]), 1); 
    el.innerHTML = data.map(d => { 
       const pct = Math.max(4, Math.round((d[valueKey] / max) * 100)); 
       return `<div class="bar" data-empty="${d[valueKey] === 0}" style="height:${pct}%" title="${escapeHtml(String(d[labelKey]))}: ${d[valueKey]}"></div>`;}).join('');
}

async function init() {
    const { user } = await api.get('/api/auth/me');
    if (!user) { window.location.href = '/login.html?redirect=/admin.html'; return; }
    if (user.role !== 'admin') {
        document.getElementById('not-admin').hidden = false;
        return;
    }


    let data;  
   try {data = await api.get('/api/stats/admin/dashboard');} catch (err) {
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
        <div class="stat-card"><div class="value">${data.totals.users_with_geo}</div><div class="label">Utenti localizzati</div></div>
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


    await loadUsers(user.id);
}

async function loadUsers(adminId) {
    const { users } = await api.get('/api/admin/users');
    const tbody = document.getElementById('users-table-body');
    tbody.innerHTML = users.map(u => `
        <tr><td>${escapeHtml(u.display_name)} <span class="hint">(${escapeHtml(u.username)})</span></td>
            <td>${escapeHtml(u.email)}</td>
            <td>${u.role === 'admin' ? '<span class="badge">Admin</span>' : 'Utente'}</td>
            <td>${u.book_count}</td>
            <td>${new Date(u.created_at).toLocaleDateString('it-IT')}</td>
            <td>${u.id === adminId ? '<span class="hint">Il tuo account</span>' : `
                <button class="btn btn-disab btn-sm" data-reset="${u.id}" data-name="${escapeHtml(u.display_name)}" type="button">Reimposta password</button>
                <button class="btn btn-disab btn-sm" data-delete="${u.id}" data-name="${escapeHtml(u.display_name)}" type="button" style="color:var(--danger)">Elimina</button>`}
            </td></tr>`).join(''); 


    const errorBox = document.getElementById('users-error');
    const successBox = document.getElementById('users-success');


    tbody.querySelectorAll('[data-reset]').forEach(btn => {
        btn.addEventListener('click', async () => {
            errorBox.hidden = true; successBox.hidden = true;
            const newPassword = prompt(`Nuova password per ${btn.dataset.name} (almeno 8 caratteri):`);
             if (!newPassword) return;
             try  {
                 await api.put(`/api/admin/users/${btn.dataset.reset}/reset-password`, { new_password: newPassword });
                 successBox.textContent = `Password di ${btn.dataset.name} aggiornata.`;
                 successBox.hidden = false; 
             } catch (err) {
                 errorBox.textContent = err.message;
                 errorBox.hidden = false; 
             }
        });
    });



    tbody.querySelectorAll('[data-delete]').forEach(btn => {  
        btn.addEventListener('click', async () => {
            errorBox.hidden = true; successBox.hidden = true;
             if (!confirm(`Eliminare definitivamente l'account di ${btn.dataset.name} e tutti i suoi elementi? L'operazione non è reversibile.`)) return; 
             try {
                await api.del(`/api/admin/users/${btn.dataset.delete}`);
                successBox.textContent = `Account di ${btn.dataset.name} eliminato.`;
                successBox.hidden = false;
                loadUsers(adminId);
             } catch (err) {
                 errorBox.textContent = err.message;
                 errorBox.hidden = false;
              }
         });
    });
}

document.addEventListener('DOMContentLoaded', init);


