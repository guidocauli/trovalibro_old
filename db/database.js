const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { registerHaversine } = require('../utils/geo');

const DB_PATH = path.join(__dirname, 'biblioteca.db');

// Se il DB non esiste ancora, lo crea applicando lo schema al volo
// (comodo per un prototipo: `npm start` funziona anche a freddo).
const isNew = !fs.existsSync(DB_PATH);
const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');
registerHaversine(db);

if (isNew) {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    db.exec(schema);
    console.log('[db] Database creato ed inizializzato in', DB_PATH);
}

module.exports = db;
