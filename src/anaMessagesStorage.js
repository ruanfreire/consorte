/**
 * Mensagens: API PHP+MySQL se `getMessagesApiUrl()` estiver definido; senão SQLite (sql.js + IndexedDB).
 */
import { getMessagesApiUrl, isLocalHost } from "./config.js";
import { getSqliteDatabase, persistSqliteDatabase } from "./sqliteDb.js";

export const MAX_MESSAGE_CHARS = 300;
const MAX_PHOTO_CHARS = 200_000;
export const ANA_MESSAGES_QUERY_LIMIT = 80;
const MAX_ROWS = ANA_MESSAGES_QUERY_LIMIT;

/** Nome lógico da tabela (histórico de código / UI). */
export const ANA_MESSAGES_COLLECTION = "ana_messages";

const JPEG_DATA_URL_PREFIX = "data:image/jpeg;base64,";

/** Servidor devolveu página HTML em vez do JSON esperado do messages.php. */
function isLikelyHtmlResponse(contentType, rawText) {
  const t = String(rawText ?? "").trimStart();
  if (t.startsWith("{") || t.startsWith("[")) return false;
  const ct = String(contentType || "").toLowerCase();
  if (ct.includes("text/html")) return true;
  const tl = t.toLowerCase();
  return (
    tl.startsWith("<!doctype") || tl.startsWith("<html") || (tl.startsWith("<") && !tl.startsWith("{"))
  );
}

const ERR_API_HTML = () =>
  new Error(
    "O servidor devolveu HTML (página ou placeholder), não o JSON do messages.php. O domínio tem de apontar para o alojamento onde o PHP corre (FTP na pasta pública) ou use o URL direto do hosting (ex.: …infinityfreeapp.com/messages.php). Para testar só a UI sem API, deixe VITE_MESSAGES_API_URL vazio em config.js (usa SQLite local).",
  );

const listeners = new Set();
let remotePollTimer = null;

function startRemotePollIfNeeded() {
  const api = getMessagesApiUrl();
  if (!api || remotePollTimer) return;
  remotePollTimer = setInterval(() => {
    notifyAnaMessagesListeners();
  }, 45_000);
}

function stopRemotePoll() {
  if (remotePollTimer) {
    clearInterval(remotePollTimer);
    remotePollTimer = null;
  }
}

/** Inscreve atualizações após INSERT ou polling (API remota). */
export function subscribeAnaMessages(callback) {
  listeners.add(callback);
  if (getMessagesApiUrl()) startRemotePollIfNeeded();
  return () => {
    listeners.delete(callback);
    if (listeners.size === 0) stopRemotePoll();
  };
}

function notifyAnaMessagesListeners() {
  for (const fn of listeners) {
    try {
      fn();
    } catch (e) {
      console.warn("[consorte] subscribeAnaMessages:", e);
    }
  }
}

function imageDataUrlToStoredField(dataUrl) {
  const s = String(dataUrl ?? "");
  const m = /^data:image\/[^;]+;base64,(.+)$/s.exec(s);
  if (m) return m[1];
  return s;
}

function storedFieldToPhotoDataUrl(stored) {
  const s = String(stored ?? "");
  if (!s) return "";
  if (s.startsWith("data:")) return s;
  return `${JPEG_DATA_URL_PREFIX}${s}`;
}

function msFromTimeField(v) {
  if (v == null) return Date.now();
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const parsed = Date.parse(v);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return Date.now();
}

export function normalizeAnaMessageRow(row) {
  const raw = row.image_base64 ?? row.imageBase64 ?? row.photo;
  const atSource = row.created_at ?? row.createdAt ?? row.at;
  const atNum = msFromTimeField(atSource);
  return {
    id: String(row.id ?? ""),
    text: String(row.text ?? ""),
    photo: storedFieldToPhotoDataUrl(raw),
    at: Number.isFinite(atNum) ? atNum : Date.now(),
  };
}

function devLogCount(n, source) {
  if (isLocalHost()) {
    console.info(`[consorte] mensagens (${source}): ${n}`);
  }
}

function selectAllMessages(db) {
  const stmt = db.prepare(
    `SELECT id, text, image_base64, created_at FROM ana_messages
     ORDER BY created_at DESC LIMIT ?`,
  );
  stmt.bind([MAX_ROWS]);
  const out = [];
  while (stmt.step()) {
    out.push(stmt.getAsObject());
  }
  stmt.free();
  return out;
}

async function loadAnaMessagesRemote(apiUrl) {
  let res;
  try {
    res = await fetch(apiUrl, {
      method: "GET",
      mode: "cors",
      cache: "no-store",
      credentials: "omit",
    });
  } catch (err) {
    const m = String(err?.message ?? err);
    if (/failed to fetch|networkerror|load failed/i.test(m)) {
      throw new Error(
        "Não foi possível ligar à API (rede ou bloqueio CORS). No GitHub Pages, confirme que messages.php no servidor envia Access-Control-Allow-Origin para o teu domínio.",
      );
    }
    throw new Error("Servidor indisponível.");
  }
  const contentType = res.headers.get("content-type") || "";
  const rawText = await res.text();
  if (isLikelyHtmlResponse(contentType, rawText)) {
    if (isLocalHost()) {
      console.warn("[consorte] api_returned_html_not_json", { status: res.status, contentType });
    }
    throw ERR_API_HTML();
  }
  if (!res.ok) {
    console.warn("[consorte] api_list_http", { status: res.status });
    throw new Error("Servidor indisponível.");
  }
  let data;
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error("Resposta inválida do servidor.");
  }
  if (!data || data.ok !== true || !Array.isArray(data.messages)) {
    console.warn("[consorte] api_list_shape");
    throw new Error("Não foi possível ler as mensagens.");
  }
  devLogCount(data.messages.length, "API");
  return data.messages.map((r) => normalizeAnaMessageRow(r));
}

