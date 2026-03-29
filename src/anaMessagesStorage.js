/**
 * Mensagens partilhadas: Firebase Data Connect (PostgreSQL / Cloud SQL) ou mock.
 * @see https://firebase.google.com/docs/data-connect/web-sdk
 */
import {
  executeMutation,
  executeQuery,
  mutationRef,
  queryRef,
} from "firebase/data-connect";
import { isLocalHost, useMockMessages } from "./config.js";
import {
  getDataConnectInstance,
  isDataConnectConfigured,
} from "./dataConnectClient.js";
import { isFirebaseClientConfigured } from "./firebaseApp.js";

export { isFirebaseClientConfigured } from "./firebaseApp.js";
export { isDataConnectConfigured } from "./dataConnectClient.js";

export const MAX_MESSAGE_CHARS = 300;
const MAX_PHOTO_CHARS = 200_000;
export const ANA_MESSAGES_QUERY_LIMIT = 80;
const MAX_ROWS_REMOTE = ANA_MESSAGES_QUERY_LIMIT;

export const ANA_MESSAGES_COLLECTION = "ana_messages";

const MOCK_KEY = "consorte-mock-messages-v1";

const JPEG_DATA_URL_PREFIX = "data:image/jpeg;base64,";

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

function resolveBackend() {
  if (useMockMessages()) return "mock";
  if (!isFirebaseClientConfigured() || !isDataConnectConfigured()) return null;
  const dc = getDataConnectInstance();
  if (dc) return "dataconnect";
  console.warn(
    "[consorte] dataconnect_unavailable: confirme Firebase + Data Connect em `src/config.js` e o deploy do serviço (`firebase deploy --only dataconnect`).",
  );
  return null;
}

function getActiveBackend() {
  return resolveBackend();
}

const MSG_REMOTE_UNAVAILABLE =
  "Mensagens indisponíveis: em `src/config.js` preencha as chaves Firebase e Data Connect (`VITE_DATACONNECT_*`), faça deploy do Data Connect em `dataconnect/` e publique o site.";

function requireDataConnect() {
  if (getActiveBackend() === "dataconnect") return;
  console.warn("[consorte] requireDataConnect_failed", {
    mockMode: useMockMessages(),
    firebaseConfigured: isFirebaseClientConfigured(),
    dataConnectConfigured: isDataConnectConfigured(),
    dc: !!getDataConnectInstance(),
  });
  throw new Error(MSG_REMOTE_UNAVAILABLE);
}

export function hasSharedMessages() {
  return getActiveBackend() === "dataconnect";
}

function msFromTimeField(v) {
  if (v == null) return Date.now();
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const parsed = Date.parse(v);
    if (!Number.isNaN(parsed)) return parsed;
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? n : Date.now();
  }
  if (typeof v?.toMillis === "function") return v.toMillis();
  return Date.now();
}

export function normalizeAnaMessageRow(row) {
  const raw = row.image_base64 ?? row.imageBase64 ?? row.photo;
  const atSource = row.created_at ?? row.createdAt ?? row.at;
  const atNum = msFromTimeField(atSource);
  return {
    id: String(row.id ?? row._id ?? ""),
    text: String(row.text ?? ""),
    photo: storedFieldToPhotoDataUrl(raw),
    at: Number.isFinite(atNum) ? atNum : Date.now(),
  };
}

function devLogCount(n, label, extra = "") {
  if (isLocalHost()) {
    console.info(
      `[consorte] mensagens (${label})${extra ? ` ${extra}` : ""}: ${n}`,
    );
  }
}

function loadMockFromSession() {
  try {
    const raw = sessionStorage.getItem(MOCK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeAnaMessageRow);
  } catch {
    return [];
  }
}

function saveMockList(rows) {
  try {
    sessionStorage.setItem(
      MOCK_KEY,
      JSON.stringify(rows.slice(-MAX_ROWS_REMOTE)),
    );
  } catch (e) {
    console.warn("[consorte] mock sessionStorage:", e);
  }
}

