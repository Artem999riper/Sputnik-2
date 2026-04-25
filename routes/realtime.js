// ═══════════════════════════════════════════════════════════
// realtime.js — SSE broadcast + trash bin для undo
//   • /api/events — Server-Sent Events для push-обновлений
//   • broadcast() — отправка события всем подключённым клиентам
//   • trashAdd / trashRestore — буфер удалённых записей (TTL 60 с)
// ═══════════════════════════════════════════════════════════
const { v4: uuid } = require('uuid');
const { run, get, all } = require('../database');

const sseClients = new Set();
const trashBin   = []; // {id, table, row, deletedAt, extras}
const TRASH_TTL  = 60_000; // 60 секунд на отмену

function broadcast(event) {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of [...sseClients]) {
    try { client.write(payload); }
    catch (e) { sseClients.delete(client); }
  }
}

function attachSse(app) {
  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders && res.flushHeaders();
    res.write(`data: ${JSON.stringify({ type: 'connected', t: Date.now() })}\n\n`);
    sseClients.add(res);
    const ping = setInterval(() => {
      try { res.write(':ping\n\n'); } catch (e) {}
    }, 25_000);
    req.on('close', () => { clearInterval(ping); sseClients.delete(res); });
  });

  // Middleware: после успешного мутирующего запроса транслируем событие
  app.use((req, res, next) => {
    if (req.method === 'GET' || req.method === 'OPTIONS' || !req.url.startsWith('/api/')) return next();
    if (req.url.startsWith('/api/events')) return next();
    res.on('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 400) {
        broadcast({ type: 'change', method: req.method, url: req.url, t: Date.now() });
      }
    });
    next();
  });
}

function trashCleanup() {
  const now = Date.now();
  for (let i = trashBin.length - 1; i >= 0; i--) {
    if (now - trashBin[i].deletedAt > TRASH_TTL) trashBin.splice(i, 1);
  }
}

function trashAdd(table, row, extras) {
  trashCleanup();
  const id = uuid();
  trashBin.push({ id, table, row: { ...row }, deletedAt: Date.now(), extras: extras || null });
  return id;
}

function trashRestore(db, trashId) {
  trashCleanup();
  const idx = trashBin.findIndex(t => t.id === trashId);
  if (idx < 0) return { ok: false, reason: 'expired' };
  const item = trashBin[idx];
  trashBin.splice(idx, 1);

  // Универсальная вставка по именам колонок строки
  const cols = Object.keys(item.row).filter(c => item.row[c] !== undefined);
  const placeholders = cols.map(() => '?').join(',');
  const values = cols.map(c => item.row[c]);
  try {
    run(db, `INSERT INTO ${item.table}(${cols.join(',')}) VALUES(${placeholders})`, values);
  } catch (e) {
    return { ok: false, reason: e.message };
  }

  // Восстановить связанные дочерние записи (если были)
  if (item.extras && Array.isArray(item.extras.children)) {
    for (const child of item.extras.children) {
      const ccols = Object.keys(child.row).filter(c => child.row[c] !== undefined);
      const cph = ccols.map(() => '?').join(',');
      const cvals = ccols.map(c => child.row[c]);
      try { run(db, `INSERT INTO ${child.table}(${ccols.join(',')}) VALUES(${cph})`, cvals); } catch (e) {}
    }
  }

  return { ok: true, table: item.table, id: item.row.id };
}

// Удалить строку (и опционально дочерние записи) с сохранением в корзину
// children: [{ table, fkColumn }] — массив дочерних таблиц для каскадного удаления
// Возвращает trashId или null если строка не найдена.
function trashAndDelete(db, table, id, opts) {
  const row = get(db, `SELECT * FROM ${table} WHERE id=?`, [id]);
  if (!row) return null;
  let extras = null;
  if (opts && Array.isArray(opts.children) && opts.children.length) {
    extras = { children: [] };
    for (const child of opts.children) {
      const rows = all(db, `SELECT * FROM ${child.table} WHERE ${child.fkColumn}=?`, [id]);
      for (const cr of rows) extras.children.push({ table: child.table, row: cr });
      try { run(db, `DELETE FROM ${child.table} WHERE ${child.fkColumn}=?`, [id]); } catch (e) {}
    }
  }
  run(db, `DELETE FROM ${table} WHERE id=?`, [id]);
  return trashAdd(table, row, extras);
}

function attachUndo(app, getDb) {
  app.post('/api/restore/:trashId', (req, res) => {
    const result = trashRestore(getDb(), req.params.trashId);
    if (!result.ok) return res.status(410).json({ error: 'Срок отмены истёк или ошибка', reason: result.reason });
    res.json(result);
  });
}

module.exports = { attachSse, attachUndo, broadcast, trashAdd, trashRestore, trashAndDelete };