/**
 * Lista mensagens (API remota ou SQLite local).
 */
export async function loadAnaMessages() {
  const apiUrl = getMessagesApiUrl();
  if (apiUrl) {
    try {
      return await loadAnaMessagesRemote(apiUrl);
    } catch (e) {
      if (e instanceof Error) throw e;
      throw new Error("Não foi possível ler as mensagens.");
    }
  }

  try {
    const db = await getSqliteDatabase();
    const raw = selectAllMessages(db);
    devLogCount(raw.length, "SQLite");
    return raw.map((r) => normalizeAnaMessageRow(r));
  } catch (e) {
    console.warn("[consorte] sqlite_load_failed", { message: String(e?.message ?? e) });
    throw new Error(
      "Não foi possível ler as mensagens. Tente recarregar a página ou limpar dados do site.",
    );
  }
}

function validatePayload(text, photoDataUrl) {
  const t = String(text ?? "")
    .trim()
    .slice(0, MAX_MESSAGE_CHARS);
  if (!t) {
    throw new Error("Escreva uma mensagem.");
  }
  if (!photoDataUrl || typeof photoDataUrl !== "string") {
    throw new Error("Escolha uma foto.");
  }
  const storedImage = imageDataUrlToStoredField(photoDataUrl);
  if (storedImage.length > MAX_PHOTO_CHARS) {
    throw new Error("Foto muito grande. Escolha outra imagem.");
  }
  return t;
}

async function addAnaMessageRemote(apiUrl, { text, photoDataUrl }) {
  const t = validatePayload(text, photoDataUrl);
  const imageBase64 = imageDataUrlToStoredField(photoDataUrl);
  let res;
  try {
    res = await fetch(apiUrl, {
      method: "POST",
      mode: "cors",
      cache: "no-store",
      credentials: "omit",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ text: t, image_base64: imageBase64 }),
    });
  } catch (err) {
    const m = String(err?.message ?? err);
    if (/failed to fetch|networkerror|load failed/i.test(m)) {
      throw new Error(
        "Não foi possível guardar (rede ou CORS). Em produção, o PHP tem de permitir o domínio do site em CORS.",
      );
    }
    throw new Error("Não foi possível guardar a mensagem.");
  }
  const postCt = res.headers.get("content-type") || "";
  const postRaw = await res.text();
  if (isLikelyHtmlResponse(postCt, postRaw)) {
    if (isLocalHost()) {
      console.warn("[consorte] api_post_returned_html", { status: res.status, contentType: postCt });
    }
    throw ERR_API_HTML();
  }
  let data;
  try {
    data = JSON.parse(postRaw);
  } catch {
    throw new Error("Resposta inválida do servidor.");
  }
  if (!res.ok || !data || data.ok !== true || !data.message) {
    console.warn("[consorte] api_post_failed", { status: res.status });
    throw new Error("Não foi possível guardar a mensagem.");
  }
  notifyAnaMessagesListeners();
  if (isLocalHost()) {
    console.info("[consorte] API gravou mensagem", { id: data.message.id });
  }
  return normalizeAnaMessageRow(data.message);
}

/**
 * Insere mensagem (API remota ou SQLite local).
 */
export async function addAnaMessage({ text, photoDataUrl }) {
  const apiUrl = getMessagesApiUrl();
  if (apiUrl) {
    try {
      return await addAnaMessageRemote(apiUrl, { text, photoDataUrl });
    } catch (e) {
      if (e instanceof Error) throw e;
      throw new Error("Não foi possível guardar a mensagem.");
    }
  }

  const t = validatePayload(text, photoDataUrl);
  const imageBase64 = imageDataUrlToStoredField(photoDataUrl);
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `msg-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  const createdAt = Date.now();

  try {
    const db = await getSqliteDatabase();
    db.run(
      `INSERT INTO ana_messages (id, text, image_base64, created_at)
       VALUES (?, ?, ?, ?)`,
      [id, t, imageBase64, createdAt],
    );
    await persistSqliteDatabase();
    notifyAnaMessagesListeners();
    if (isLocalHost()) {
      console.info("[consorte] SQLite gravou mensagem", { id });
    }
    return normalizeAnaMessageRow({
      id,
      text: t,
      image_base64: imageBase64,
      created_at: createdAt,
    });
  } catch (e) {
    console.warn("[consorte] sqlite_insert_failed", { message: String(e?.message ?? e) });
    throw new Error("Não foi possível guardar a mensagem. Verifique o espaço de armazenamento do browser.");
  }
}
