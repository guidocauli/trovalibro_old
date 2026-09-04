# Biblioteca Diffusa

Prototipo di piattaforma web di geolocalizzazione culturale per la condivisione di
patrimoni librari privati (collezioni, biblioteche domestiche, raccolte tematiche).
Ambito scelto per il prototipo: **quartieri della città di Bari** (dati di test
distribuiti tra Bari centro, Murat, Libertà, Carrassi e il vicino comune di Bitonto).

Per l'analisi completa del contesto, i requisiti e le scelte architetturali, vedi
`docs/relazione-tecnica.docx`.

## Funzionalità principali

- Registrazione e profilo utente, con consenso esplicito e granulare alla
  condivisione della posizione (precisione "quartiere" o "città", con
  offuscamento casuale delle coordinate — non viene mai salvata la posizione esatta).
- Pubblicazione di libri con metadati (titolo, autore, anno, editore, categorie,
  condizione, lingua, disponibilità) e upload di copertina con generazione
  automatica di miniatura.
- Ricerca testuale (titolo/autore/descrizione) combinabile con ricerca spaziale
  per raggio, e visualizzazione dei risultati su mappa (Leaflet + OpenStreetMap).
- Ricerca di utenti limitrofi che condividono la posizione.
- Pagina di dettaglio libro con richiesta di prestito/consultazione (simulata,
  senza gestione logistica reale) e suggerimenti/commenti della community.
- Dashboard statistiche personali (visualizzazioni, richieste ricevute) e
  dashboard amministrativa con metriche aggregate della piattaforma.

## Stack tecnologico

- **Backend**: Node.js, Express, SQLite (`better-sqlite3`), sessioni server-side
  (`express-session` + `connect-sqlite3`), autenticazione con `bcryptjs`.
- **Immagini**: upload con `multer`, ridimensionamento/miniature con `sharp`.
- **Geospaziale**: formula di Haversine calcolata in una funzione SQL custom
  registrata su SQLite, con pre-filtro a bounding box per usare gli indici.
- **Frontend**: HTML/CSS/JavaScript vanilla (nessun framework, per restare
  leggero e facilmente ispezionabile a scopo didattico), mappa con Leaflet.

## Requisiti

- Node.js 18 o superiore

## Avvio rapido

```bash
npm install
npm run seed      # crea db/biblioteca.db, applica lo schema e carica dati di test
npm start         # avvia il server su http://localhost:3000
```

Se si preferisce un database vuoto (senza dati di esempio), è sufficiente
eseguire `npm start` direttamente: il database e lo schema vengono creati
automaticamente al primo avvio.

### Credenziali demo (create da `npm run seed`)

| Utente         | Ruolo   | Password      |
|----------------|---------|---------------|
| `admin`        | admin   | `Prova1234!`  |
| `giulia_r`     | utente  | `Prova1234!`  |
| `marco_libri`  | utente  | `Prova1234!`  |
| `elena_p`      | utente  | `Prova1234!`  |
| `nicola_fq`    | utente  | `Prova1234!`  |
| `anna_riservata` | utente (non geolocalizzata) | `Prova1234!` |

## Struttura del repository

```
biblioteca-diffusa/
├── db/
│   ├── schema.sql        # schema SQL commentato (campi geospaziali inclusi)
│   ├── database.js       # connessione condivisa + inizializzazione lazy
│   ├── init.js            # inizializzazione esplicita dello schema
│   └── seed.js            # popolamento con dati di test
├── middleware/
│   ├── auth.js             # middleware di autenticazione/autorizzazione
│   └── upload.js           # gestione upload + generazione miniature
├── routes/
│   ├── auth.js              # registrazione, login, logout, sessione
│   ├── users.js             # profilo, consenso posizione, utenti limitrofi
│   ├── books.js              # CRUD libri, ricerca, prestiti, suggerimenti
│   └── stats.js               # statistiche personali e dashboard admin
├── utils/geo.js                # Haversine, bounding box, offuscamento coordinate
├── public/                      # frontend statico (HTML/CSS/JS commentati)
│   ├── css/style.css
│   ├── js/
│   └── *.html
├── uploads/covers/, uploads/thumbs/   # immagini caricate (escluse da Git)
├── docs/relazione-tecnica.docx         # rapporto tecnico completo
└── server.js
```

## Note sul prototipo

- La ricerca spaziale usa un pre-filtro a bounding box (indicizzato) seguito dal
  calcolo esatto della distanza con Haversine: è portabile su PostgreSQL/PostGIS
  sostituendo le colonne lat/lon con una colonna `GEOGRAPHY(Point,4326)` e le
  query Haversine con `ST_DWithin` (vedi relazione tecnica, sezione architettura).
- Le richieste di prestito sono **simulate**: non generano notifiche reali né
  gestiscono la logistica della consegna, in linea con la traccia del progetto.
- Le password demo sono intenzionalmente semplici e comuni a tutti gli utenti di
  test: da non riutilizzare in un contesto reale.
