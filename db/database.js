// TrovaLibro - Biblioteca Diffusa - Guido Cauli <guido.cauli@gmail.com>
const path = require('path'); 
const fs = require('fs');
 const Database = require('better-sqlite3');  
const { aggiungiHaversine } = require('../geoloc/geo');

const DB_PATH = path.join(__dirname, 'biblioteca.db'); // Se il db non esiste ancora lo crea applicando lo schema

const isNew = !fs.existsSync(DB_PATH);  
const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');
 aggiungiHaversine(db); 

if (isNew) {
     const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
      db.exec(schema);  
     console.log('[db] Database creato in', DB_PATH);
}
module.exports = db; 


