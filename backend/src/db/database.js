const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Veritabanı dosyasının yolu
const dbPath = path.join(__dirname, '../../database.sqlite');

// Veritabanı klasörü yoksa oluştur
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Veritabanı bağlantısı
const db = new Database(dbPath, { verbose: null }); // development'ta console.log eklenebilir

// Tablo yapıları
const initDb = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      level INTEGER DEFAULT 1,
      xp INTEGER DEFAULT 0,
      coins INTEGER DEFAULT 0,
      win_streak INTEGER DEFAULT 0,
      owned_items TEXT DEFAULT '[]', -- JSON string
      equipped_items TEXT DEFAULT '{}', -- JSON string
      role TEXT DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
};

// Veritabanını başlat
initDb();

module.exports = db;
