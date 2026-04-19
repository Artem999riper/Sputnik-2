const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');
const { v4: uuid } = require('uuid');
const { getDb, run } = require('./database');

// ── OPTIONAL MODULES ──────────────────────────────────────────────────────────
let demProcessor = null;
try { demProcessor = require('./dem-processor'); }
catch(e) { console.warn('dem-processor не загружен:', e.message); }

let upload = null;
try {
  const multer = require('multer');
  const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  upload = multer({
    storage: multer.diskStorage({
      destination: UPLOADS_DIR,
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, 'photo_' + Date.now() + '_' + Math.random().toString(36).slice(2) + ext);
      },
    }),
    limits: { fileSize: 15 * 1024 * 1024 },
  });
} catch(e) { console.warn('multer не установлен — загрузка фото отключена.'); }

// ── EXPRESS SETUP ──────────────────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.json({ limit: '30mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── SHARED STATE ───────────────────────────────────────────────────────────────
let db;
const getDbInstance = () => db;

const L = (sid, bid, act, det, usr) => {
  try {
    run(db, 'INSERT INTO activity_log(id,site_id,base_id,action,details,user_name)VALUES(?,?,?,?,?,?)',
      [uuid(), sid || null, bid || null, act, det || '', usr || 'Система']);
  } catch(e) {}
};

// ── BACKUP ─────────────────────────────────────────────────────────────────────
const BACKUP_DIR = path.join(__dirname, 'backups');
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR);

function doBackup(destPath) {
  const DB_PATH  = path.join(__dirname, 'survey.db');
  const WAL_PATH = DB_PATH + '-wal';
  const SHM_PATH = DB_PATH + '-shm';
  try { run(db, 'PRAGMA wal_checkpoint(TRUNCATE)'); } catch(e) {}
  fs.copyFileSync(DB_PATH, destPath);
  const walSize = fs.existsSync(WAL_PATH) ? fs.statSync(WAL_PATH).size : 0;
  if (walSize > 32) {
    try { fs.copyFileSync(WAL_PATH, destPath + '-wal'); } catch(e) {}
    try { fs.copyFileSync(SHM_PATH, destPath + '-shm'); } catch(e) {}
  }
  return fs.statSync(destPath).size;
}

// ── ROUTES ─────────────────────────────────────────────────────────────────────
const routeBases = require('./routes/bases');
const routeSites = require('./routes/sites');
const routePgk   = require('./routes/pgk');
const routeCargo = require('./routes/cargo');
const routeTasks = require('./routes/tasks');
const routeMisc  = require('./routes/misc');

// ── START ──────────────────────────────────────────────────────────────────────
getDb().then(database => {
  db = database;

  routeBases(app, getDbInstance, L);
  routeSites(app, getDbInstance, L);
  routePgk  (app, getDbInstance, L);
  routeCargo(app, getDbInstance, L);
  routeTasks(app, getDbInstance, L);
  routeMisc (app, getDbInstance, L, { upload, demProcessor, BACKUP_DIR, doBackup });

  app.listen(PORT, () => {
    console.log(`\n  ✅  ПурГеоКом запущен: http://localhost:${PORT}\n`);
    try { require('child_process').exec(`start http://localhost:${PORT}`); } catch(e) {}
  });

  // Auto-backup daily on startup
  setTimeout(() => {
    try {
      const DB_PATH = path.join(__dirname, 'survey.db');
      if (!fs.existsSync(DB_PATH)) return;
      const today = new Date().toISOString().slice(0, 10);
      const fname = `backup_auto_${today}.db`;
      const dest  = path.join(BACKUP_DIR, fname);
      if (!fs.existsSync(dest)) {
        const size = doBackup(dest);
        console.log(`  📦  Автобэкап: ${fname} (${(size / 1024).toFixed(0)} КБ)`);
        const autoFiles = fs.readdirSync(BACKUP_DIR)
          .filter(f => f.startsWith('backup_auto_') && !f.endsWith('-wal') && !f.endsWith('-shm'))
          .sort();
        while (autoFiles.length > 30) {
          const old = autoFiles.shift();
          fs.unlinkSync(path.join(BACKUP_DIR, old));
          try { fs.unlinkSync(path.join(BACKUP_DIR, old + '-wal')); } catch(e) {}
          try { fs.unlinkSync(path.join(BACKUP_DIR, old + '-shm')); } catch(e) {}
        }
      }
    } catch(e) { console.warn('Auto-backup failed:', e.message); }
  }, 3000);

}).catch(err => console.error('Ошибка запуска:', err));
