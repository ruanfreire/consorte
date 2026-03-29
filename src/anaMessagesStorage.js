import {
  Timestamp,
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
} from "firebase/firestore";
import { getFirestoreDb, isFirebaseClientConfigured } from "./firebaseDb.js";

export const MAX_MESSAGE_CHARS = 300;
/** Base64 do avatar pequeno (crop 72px JPEG). */
const MAX_PHOTO_CHARS = 200_000;
const MAX_ROWS_REMOTE = 80;
const FIRESTORE_COLLECTION = "ana_messages";

const MOCK_KEY = "consorte-mock-messages-v1";

const useMock =
  import.meta.env.VITE_USE_MOCK === "true" ||
  import.meta.env.VITE_USE_MOCK === "1";

function resolveBackend() {
  if (useMock) return "mock";
  if (isFirebaseClientConfigured() && getFirestoreDb()) return "firestore";
  return null;
}

const activeBackend = resolveBackend();

function requireFirestore() {
  if (activeBackend === "firestore") return;
  throw new Error(
    import.meta.env.DEV
      ? "Mensagens indisponíveis: defina as variáveis VITE_FIREBASE_* no .env.local (Firebase Console → Project settings → Web app)."
      : "Mensagens indisponíveis: o build não incluiu Firebase. Configure secrets ou .env.production.local.",
  );
}

export function hasSharedMessages() {
  return activeBackend === "firestore";
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

function normalizeRow(row) {
  const imageBase64 = row.imageBase64 ?? row.photo;
  const atSource = row.createdAt ?? row.at;
  const atNum = msFromTimeField(atSource);
  return {
    id: String(row.id ?? row._id ?? ""),
    text: String(row.text ?? ""),
    photo: String(imageBase64 ?? ""),
    at: Number.isFinite(atNum) ? atNum : Date.now(),
  };
}

function devLogCount(n, label = "Firestore") {
  if (import.meta.env.DEV) {
    console.info(`[consorte] mensagens (${label}): ${n}`);
  }
}

function loadMockFromSession() {
  try {
    const raw = sessionStorage.getItem(MOCK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeRow);
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

async function loadFromFirestore() {
  const db = getFirestoreDb();
  if (!db) throw new Error("Firestore não inicializado.");
  const q = query(
    collection(db, FIRESTORE_COLLECTION),
    orderBy("createdAt", "asc"),
    limit(MAX_ROWS_REMOTE),
  );
  const snap = await getDocs(q);
  const rows = snap.docs.map((d) =>
    normalizeRow({ id: d.id, ...d.data() }),
  );
  devLogCount(rows.length);
  return rows;
}

async function addToFirestore({ text, photoDataUrl, atMs }) {
  const db = getFirestoreDb();
  if (!db) throw new Error("Firestore não inicializado.");
  const ref = await addDoc(collection(db, FIRESTORE_COLLECTION), {
    text,
    photo: photoDataUrl,
    at: atMs,
  });
  return normalizeRow({
    id: ref.id,
    text,
    photo: photoDataUrl,
    at: atMs,
  });
}

export async function loadAnaMessages() {
  if (useMock) {
    const rows = loadMockFromSession();
    devLogCount(rows.length, "mock");
    return rows;
  }
  requireFirestore();
  try {
    return await loadFromFirestore();
  } catch (e) {
    console.warn("[consorte] Firestore:", e);
    throw new Error("Não foi possível carregar as mensagens agora.");
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
  if (photoDataUrl.length > MAX_PHOTO_CHARS) {
    throw new Error("Foto muito grande. Escolha outra imagem.");
  }
  return t;
}

export async function addAnaMessage({ text, photoDataUrl }) {
  const t = validatePayload(text, photoDataUrl);
  const atMs = Date.now();
  if (useMock) {
    const raw = {
      id: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      text: t,
      imageBase64: photoDataUrl,
      createdAt: atMs,
      updatedAt: atMs,
    };
    const row = normalizeRow(raw);
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
    throw new Error(
      "Não foi possível enviar agora. Tente de novo em instantes.",
    );
  }
}
