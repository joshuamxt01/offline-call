"use client";
import { useEffect, useRef, useState } from "react";
import { RefreshCw, X } from "lucide-react";

/**
 * The web app always serves the latest code on load, so "updating" just means
 * refreshing. This polls version.json while the tab is open; if the deployed
 * version changes, it offers a one-tap refresh to pull in the new build.
 */
export function UpdateToast() {
  const [show, setShow] = useState(false);
  const baseline = useRef<string | null>(null);

  useEffect(() => {
    let stopped = false;
    async function poll() {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return;
        const v = (await res.json()) as { versionCode?: number; versionName?: string };
        const tag = `${v.versionCode ?? ""}:${v.versionName ?? ""}`;
        if (baseline.current === null) baseline.current = tag;
        else if (tag !== baseline.current) setShow(true);
      } catch {
        /* offline or not deployed yet — ignore */
      }
    }
    poll();
    const id = setInterval(() => {
      if (!stopped) poll();
    }, 60_000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, []);

  if (!show) return null;
  return (
    <div className="fixed inset-x-0 bottom-20 z-[60] mx-auto flex w-fit max-w-[92%] items-center gap-3 rounded-full border border-border bg-card px-4 py-2 shadow-lg md:bottom-4">
      <RefreshCw size={16} className="text-primary" />
      <span className="text-sm">A new version of Nexa is available.</span>
      <button
        onClick={() => window.location.reload()}
        className="rounded-full bg-primary px-3 py-1 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        Refresh
      </button>
      <button onClick={() => setShow(false)} aria-label="Dismiss" className="text-muted-foreground hover:text-foreground">
        <X size={16} />
      </button>
    </div>
  );
}
