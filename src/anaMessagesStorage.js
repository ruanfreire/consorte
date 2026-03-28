import { createClient } from "@supabase/supabase-js";

export const MAX_MESSAGE_CHARS = 300;
/** Base64 do avatar pequeno (crop 72px JPEG). */
const MAX_PHOTO_CHARS = 200_000;
const MAX_ROWS_REMOTE = 80;

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase =
  typeof supabaseUrl === "string" &&
  supabaseUrl.length > 0 &&
  typeof supabaseKey === "string" &&
  supabaseKey.length > 0
    ? createClient(supabaseUrl, supabaseKey)
    : null;

function requireSupabase() {
  if (!supabase) {
    throw new Error(
      "Mensagens indisponíveis: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env e faça o build de novo.",
    );
  }
  return supabase;
}

export function hasSharedMessages() {
  return !!supabase;
}

function normalizeRow(row) {
  const at = row.at;
  const atNum =
    typeof at === "number"
      ? at
      : typeof at === "string"
        ? Number.parseInt(at, 10)
        : Date.now();
  return {
    id: String(row.id ?? row._id ?? ""),
    text: String(row.text ?? ""),
    photo: String(row.photo ?? ""),
    at: Number.isFinite(atNum) ? atNum : Date.now(),
  };
}

function devLogCount(n) {
  if (import.meta.env.DEV) {
    console.info(`[consorte] mensagens (Supabase): ${n}`);
  }
}

/** Apenas leitura do Supabase — sem localStorage. */
export async function loadAnaMessages() {
  const client = requireSupabase();
  const { data, error } = await client
    .from("ana_messages")
    .select("id, text, photo, at")
    .order("at", { ascending: true })
    .limit(MAX_ROWS_REMOTE);

  if (error) {
    console.warn("[consorte] Supabase:", error.code, error.message);
    throw new Error("Não foi possível carregar as mensagens agora.");
  }
  const rows = (data || []).map(normalizeRow);
  devLogCount(rows.length);
  return rows;
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

/** Apenas insert no Supabase — sem localStorage. */
export async function addAnaMessage({ text, photoDataUrl }) {
  const t = validatePayload(text, photoDataUrl);
  const client = requireSupabase();

  const { data, error } = await client
    .from("ana_messages")
    .insert({ text: t, photo: photoDataUrl, at: Date.now() })
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