function remoteErrorMessage(err) {
  const code = err?.code ?? "";
  const msg = String(err?.message ?? err ?? "");
  if (isLocalHost()) {
    console.error("[consorte] Data Connect erro:", code, msg);
  }
  if (code === "permission-denied" || /permission|auth/i.test(msg)) {
    return "Permissão negada: verifique `@auth` nas queries/mutações em `dataconnect/ana-connector/`.";
  }
  if (code === "client-timeout") {
    return "A rede está muito lenta e o envio foi interrompido. Tente de novo num Wi‑Fi ou 4G estável.";
  }
  if (/failed-precondition|not found|NOT_FOUND/i.test(msg)) {
    return "Serviço Data Connect indisponível ou ainda não implantado. Verifique a consola Firebase.";
  }
  return "Não foi possível concluir a operação. Tente de novo.";
}

async function withTransientRetry(fn, opts = {}) {
  const maxAttempts = opts.maxAttempts ?? 3;
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const msg = String(e?.message ?? "");
      const retry =
        /network|fetch|Failed to fetch|UNAVAILABLE|503/i.test(msg);
      if (attempt >= maxAttempts || !retry) throw e;
      const delayMs = 350 * 2 ** (attempt - 1);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

const WRITE_TIMEOUT_MS = 120_000;

async function loadFromDataConnect() {
  const dc = getDataConnectInstance();
  if (!dc) throw new Error("Data Connect não inicializado.");

  const run = async () => {
    const ref = queryRef(dc, "ListAnaMessages", {
      limit: MAX_ROWS_REMOTE,
    });
    const res = await executeQuery(ref);
    const list = res?.data?.anaMessages ?? [];
    return list.map((r) => normalizeAnaMessageRow(r));
  };

  const rows = await withTransientRetry(run, { maxAttempts: 3 });
  devLogCount(rows.length, "Data Connect");
  return rows;
}

async function addToDataConnect({ text, photoDataUrl }) {
  const dc = getDataConnectInstance();
  if (!dc) throw new Error("Data Connect não inicializado.");
  const imageBase64 = imageDataUrlToStoredField(photoDataUrl);

  let timeoutId;
  const deadline = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      const e = new Error("client-timeout");
      e.code = "client-timeout";
      console.warn("[consorte] dataconnect_write_client_timeout", {
        ms: WRITE_TIMEOUT_MS,
      });
      reject(e);
    }, WRITE_TIMEOUT_MS);
  });

  const write = async () => {
    const ref = mutationRef(dc, "CreateAnaMessage", {
      text,
      imageBase64,
    });
    const res = await executeMutation(ref);
    let row = res?.data?.anaMessage_insert;
    if (!row) {
      const rows = await loadFromDataConnect();
      row = rows[rows.length - 1];
    }
    if (!row) {
      const e = new Error("Resposta vazia do CreateAnaMessage.");
      e.code = "empty-response";
      throw e;
    }
    return row;
  };

  let row;
  try {
    row = await Promise.race([
      withTransientRetry(write, { maxAttempts: 3 }),
      deadline,
    ]);
  } finally {
    clearTimeout(timeoutId);
  }

  if (isLocalHost()) {
    console.info("[consorte] Data Connect gravou mensagem", { id: row.id });
  }
  return normalizeAnaMessageRow(row);
}

export async function loadAnaMessages() {
  if (useMockMessages()) {
    const rows = loadMockFromSession();
    devLogCount(rows.length, "mock");
    return rows;
  }
  requireDataConnect();
  try {
    return await loadFromDataConnect();
  } catch (e) {
    console.warn("[consorte] Data Connect load:", e);
    throw new Error(remoteErrorMessage(e));
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

export async function addAnaMessage({ text, photoDataUrl }) {
  const t = validatePayload(text, photoDataUrl);
  if (useMockMessages()) {
    const storedForLog = imageDataUrlToStoredField(photoDataUrl);
    const raw = {
      id: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      text: t,
      imageBase64: storedForLog,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const row = normalizeAnaMessageRow(raw);
    const list = loadMockFromSession();
    list.push(raw);
    saveMockList(list);
    return row;
  }
  requireDataConnect();
  try {
    return await addToDataConnect({ text: t, photoDataUrl });
  } catch (e) {
    console.warn("[consorte] Data Connect insert:", e);
    throw new Error(remoteErrorMessage(e));
  }
}
