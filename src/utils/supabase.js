import { createClient } from "@supabase/supabase-js";
import { MOCK_CONFIG } from "../config.js";

const url = String(MOCK_CONFIG.VITE_SUPABASE_URL ?? "").trim();
const key = String(MOCK_CONFIG.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY ?? "").trim();

/** Cliente único; null se `MOCK_CONFIG` estiver incompleto. */
export const supabase =
  url.length > 0 && key.length > 0 ? createClient(url, key) : null;

export function getSupabase() {
  if (!supabase) {
    throw new Error(
      "Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY em src/config.js (MOCK_CONFIG).",
    );
  }
  return supabase;
}
