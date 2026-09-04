// Utility geospaziali per il prototipo.
//
// SQLite non supporta funzioni trigonometriche/geometriche native in modo
// portabile, quindi il calcolo della distanza (formula di Haversine) viene
// registrato come funzione custom sull'istanza del DB e usato direttamente
// nelle query SQL. Per evitare di scansionare l'intera tabella, ogni ricerca
// spaziale applica PRIMA un filtro a "bounding box" (min/max lat/lon) che
// sfrutta gli indici su latitude/longitude, e SOLO DOPO calcola la distanza
// esatta con Haversine sul sottoinsieme filtrato.

const EARTH_RADIUS_KM = 6371;

function toRad(deg) {
    return (deg * Math.PI) / 180;
}

/** Distanza in km tra due punti (lat/lon in gradi decimali). */
function haversineKm(lat1, lon1, lat2, lon2) {
    if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return EARTH_RADIUS_KM * c;
}

/**
 * Calcola un bounding box approssimato (in gradi) attorno a un punto,
 * dato un raggio in km. Usato come pre-filtro SQL veloce (indice-friendly)
 * prima del calcolo esatto con Haversine.
 */
function boundingBox(lat, lon, radiusKm) {
    const latDelta = radiusKm / 111.32; // ~km per grado di latitudine
    const lonDelta = radiusKm / (111.32 * Math.cos(toRad(lat)) || 1);
    return {
        minLat: lat - latDelta,
        maxLat: lat + latDelta,
        minLon: lon - lonDelta,
        maxLon: lon + lonDelta,
    };
}

/** Registra la funzione HAVERSINE_KM(lat1,lon1,lat2,lon2) sull'istanza better-sqlite3. */
function registerHaversine(db) {
    db.function('HAVERSINE_KM', (lat1, lon1, lat2, lon2) => haversineKm(lat1, lon1, lat2, lon2));
}

/**
 * Applica un "jitter" casuale alle coordinate per offuscare la posizione
 * esatta di un utente quando location_precision è 'quartiere' o 'citta'.
 * Non è crittograficamente robusto: è una misura di usabilità/privacy
 * per un prototipo, non una garanzia di anonimato forte (vedi relazione).
 */
function fuzzCoordinates(lat, lon, precision) {
    if (precision === 'esatta') return { latitude: lat, longitude: lon };
    const radiusKm = precision === 'citta' ? 3 : 0.6; // ~3km città, ~600m quartiere
    const angle = Math.random() * 2 * Math.PI;
    const r = Math.random() * radiusKm;
    const dLat = (r / 111.32) * Math.cos(angle);
    const dLon = (r / (111.32 * Math.cos(toRad(lat)) || 1)) * Math.sin(angle);
    return { latitude: lat + dLat, longitude: lon + dLon };
}

module.exports = { haversineKm, boundingBox, registerHaversine, fuzzCoordinates };
