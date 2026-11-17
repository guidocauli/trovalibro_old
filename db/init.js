// TrovaLibro - Biblioteca Diffusa - Guido Cauli <guido.cauli@gmail.com>
// Init del db eseguendo schema.sql
const fs = require('fs');
const path = require('path'); 
const Database  =  require('better-sqlite3'); 
const DB_PATH = path.join(__dirname,'biblioteca.db');

const db =  new Database(DB_PATH); 
const  schema = fs.readFileSync(path.join(__dirname,'schema.sql'),'utf8');
db.exec(schema);

  console.log('Schema applicato correttamente: ',DB_PATH); 

db.close();


