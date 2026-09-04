// Gestione upload copertine libro: validazione, ridimensionamento e
// generazione di una miniatura, usando multer (parsing multipart) + sharp
// (elaborazione immagini lato server).
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp');
const crypto = require('crypto');

const COVERS_DIR = path.join(__dirname, '..', 'uploads', 'covers');
const THUMBS_DIR = path.join(__dirname, '..', 'uploads', 'thumbs');

const MAX_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

// File in memoria: la scrittura su disco avviene DOPO il ridimensionamento
// con sharp, così non salviamo mai il file originale non validato.
const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
    if (!ALLOWED_MIME.includes(file.mimetype)) {
        return cb(new Error('Formato immagine non supportato (usa JPEG, PNG o WebP).'));
    }
    cb(null, true);
}

const upload = multer({
    storage,
    limits: { fileSize: MAX_SIZE_BYTES },
    fileFilter,
});

/**
 * Elabora il buffer immagine caricato:
 * - copertina: ridimensionata (max 800px lato lungo), ri-codificata in JPEG qualità 82
 * - miniatura: 200x280 crop "cover" per griglie/anteprime uniformi
 * Ritorna i path relativi (da salvare in DB) delle due immagini generate.
 */
async function processCoverImage(buffer) {
    const id = crypto.randomBytes(8).toString('hex');
    const coverFilename = `${id}.jpg`;
    const thumbFilename = `${id}_thumb.jpg`;

    await sharp(buffer)
        .rotate() // applica l'orientamento EXIF, poi lo scarta
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

function deleteImageIfExists(relativePath) {
    if (!relativePath) return;
    const abs = path.join(__dirname, '..', relativePath.replace(/^\//, ''));
    fs.unlink(abs, () => {}); // best-effort, ignora errori (file già assente)
}

module.exports = { upload, processCoverImage, deleteImageIfExists, MAX_SIZE_BYTES };
