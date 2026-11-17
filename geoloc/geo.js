// TrovaLibro - Biblioteca Diffusa - Guido Cauli <guido.cauli@gmail.com>
// Utility geospaziali per il test.

/* calcolo della distanza con formula di Haversine: funzione customizzata sull'istanza del DB usata direttamente nelle query SQL. 
 Per evitare di scansionare tutta la tabella, ogni ricerca applica un filtro (min/max lat/lon) che sfrutta gli 
indici su latitude/longitude, e dopo calcola la distanza esatta con la fnzione sul sottoinsieme filtrato. */

const RAGGIO_TERRA = 6371;

 function toRad(deg) { return (deg * Math.PI) / 180; } 


/** Distanza in km tra due punti (lat/lon in gradi decimali). */

function haversineKm(lat1, lon1, lat2, lon2) {
     if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1); 
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return RAGGIO_TERRA * c;
}



/* Calcola un intorno approssimato (in gradi) intorno a un punto,dato un  raggio in km.Viene utilizzato come pre-filtro SQL per accelerare 
la ricerca prima del calcolo esatto con  la formula.  */

function boundingBox(lat, lon, radiusKm) {
    const latDelta = radiusKm / 111.32; // ~km per ogni deg latitudine
    const lonDelta = radiusKm / (111.32 * Math.cos(toRad(lat)) || 1);  
    return {minLat: lat-latDelta, maxLat: lat+latDelta, minLon: lon-lonDelta, maxLon: lon+lonDelta,}
;}

/*  Registrazione della funzione HAVERSINE_KM(lat1,lon1,lat2,lon2) sull istanza better-sqlite */

function aggiungiHaversine(db) { 
    db.function('HAVERSINE_KM', (lat1, lon1, lat2, lon2) => haversineKm(lat1, lon1, lat2, lon2));  
}



/* Applica un jittering (casualizzazione) alle coordinate per offuscare la posizione esatta di un utente quando il param. precision è "quartiere" o "citta" (misura di privacy per un prototipo, non forte anonimizzazione (vedi relazione).*/


function sfocaPosizione(lat, lon, precision) {
    if (precision === 'esatta') return { latitude: lat, longitude: lon };
    const radiusKm = precision === 'citta' ? 3 : 0.6; // ~3km per una città, ~600m per quartiere
    const angle = Math.random() * 2 * Math.PI;
    const r = Math.random() * radiusKm;    
    const dLat = (r / 111.32) * Math.cos(angle);
    const dLon = (r / (111.32 * Math.cos(toRad(lat)) || 1)) * Math.sin(angle); 
    return { latitude: lat + dLat, longitude: lon + dLon };
}



module.exports = { haversineKm, boundingBox, aggiungiHaversine, sfocaPosizione }; 



