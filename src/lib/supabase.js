import { createClient } from "@supabase/supabase-js";

// Supabase is configured via Vite env vars (see .env.example).
// When they're missing the client stays null and every call below becomes a
// harmless no-op, so the game still runs fully offline.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && anonKey ? createClient(url, anonKey) : null;

// Only these milestone stages have a counter column in the `snake-game` table.
// stage id -> column: 3 -> count_3, 6 -> count_6, 10 -> count_10, 15 -> count_15,
// 20 -> count_20, 25 -> count_25, 30 -> count_30, then every 5 stages:
// 35 -> count_35 ... 90 -> count_90.
export const MILESTONE_LEVELS = [
  3, 6, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90,
];

// Which milestone a stage rolls up to (the next checkpoint at or above it):
// 1..3 -> 3, 4..6 -> 6, 7..10 -> 10, 11..15 -> 15, 16..20 -> 20, 21..25 -> 25,
// 26..30 -> 30, 31..35 -> 35, ... 56..60 -> 60.
export function milestoneFor(stageId) {
  return MILESTONE_LEVELS.find((m) => stageId <= m) ?? MILESTONE_LEVELS.at(-1);
}

// Bump the global clear counter for a milestone level.
// Fire-and-forget: never throws, never blocks the UI, logs on failure.
export async function recordClear(stageId) {
  if (!supabase || !MILESTONE_LEVELS.includes(stageId)) return;
  try {
    const { error } = await supabase.rpc("increment_snake_clear", {
      level: stageId,
    });
    if (error) console.warn("[supabase] clear count failed:", error.message);
  } catch (e) {
    console.warn("[supabase] clear count error:", e?.message ?? e);
  }
}

// How many people have cleared this stage's milestone so far.
// Returns a number, or null when unavailable (offline / not configured / error).
export async function fetchClearCount(stageId) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.rpc("get_snake_clear_count", {
      level: milestoneFor(stageId),
    });
    if (error) {
      console.warn("[supabase] read count failed:", error.message);
      return null;
    }
    return typeof data === "number" ? data : null;
  } catch (e) {
    console.warn("[supabase] read count error:", e?.message ?? e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Per-user progress (which stages a player has cleared)
// ---------------------------------------------------------------------------
// There's no login, so each browser gets a stable anonymous id kept in
// localStorage. Progress is stored server-side keyed by that id (table
// `forest_progress`, see supabase/forest_progress.sql) so a returning player
// resumes right after their last cleared stage. localStorage stays the offline
// cache; Supabase is the source of truth when configured.

const USER_KEY = "forest-path.uid.v1";

// Stable per-browser id. Returns null only if storage is completely unavailable.
export function getUserId() {
  try {
    let id = localStorage.getItem(USER_KEY);
    if (!id) {
      id =
        globalThis.crypto?.randomUUID?.() ??
        `u_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(USER_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

// Load this user's cleared stage ids. Returns number[] (possibly empty), or
// null when unavailable (offline / not configured / error) so the caller can
// fall back to its local cache.
export async function loadProgress() {
  if (!supabase) return null;
  const uid = getUserId();
  if (!uid) return null;
  try {
    const { data, error } = await supabase.rpc("get_forest_progress", { uid });
    if (error) {
      console.warn("[supabase] load progress failed:", error.message);
      return null;
    }
    return Array.isArray(data) ? data.filter((n) => Number.isInteger(n)) : [];
  } catch (e) {
    console.warn("[supabase] load progress error:", e?.message ?? e);
    return null;
  }
}

// Persist one cleared stage id for this user. Fire-and-forget: never throws,
// never blocks the UI, logs on failure.
export async function saveProgress(stageId) {
  if (!supabase) return;
  const uid = getUserId();
  if (!uid) return;
  try {
    const { error } = await supabase.rpc("save_forest_progress", {
      uid,
      level: stageId,
    });
    if (error) console.warn("[supabase] save progress failed:", error.message);
  } catch (e) {
    console.warn("[supabase] save progress error:", e?.message ?? e);
  }
}
