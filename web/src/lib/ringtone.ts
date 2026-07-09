"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

/** The 5 bundled tones (files live in web/public/ringtones/<id>.wav). */
export const BUILTIN_RINGTONES: { id: string; label: string }[] = [
  { id: "ringtone_nexa", label: "Nexa (default)" },
  { id: "ringtone_marimba", label: "Marimba" },
  { id: "ringtone_pulse", label: "Pulse" },
  { id: "ringtone_digital", label: "Digital" },
  { id: "ringtone_gentle", label: "Gentle" },
];
export const CUSTOM_RINGTONE = "custom";
const DEFAULT_RINGTONE = "ringtone_nexa";

interface RingtoneState {
  ringtoneId: string;
  customName: string | null;
  setRingtone: (id: string) => void;
  setCustom: (name: string) => void;
}

/** Which ringtone is selected (persisted in localStorage). */
export const useRingtoneStore = create<RingtoneState>()(
  persist(
    (set) => ({
      ringtoneId: DEFAULT_RINGTONE,
      customName: null,
      setRingtone: (id) => set({ ringtoneId: id }),
      setCustom: (name) => set({ ringtoneId: CUSTOM_RINGTONE, customName: name }),
    }),
    { name: "nexa-ringtone" },
  ),
);

// --- Custom audio blob stored in IndexedDB (survives reloads) ---
const DB_NAME = "nexa-ringtone";
const STORE = "audio";
const KEY = "custom";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveCustomRingtone(blob: Blob): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function loadCustomBlob(): Promise<Blob | null> {
  try {
    const db = await openDb();
    const blob = await new Promise<Blob | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const g = tx.objectStore(STORE).get(KEY);
      g.onsuccess = () => resolve(g.result as Blob | undefined);
      g.onerror = () => reject(g.error);
    });
    db.close();
    return blob ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolve a playable URL for a ringtone id. For "custom" it returns a blob URL
 * (caller should revoke it when done); for a bundled id it returns a static path.
 */
export async function resolveRingtoneUrl(id: string): Promise<string> {
  if (id === CUSTOM_RINGTONE) {
    const blob = await loadCustomBlob();
    if (blob) return URL.createObjectURL(blob);
    return `/ringtones/${DEFAULT_RINGTONE}.wav`;
  }
  const known = BUILTIN_RINGTONES.find((r) => r.id === id);
  return `/ringtones/${known?.id ?? DEFAULT_RINGTONE}.wav`;
}
