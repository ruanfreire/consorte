import { createClient } from "@supabase/supabase-js";
import {
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

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase =
  !useMock &&
  typeof supabaseUrl === "string" &&
  supabaseUrl.length > 0 &&
  typeof supabaseKey === "string" &&
  supabaseKey.length > 0
    ? createClient(supabaseUrl, supabaseKey)
    : null;

/** `auto` | `firestore` | `supabase` */
const messagesBackend = import.meta.env.VITE_MESSAGES_BACKEND || "auto";

function resolveBackend() {
  if (useMock) return "mock";
  const fbOk = isFirebaseClientConfigured() && getFirestoreDb();
  const sbOk = !!supabase;
  if (messagesBackend === "firestore") {
    return fbOk ? "firestore" : null;
  }
  if (messagesBackend === "supabase") {
    return sbOk ? "supabase" : null;
  }
  if (fbOk) return "firestore";
  if (sbOk) return "supabase";
  return null;
}

const activeBackend = resolveBackend();

function requireRemote() {
  if (activeBackend === "firestore" || activeBackend === "supabase") {
    return activeBackend;
  }
  throw new Error(
    import.meta.env.DEV
      ? "Mensagens indisponíveis: defina Firestore (VITE_FIREBASE_*) ou Supabase (VITE_SUPABASE_*) no .env.local. Opcional: VITE_MESSAGES_BACKEND=firestore|supabase|auto."
      : "Mensagens indisponíveis: o build não incluiu Firestore nem Supabase. Configure secrets ou .env.production.local.",
  );
}

export function hasSharedMessages() {
  return activeBackend === "firestore" || activeBackend === "supabase";
}

function normalizeRow(row) {
  const at = row.at;
  const atNum =
    typeof at === "number"
      ? at
      : typeof at === "string"
        ? Number.parseInt(at, 10)
        : typeof at?.toMillis === "function"
          ? at.toMillis()
          : Date.now();
  return {
    id: String(row.id ?? row._id ?? ""),
    text: String(row.text ?? ""),
    photo: String(row.photo ?? ""),
    at: Number.isFinite(atNum) ? atNum : Date.now(),
  };
}

function devLogCount(n, label = "remote") {
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
    orderBy("at", "asc"),
    limit(MAX_ROWS_REMOTE),
  );
  const snap = await getDocs(q);
  const rows = snap.docs.map((d) =>
    normalizeRow({ id: d.id, ...d.data() }),
  );
  devLogCount(rows.length, "Firestore");
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

async function loadFromSupabase() {
  if (!supabase) throw new Error("Supabase não configurado.");
  const { data, error } = await supabase
    .from("ana_messages")
    .select("id, text, photo, at")
    .order("at", { ascending: true })
    .limit(MAX_ROWS_REMOTE);

  if (error) {
    console.warn("[consorte] Supabase:", error.code, error.message);
    throw new Error("Não foi possível carregar as mensagens agora.");
  }
  const rows = (data || []).map(normalizeRow);
  devLogCount(rows.length, "Supabase");
  return rows;
}

async function addToSupabase({ text, photoDataUrl, atMs }) {
  if (!supabase) throw new Error("Supabase não configurado.");
  const { data, error } = await supabase
    .from("ana_messages")
    .insert({ text, photo: photoDataUrl, at: atMs })
    .select("id, text, photo, at")
    .single();

  if (error) {
    console.warn("[consorte] Falha ao enviar mensagem.", error.code);
    throw new Error(
      "Não foi possível enviar agora. Tente de novo em instantes.",
    );
  }
  return normalizeRow(data);
}

export async function loadAnaMessages() {
  if (useMock) {
    const rows = loadMockFromSession();
    devLogCount(rows.length, "mock");
    return rows;
  }
  requireRemote();
  if (activeBackend === "firestore") {
    try {
      return await loadFromFirestore();
    } catch (e) {
      console.warn("[consorte] Firestore:", e);
      throw new Error("Não foi possível carregar as mensagens agora.");
    }
  }
  return loadFromSupabase();
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
    const row = normalizeRow({
      id: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      text: t,
      photo: photoDataUrl,
      at: atMs,
    });
    const list = loadMockFromSession();
    list.push(row);
    saveMockList(list);
    return row;
  }
  requireRemote();
  if (activeBackend === "firestore") {
    try {
      return await addToFirestore({ text: t, photoDataUrl, atMs });
    } catch (e) {
      console.warn("[consorte] Firestore insert:", e);
      throw new Error(
        "Não foi possível enviar agora. Tente de novo em instantes.",
      );
    }
  }
  return addToSupabase({ text: t, photoDataUrl, atMs });
}
