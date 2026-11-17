// TrovaLibro - Biblioteca Diffusa - Guido Cauli <guido.cauli@gmail.com>
// Upload delle copertine libro: validaizone, ridimensionamento e
// generazione di una miniatura, usando Multer (parsing multipart) + Sharpen lato server


const path = require('path'); 
const fs = require('fs'); 
const multer = require('multer');
const sharp = require('sharp'); 
const crypto = require('crypto'); 
const COVERS_DIR = path.join(__dirname, 'uploads', 'covers');  
const THUMBS_DIR = path.join(__dirname, 'uploads', 'thumbs'); 
const MAX_BYTES = 8 * 1024 * 1024;   // Max upload = 8 MB 
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp']; // Sono permesse solo JPG,PNG e WebP


// File in memoria: la scrittura su disco avviene solo dopo il resample  con sharp;
// non salva il file originale non convalidato. 
const storage = multer.memoryStorage();
function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME.includes(file.mimetype)) {return cb(new Error('Formato immagine non supportato (usa JPEG, PNG o WebP).')); } 
  cb(null, true);
}

const upload = multer({
    storage,
    limits: { fileSize: MAX_BYTES },
    fileFilter,
 });



/* Elabora il buffer immagine caricato, laddove:  
- copertina:  ridimensionata (max 800px lato lungo), codificata in JPG a qualita' 82  
- miniatura:  200x280 crop per anteprime

Come valore di ritorno esporta i path relativi (per salvataggio dentro il DB) delle due immagini generate. */




async function salvaCopertina(buffer) {
    const id = crypto.randomBytes(8).toString('hex');
    const coverFilename = `${id}.jpg`; 
    const thumbFilename = `${id}_thumb.jpg`; 

    await sharp(buffer)
        .rotate()                           // applica l'orientamento come da EXIF, poi lo elimina
        .resize({ width: 800, height: 800, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toFile(path.join(COVERS_DIR, coverFilename));


    await sharp(buffer)
        .rotate()
        .resize({ width: 200, height: 280, fit: 'cover', position: 'attention' })   
        .jpeg({ quality: 75 })
        .toFile(path.join(THUMBS_DIR, thumbFilename));

    return {
       coverPath: `/uploads/covers/${coverFilename}`,
       thumbPath: `/uploads/thumbs/${thumbFilename}`, 
    };
}

function eliminaImmagine(relativePath) {
    if (!relativePath) return;
    const abs = path.join(__dirname, relativePath.replace(/^\//, '')); 
    fs.unlink(abs, () => {});              // ignora errori (se file già eliminato) 
}


module.exports = { upload, salvaCopertina, eliminaImmagine, MAX_BYTES }; 



