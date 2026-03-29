/**
 * Firestore (API modular Web): mesma coleção + query para `getDocs` e `onSnapshot`.
 * @see https://firebase.google.com/docs/firestore/query-data/get-data?hl=pt-br
 * @see https://firebase.google.com/docs/firestore/manage-data/add-data?hl=pt-br
 */
import {
  addDoc,
  collection,
  enableNetwork,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { getFirebaseEnv, isLocalHost, useMockMessages } from "./config.js";
import { getFirestoreDb, isFirebaseClientConfigured } from "./firebaseDb.js";

export { isFirebaseClientConfigured } from "./firebaseDb.js";

export const MAX_MESSAGE_CHARS = 300;
/** Base64 do avatar pequeno (crop 72px JPEG). */
const MAX_PHOTO_CHARS = 200_000;
export const ANA_MESSAGES_QUERY_LIMIT = 80;
const MAX_ROWS_REMOTE = ANA_MESSAGES_QUERY_LIMIT;
const FIRESTORE_COLLECTION = "ana_messages";

/** Nome da coleção (regras + índices). */
export const ANA_MESSAGES_COLLECTION = FIRESTORE_COLLECTION;

/**
 * Referência de coleção — mesmo caminho em todas as operações.
 * @param {import("firebase/firestore").Firestore} db
 */
export function anaMessagesCollectionRef(db) {
  return collection(db, FIRESTORE_COLLECTION);
}

/**
 * Query única para listar mensagens (usar em `getDocs` e `onSnapshot`).
 * @param {import("firebase/firestore").Firestore} db
 */
export function buildAnaMessagesQuery(db) {
  return query(
    anaMessagesCollectionRef(db),
    orderBy("createdAt", "asc"),
    limit(MAX_ROWS_REMOTE),
  );
}

/**
 * @param {import("firebase/firestore").QuerySnapshot} snap
 */
export function anaMessageRowsFromQuerySnapshot(snap) {
  return snap.docs.map((d) =>
    normalizeAnaMessageRow({ id: d.id, ...d.data() }),
  );
}

const MOCK_KEY = "consorte-mock-messages-v1";

const JPEG_DATA_URL_PREFIX = "data:image/jpeg;base64,";

/** Extrai base64 puro (regra Firestore: `imageBase64` ≤ 200k). Aceita data URL ou legado já em base64. */
function imageDataUrlToFirestoreField(dataUrl) {
  const s = String(dataUrl ?? "");
  const m = /^data:image\/[^;]+;base64,(.+)$/s.exec(s);
  if (m) return m[1];
  return s;
}

/** Reconstrói data URL para a UI (crop é sempre JPEG). */
function firestoreFieldToPhotoDataUrl(stored) {
  const s = String(stored ?? "");
  if (!s) return "";
  if (s.startsWith("data:")) return s;
  return `${JPEG_DATA_URL_PREFIX}${s}`;
}

function resolveBackend() {
  if (useMockMessages()) return "mock";
  if (!isFirebaseClientConfigured()) return null;
  const db = getFirestoreDb();
  if (db) return "firestore";
  console.warn(
    "[consorte] firestore_unavailable: MOCK_CONFIG tem Firebase mas Firestore não inicializou (ver erros acima na consola).",
  );
  return null;
}

/** Recalcula a cada chamada — evita ficar sem Firebase se o estado mudar depois do primeiro import. */
function getActiveBackend() {
  return resolveBackend();
}

/** Texto único na UI (sem .env) — sincronizar com o que está em `src/config.js`. */
const MSG_FIRESTORE_UNAVAILABLE =
  "Mensagens indisponíveis: em `src/config.js` confirme `MOCK_CONFIG` (chaves Firebase e `VITE_USE_MOCK` não é true), depois `npm run build` e publique o site de novo.";

function requireFirestore() {
  if (getActiveBackend() === "firestore") return;
  console.warn("[consorte] requireFirestore_failed", {
    mockMode: useMockMessages(),
    firebaseConfigured: isFirebaseClientConfigured(),
    firestoreDb: !!getFirestoreDb(),
  });
  throw new Error(MSG_FIRESTORE_UNAVAILABLE);
}

export function hasSharedMessages() {
  return getActiveBackend() === "firestore";
}

/** Converte documento Firestore / mock para o formato da UI (`photo`, `at` em ms). */
function msFromTimeField(v) {
  if (v == null) return Date.now();
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? n : Date.now();
  }
  if (typeof v?.toMillis === "function") return v.toMillis();
  return Date.now();
}

export function normalizeAnaMessageRow(row) {
  const raw = row.imageBase64 ?? row.photo;
  const atSource = row.createdAt ?? row.at;
  const atNum = msFromTimeField(atSource);
  return {
    id: String(row.id ?? row._id ?? ""),
    text: String(row.text ?? ""),
    photo: firestoreFieldToPhotoDataUrl(raw),
    at: Number.isFinite(atNum) ? atNum : Date.now(),
  };
}

