"use client";
import { useRef, useState } from "react";
import { Bell, Play, Plus, Check } from "lucide-react";
import { Card } from "@/components/ui/misc";
import {
  BUILTIN_RINGTONES,
  CUSTOM_RINGTONE,
  useRingtoneStore,
  saveCustomRingtone,
  resolveRingtoneUrl,
} from "@/lib/ringtone";

/** Choose the incoming-call ringtone: 5 built-in tones, or pick your own file. */
export function RingtoneSettings() {
  const { ringtoneId, customName, setRingtone, setCustom } = useRingtoneStore();
  const previewRef = useRef<HTMLAudioElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  async function preview(id: string) {
    const url = await resolveRingtoneUrl(id);
    let a = previewRef.current;
    if (!a) {
      a = new Audio();
      previewRef.current = a;
    }
    a.pause();
    a.src = url;
    a.loop = false;
    a.currentTime = 0;
    a.play().catch(() => {});
  }

  function select(id: string) {
    setRingtone(id);
    void preview(id);
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    setBusy(true);
    try {
      await saveCustomRingtone(file);
      setCustom(file.name);
      await preview(CUSTOM_RINGTONE);
    } catch {
      window.alert("Couldn't load that audio file. Try a different one (mp3, m4a, ogg, or wav).");
    } finally {
      setBusy(false);
    }
  }

  const rows = [
    ...BUILTIN_RINGTONES,
    ...(customName ? [{ id: CUSTOM_RINGTONE, label: customName }] : []),
  ];

  return (
    <Card className="p-5">
      <h2 className="mb-1 flex items-center gap-2 font-semibold">
        <Bell size={18} className="text-primary" /> Ringtone
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">Plays when someone calls you. Tap one to preview.</p>

      <ul className="space-y-2">
        {rows.map((r) => {
          const active = ringtoneId === r.id;
          return (
            <li key={r.id}>
              <button
                onClick={() => select(r.id)}
                className={
                  "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors " +
                  (active ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted")
                }
              >
                <span
                  className={
                    "grid h-8 w-8 shrink-0 place-items-center rounded-full " +
                    (active ? "bg-primary text-primary-foreground" : "bg-muted")
                  }
                >
                  {active ? <Check size={16} /> : <Play size={15} />}
                </span>
                <span className="flex-1 truncate text-sm font-medium">{r.label}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <button
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        className="mt-3 flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-60"
      >
        <Plus size={16} /> {busy ? "Loading…" : "Pick from device"}
      </button>
      <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={onPick} />
    </Card>
  );
}
