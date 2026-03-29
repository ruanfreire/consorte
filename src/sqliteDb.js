/**
 * SQLite no browser via sql.js (WASM). Persistência do ficheiro .db em IndexedDB.
 * @see https://sql.js.org/
 */
import initSqlJs from "sql.js";
import sqlWasmUrl from "sql.js/dist/sql-wasm.wasm?url";

const IDB_NAME = "consorte-sqlite-v1";
const IDB_STORE = "file";
const IDB_KEY = "db";

let _initPromise = null;
/** @type {import("sql.js").Database | null} */
let _db = null;

function openIdb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE);
    };
  });
}

async function idbGet() {
  const idb = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, "readonly");
    const st = tx.objectStore(IDB_STORE);
    const g = st.get(IDB_KEY);
    g.onsuccess = () => resolve(g.result);
    g.onerror = () => reject(g.error);
  });
}

async function idbSet(data) {
  const idb = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(data, IDB_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getSqlJs() {
  if (!_initPromise) {
    _initPromise = initSqlJs({
      locateFile: (file) => (file.endsWith(".wasm") ? sqlWasmUrl : file),
    });
  }
  return _initPromise;
}

function ensureSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ana_messages (
      id TEXT PRIMARY KEY NOT NULL,
      text TEXT NOT NULL,
      image_base64 TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_ana_messages_created ON ana_messages (created_at ASC);
  `);
}

async function persist(db) {
  const data = db.export();
  await idbSet(data);
}

/**
 * Inicializa ou reabre a base; idempotente.
 * @returns {Promise<import("sql.js").Database>}
 */
export async function getSqliteDatabase() {
  if (_db) return _db;
  const SQL = await getSqlJs();
  const existing = await idbGet();
  if (existing instanceof Uint8Array && existing.length > 0) {
    _db = new SQL.Database(existing);
  } else {
    _db = new SQL.Database();
  }
  ensureSchema(_db);
  await persist(_db);
  return _db;
}

/**
 * Grava o estado atual no IndexedDB (chame após INSERT/DELETE).
 */
export async function persistSqliteDatabase() {
  if (!_db) return;
  await persist(_db);
}