function devLogCount(n, label = "Firestore", extra = "") {
  if (isLocalHost()) {
    const { projectId: pid, firestoreDatabaseId: fdb } = getFirebaseEnv();
    const dbId = fdb.trim() || "(default)";
    console.info(
      `[consorte] mensagens (${label})${extra ? ` ${extra}` : ""}: ${n} — projeto "${pid}" base "${dbId}" coleção "${FIRESTORE_COLLECTION}"`,
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

function firestoreErrorMessage(err) {
  const code = err?.code ?? "";
  const msg = err?.message ?? String(err);
  if (isLocalHost()) {
    console.error("[consorte] Firestore erro:", code, msg);
  }
  if (code === "permission-denied") {
    return "Permissão negada: verifique as regras do Firestore (text, imageBase64, createdAt, updatedAt) e publique de novo.";
  }
  if (code === "failed-precondition") {
    return "Índice em falta: abra o link do erro na consola (F12) e crie o índice no Firebase.";
  }
  if (code === "unavailable") {
    return "Serviço Firestore indisponível (rede ou firewall). Tente de novo ou verifique a ligação.";
  }
  if (code === "resource-exhausted" || code === "deadline-exceeded") {
    return "O envio demorou demais (rede ou firewall). Verifique a ligação e tente de novo.";
  }
  return "Não foi possível concluir a operação. Tente de novo.";
}

/** Erros que costumam ser transitórios — retentativa com backoff (evita duplicar writes bem-sucedidos só em leituras). */
const FIRESTORE_RETRY_CODES = new Set([
  "unavailable",
  "resource-exhausted",
  "deadline-exceeded",
]);

/**
 * @template T
 * @param {() => Promise<T>} fn
 * @param {{ maxAttempts?: number }} [opts]
 */
async function withFirestoreRetry(fn, opts = {}) {
  const maxAttempts = opts.maxAttempts ?? 3;
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const code = e?.code ?? "";
      if (attempt >= maxAttempts || !FIRESTORE_RETRY_CODES.has(code)) {
        throw e;
      }
      const delayMs = 350 * 2 ** (attempt - 1);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

async function loadFromFirestore() {
  const db = getFirestoreDb();
  if (!db) throw new Error("Firestore não inicializado.");
  const q = buildAnaMessagesQuery(db);
  /** `getDocs` usa cache + servidor conforme rede; ver opções `getDoc` na documentação. */
  const snap = await withFirestoreRetry(() => getDocs(q));
  const rows = anaMessageRowsFromQuerySnapshot(snap);
  devLogCount(
    rows.length,
    "Firestore",
    isLocalHost()
      ? `(fromCache=${snap.metadata.fromCache})`
      : "",
  );
  return rows;
}

/** Evita o modal “Salvando…” infinito se o `addDoc` nunca receber resposta do backend. */
const FIRESTORE_WRITE_TIMEOUT_MS = 45_000;

/** Tem de coincidir com `firestore.rules` (imageBase64 + timestamps). */
async function addToFirestore({ text, photoDataUrl, atMs }) {
  const db = getFirestoreDb();
  if (!db) throw new Error("Firestore não inicializado.");
  await enableNetwork(db).catch(() => {});
  const storedImage = imageDataUrlToFirestoreField(photoDataUrl);
  const payload = {
    text,
    imageBase64: storedImage,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  let timeoutId;
  const deadline = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      const e = new Error("deadline-exceeded");
      e.code = "deadline-exceeded";
      reject(e);
    }, FIRESTORE_WRITE_TIMEOUT_MS);
  });

  let ref;
  try {
    ref = await Promise.race([
      addDoc(anaMessagesCollectionRef(db), payload),
      deadline,
    ]);
  } finally {
    clearTimeout(timeoutId);
  }

  if (isLocalHost()) {
    console.info("[consorte] Firestore gravou documento", {
      id: ref.id,
      collection: FIRESTORE_COLLECTION,
    });
  }
  /** UI imediata: hora local; o servidor e o `onSnapshot` confirmam com `Timestamp` real. */
  return normalizeAnaMessageRow({
    id: ref.id,
    text,
    imageBase64: storedImage,
    createdAt: atMs,
    updatedAt: atMs,
  });
}

export async function loadAnaMessages() {
  if (useMockMessages()) {
    const rows = loadMockFromSession();
    devLogCount(rows.length, "mock");
    return rows;
  }
  requireFirestore();
  try {
    return await loadFromFirestore();
  } catch (e) {
    console.warn("[consorte] Firestore load:", e);
    throw new Error(firestoreErrorMessage(e));
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
  const storedImage = imageDataUrlToFirestoreField(photoDataUrl);
  if (storedImage.length > MAX_PHOTO_CHARS) {
    throw new Error("Foto muito grande. Escolha outra imagem.");
  }
  return t;
}

export async function addAnaMessage({ text, photoDataUrl }) {
  const t = validatePayload(text, photoDataUrl);
  const atMs = Date.now();
  if (useMockMessages()) {
    const storedForLog = imageDataUrlToFirestoreField(photoDataUrl);
    const raw = {
      id: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      text: t,
      imageBase64: storedForLog,
      createdAt: atMs,
      updatedAt: atMs,
    };
    const row = normalizeAnaMessageRow(raw);
    const list = loadMockFromSession();
    list.push(raw);
    saveMockList(list);
    return row;
  }
  requireFirestore();
  try {
    return await addToFirestore({ text: t, photoDataUrl, atMs });
  } catch (e) {
    console.warn("[consorte] Firestore insert:", e);
    throw new Error(firestoreErrorMessage(e));
  }
}
