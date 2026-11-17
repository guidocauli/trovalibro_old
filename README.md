# TrovaLibro — Biblioteca Diffusa

Versione 1.0  

Prototipo di piattaforma web di geolocalizzazione culturale per la condivisione di patrimoni librari privati (collezioni, biblioteche domestiche, raccolte tematiche). Ambito scelto per il prototipo: **quartieri della città di Bari** (dati di test distribuiti tra Bari centro, Murat, Libertà, Carrassi e il vicino comune di Bitonto).

## Funzionalità principali

- Registrazione e profilo utente, con consenso esplicito e granulare alla condivisione della posizione (precisione "quartiere" o "città", con offuscamento casuale delle coordinate — non viene mai salvata la posizione esatta).

- Pubblicazione di libri con vari metadati (titolo, autore, anno, editore, categorie,condizione, lingua, disponibilità) e upload di copertina con generazione automatica di miniatura.

- Ricerca testuale (titolo/autore/descrizione) combinabile con la ricerca spaziale per raggio, e visualizzazione dei risultati su mappa (Leaflet + OpenStreetMap).

- Ricerca di utenti limitrofi che condividono la posizione (volutamente non precisa, per privacy).

- Pagina di dettaglio di un libro con richiesta di prestito/consultazione e suggerimenti/commenti della community.

- Dashboard statistiche personali (visualizzazioni, richieste ricevute) e dashboard amministrativa con metriche aggregate della piattaforma.

## Stack

- **Back-end**: ambiente Node.js, Express, SQLite (tramite `better-sqlite3`), sessioni server-side (`express-session` + `connect-sqlite3`), autenticazione tramite libreria `bcryptjs`.

- **Immagini**: upload con libreria `multer`, ridimensionamento/miniature tramtie `sharp`.

- **Localizzazione**: formula di Haversine calcolata in una funzione custom su SQLite, con pre-filtro per usare gli indici e alleggerire il carico computazionale.

- **Front-end**: HTML/CSS/JavaScript puri), mappa con libreria Leaflet.

## Requisiti

- Node.js 18 o superiore

## Avvio rapido

```
npm install-scripts approve sqlite3  # necessario per componente sqlite3
npm install
npm run seed    # crea biblioteca.db,applica lo schema e carica i dati di test
npm start       # avvia il server su http://localhost:3000
```

Volendo utilizzare un database vuoto (senza i dati di esempio), è sufficiente eseguire `npm start` direttamente: il database e lo schema vengono creati automaticamente al primo avvio.

## Note sul prototipo

- Le richieste di prestito sono **simulate**: non generano notifiche reali né gestiscono la logistica della consegna, in linea con la traccia del progetto.

- Le password demo sono intenzionalmente semplici e comuni a tutti gli utenti di test: da non riutilizzare in un contesto reale.



