/**
 * Mensagens à Ana: Supabase (PostgreSQL + Realtime).
 */
import { isLocalHost } from "./config.js";
import { getSupabase, supabase } from "./utils/supabase.js";

export const MAX_MESSAGE_CHARS = 300;
const MAX_PHOTO_CHARS = 200_000;
export const ANA_MESSAGES_QUERY_LIMIT = 80;

/** Nome da tabela no Supabase (public.ana_messages). */
export const ANA_MESSAGES_COLLECTION = "ana_messages";

/** RLS / privilégios: INSERT ou SELECT após insert negado (ex.: HTTP 401 + código 42501). */
function isRlsOrPrivilegeError(error) {
  if (!error) return false;
  const code = String(error.code ?? "");
  const msg = String(error.message ?? "").toLowerCase();
  return (
    code === "42501" ||
    code === "PGRST301" ||
    msg.includes("permission denied") ||
    msg.includes("row-level security")
  );
}

/** PostgREST 404 / relação inexistente — a tabela ainda não foi criada no projeto. */
function isMissingAnaMessagesTableError(error) {
  if (!error) return false;
  const code = String(error.code ?? "");
  const msg = String(error.message ?? "").toLowerCase();
  return (
    code === "PGRST205" ||
    code === "42P01" ||
    msg.includes("schema cache") ||
    msg.includes("does not exist")
  );
}

const JPEG_DATA_URL_PREFIX = "data:image/jpeg;base64,";

const listeners = new Set();
let realtimeChannel = null;

function notifyAnaMessagesListeners() {
  for (const fn of listeners) {
    try {
      fn();
    } catch (e) {
      console.warn("[consorte] subscribeAnaMessages:", e);
    }
  }
}

function ensureRealtimeChannel() {
  if (!supabase || realtimeChannel) return;
  realtimeChannel = supabase
    .channel("ana_messages_realtime")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: ANA_MESSAGES_COLLECTION,
      },
      () => {
        notifyAnaMessagesListeners();
      },
    )
    .subscribe((status) => {
      if (status === "CHANNEL_ERROR" && isLocalHost()) {
        console.warn("[consorte] supabase_realtime_channel_error");
      }
    });
}

function teardownRealtimeIfIdle() {
  if (listeners.size > 0 || !supabase || !realtimeChannel) return;
  supabase.removeChannel(realtimeChannel);
  realtimeChannel = null;
}

/** Inscreve atualizações (Realtime INSERT + notificação local após insert). */
export function subscribeAnaMessages(callback) {
  listeners.add(callback);
  ensureRealtimeChannel();
  return () => {
    listeners.delete(callback);
    teardownRealtimeIfIdle();
  };
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
  const textVal = row.message_text ?? row.text ?? "";
  const atSource = row.created_at ?? row.createdAt ?? row.at;
  const atNum = msFromTimeField(atSource);
  return {
    id: String(row.id ?? ""),
    text: String(textVal),
    photo: storedFieldToPhotoDataUrl(raw),
    at: Number.isFinite(atNum) ? atNum : Date.now(),
  };
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

/**
 * Lista mensagens (mais recentes primeiro, limite configurado).
 */
export async function loadAnaMessages() {
  const client = getSupabase();
  const { data, error } = await client
    .from(ANA_MESSAGES_COLLECTION)
    .select("id, message_text, image_base64, created_at")
    .order("created_at", { ascending: false })
    .limit(ANA_MESSAGES_QUERY_LIMIT);

  if (error) {
    if (isMissingAnaMessagesTableError(error)) {
      console.warn(
        "[consorte] A tabela public.ana_messages não existe neste projeto Supabase (HTTP 404 / PGRST205). Executa o ficheiro `supabase/schema.sql` no Dashboard → SQL → New query → Run. Depois: Database → Replication → ativar Realtime para `ana_messages` (INSERT).",
      );
    } else {
      console.warn("[consorte] supabase_select_failed", { code: error.code });
    }
    throw new Error("Não foi possível ler as mensagens.");
  }
  const rows = Array.isArray(data) ? data : [];
  if (isLocalHost()) {
    console.info(`[consorte] mensagens (Supabase): ${rows.length}`);
  }
  return rows.map((r) => normalizeAnaMessageRow(r));
}

/**
 * Insere mensagem.
 */
export async function addAnaMessage({ text, photoDataUrl }) {
  const t = validatePayload(text, photoDataUrl);
  const imageBase64 = imageDataUrlToStoredField(photoDataUrl);

  const client = getSupabase();
  const { data, error } = await client
    .from(ANA_MESSAGES_COLLECTION)
    .insert({
      message_text: t,
      image_base64: imageBase64,
    })
    .select("id, message_text, image_base64, created_at")
    .single();

  if (error) {
    if (isMissingAnaMessagesTableError(error)) {
      console.warn(
        "[consorte] A tabela public.ana_messages não existe neste projeto Supabase (HTTP 404 / PGRST205). Executa o ficheiro `supabase/schema.sql` no Dashboard → SQL → New query → Run.",
      );
    } else if (isRlsOrPrivilegeError(error)) {
      console.warn(
        "[consorte] Insert bloqueado: RLS ou GRANT em falta (401 / 42501). No Supabase: SQL Editor → executa o bloco de políticas + `grant select, insert` do ficheiro `supabase/schema.sql`. Apaga políticas duplicadas da UI se conflitarem.",
      );
    } else {
      console.warn("[consorte] supabase_insert_failed", { code: error.code });
    }
    throw new Error("Não foi possível guardar a mensagem.");
  }
  notifyAnaMessagesListeners();
  if (isLocalHost()) {
    console.info("[consorte] Supabase gravou mensagem", { id: data?.id });
  }
  return normalizeAnaMessageRow(data);
}
