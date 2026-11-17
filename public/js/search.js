// TrovaLibro - Biblioteca Diffusa - Guido Cauli <guido.cauli@gmail.com>
// Pagina di ricerca: con filtro testuale, categoria, condizione, ricerca spaziale 
// (raggio dalla posizione dell'utente, con previo consenso GDPR tramite l'API geo del browser).


let map, markersLayer; 
let userPosition = null; 
function initMap() {
    map = L.map('map', { scrollWheelZoom: false }).setView([41.1171, 16.8719], 12); //  Bari centro in default  

     L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { 
          attribution: '&copy; collaboratori di OpenStreetMap', 
          maxZoom: 18, 
       }).addTo(map);
     markersLayer = L.layerGroup().addTo(map);
}

function renderMarkers(books) { 
    markersLayer.clearLayers(); 
    const bounds = [];
    books.forEach(b => {
      if (b.latitude == null || b.longitude == null) return; 
       const marker = L.marker([b.latitude, b.longitude]).addTo(markersLayer);
       marker.bindPopup(`<strong>${escapeHtml(b.title)}</strong><br>${escapeHtml(b.author)}<br><a href="/libro.html?id=${b.id}">Vedi la scheda</a>`);  
        bounds.push([b.latitude, b.longitude]);  
       });
     if (userPosition) bounds.push([userPosition.lat, userPosition.lon]);
     if (bounds.length) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
  }

function renderBooks(books) {
    const list = document.getElementById('book-list');
    const countEl = document.getElementById('results-count');
    countEl.textContent = books.length === 0
        ? 'Nessun libro trovato con questi filtri.'
        : `${books.length} libr${books.length === 1 ? 'o trovato' : 'i trovati'}.`;


    if (books.length === 0) {
      list.innerHTML = `<div class="empty-state">Nessun risultato. Prova ad allargare il raggio di ricerca o a cambiare le parole chiave.</div>`; 
      return;
     }

    list.innerHTML = books.map(b => `
        <a class="book-card" href="/libro.html?id=${b.id}"> 
            <div class="book-card__cover" style="${b.thumb_path ? `background-image:url('${b.thumb_path}')` : ''}">
                ${b.thumb_path ? '' : `<span class="placeholder">${escapeHtml(b.title)}</span>`}</div>
            <div class="book-card__body">
                <div class="book-card__title">${escapeHtml(b.title)}</div>
                <div class="book-card__author">${escapeHtml(b.author)}${b.year ? ' · ' + b.year : ''}</div> 
                <div class="book-card__meta"><span class="badge">${escapeHtml(b.condizione)}</span>
                    ${b.distance_km != null ? `<span class="badge badge-brass">${b.distance_km} km</span>` : ''}
                </div></div></a>`).join('');}



async function loadCategories() {  
    try {
        const { categories } = await api.get('/api/books/categories');  
        const select = document.getElementById('category'); 
        categories.forEach(c => { 
           const opt = document.createElement('option'); 
           opt.value = c.id;  
           opt.textContent = c.name;
           select.appendChild(opt);});
    } catch {         /* non è uno stub: la ricerca funziona lo stesso anche senza categorie caricate */ }
}


async function runSearch() {
   const params = new URLSearchParams();  
   const q = document.getElementById('q').value.trim();
   const category = document.getElementById('category').value; 
   const condizione = document.getElementById('condizione').value;
   const radius = document.getElementById('radius').value;


   if (q) params.set('q', q);
   if (category) params.set('category_id', category);
   if (condizione) params.set('condizione', condizione);
   if (userPosition) {
     params.set('lat', userPosition.lat);  
     params.set('lon', userPosition.lon); 
     if (radius)  params.set('radius_km', radius);  
 }

    document.getElementById('results-count').textContent = 'Ricerca in corso…'; 
    try {
        const { books } = await api.get(`/api/books/search?${params.toString()}`); 
        renderBooks(books);
        renderMarkers(books);
    } catch (err) {
        document.getElementById('results-count').textContent = `Errore nella ricerca: ${err.message}`; 
    } 
}



function locateUser() {
    const status = document.getElementById('geo-status');
    if (!navigator.geolocation) {
       status.textContent = 'Geo localizzazione non supportata da questo browser.';  
       return;
     }
     document.getElementById('geo-consent-banner').hidden = false;  
     status.textContent = 'Richiesta posizione al browser…'; 
     navigator.geolocation.getCurrentPosition( 
        (pos) => {
            userPosition = { lat: pos.coords.latitude, lon: pos.coords.longitude };
            status.textContent = 'Posizione acquisita: risultati ordinati per distanza.' ;  
            L.marker([userPosition.lat, userPosition.lon], {
                icon: L.divIcon({ className: 'user-marker', html: '📍', iconSize: [24, 24] }), // 📍 = Pin unicode
            }).addTo(markersLayer).bindPopup('Tu sei qui (non preciso)'); 
            runSearch();
        },
        () => { status.textContent = 'Posizione non disponibile o consenso negato: la ricerca rimane senza filtro distanza.'; },
        { enableHighAccuracy: false, timeout: 8000 } 
      );
}



document.addEventListener('DOMContentLoaded', () => {
   initMap();
   loadCategories();
   runSearch();
   document.getElementById('search-form').addEventListener('submit', (e) => { e.preventDefault(); runSearch(); });
   document.getElementById('category').addEventListener('change', runSearch);
   document.getElementById('condizione').addEventListener('change', runSearch);
   document.getElementById('radius').addEventListener('change', runSearch);
   document.getElementById('locate-btn').addEventListener('click', locateUser);
});


