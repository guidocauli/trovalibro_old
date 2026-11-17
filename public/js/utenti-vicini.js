// TrovaLibro - Biblioteca Diffusa - Guido Cauli <guido.cauli@gmail.com>

let myPosition = null; 


function renderUsers(users) {
    const list = document.getElementById('users-list');
    const count = document.getElementById('results-count');
    count.textContent = users.length === 0
       ? 'Nessun utente trovato in questo raggio.'
       : `${users.length} utent${users.length === 1 ? 'e trovato' : 'i trovati'}.`;


      if (users.length === 0) {
         list.innerHTML = `<div class="empty-state">Nessun altro utente ha condiviso la posizione in questa zona. Prova ad allargare il raggio.</div>`;
      return;
       }

    list.innerHTML = users.map(u => {
        const initials = (u.display_name || '?').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();
        return ` 
        <div class="book-card" style="text-decoration:none">
              <div class="book-card__body" style="padding:1.25rem">
              <div class="owner-row" style="margin-bottom:0.6rem">
                    <div class="avatar-circle" aria-hidden="true">${escapeHtml(initials)}</div>
                    <div>
                     <strong>${escapeHtml(u.display_name)}</strong>
                     <p class="hint" style="margin:0">${escapeHtml(u.location_label || 'Zona non specificata')}</p>
                    </div>
                </div>
                ${u.bio ? `<p class="hint" style="margin:0 0 0.6rem">${escapeHtml(u.bio)}</p>` : ''}
                <div class="book-card__meta">
                    <span class="badge badge-brass">${u.distance_km} km</span>
                    <a class="btn btn-disab btn-sm" href="/utente.html?id=${u.id}">Vedi profilo</a>
               </div></div></div>`;}).join('');
}

async function search() {
    if (!myPosition) return;
    const radius = document.getElementById('radius').value;
    document.getElementById('results-count').textContent = 'Ricerca in corso…';
     try {
        const { users } = await api.get(`/api/users/search/nearby?lat=${myPosition.lat}&lon=${myPosition.lon}&radius_km=${radius}`); 
        renderUsers(users);
     } catch (err) {
        document.getElementById('results-count').textContent = `Errore: ${err.message}`;  
     }
}



function locate() {
    const status = document.getElementById('geo-status'); 
    if (!navigator.geolocation) { status.textContent = 'Geolocalizzazione non supportata.'; return; }
    status.textContent = 'Richiesta posizione al browser…';
    navigator.geolocation.getCurrentPosition(
       (pos) => {
              myPosition = { lat: pos.coords.latitude, lon: pos.coords.longitude }; 
              status.textContent = 'Posizione acquisita.';
              search();
           },
        () => { status.textContent = 'Posizione non disponibile o consenso negato: impossibile mostrare utenti vicini.'; } 
   );
}



document.addEventListener('DOMContentLoaded', async () => { 
    const { user } = await api.get('/api/auth/me');
     if (!user) {
         document.getElementById('login-required').hidden = false;
     return;
      }
    document.getElementById('nearby-app').hidden = false;  
    document.getElementById('locate-btn').addEventListener('click', locate);
    document.getElementById('radius').addEventListener('change', search);
});


