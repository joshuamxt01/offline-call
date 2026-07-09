"use client";
import { useEffect, useRef } from "react";
import { useCallStore } from "@/lib/webrtc/callStore";
import { useRingtoneStore, resolveRingtoneUrl } from "@/lib/ringtone";

/**
 * Plays the selected ringtone (looping) while an incoming call is ringing, and
 * stops it the moment the call is answered, declined, or ends. Mounted once,
 * near the CallOverlay. (Browsers may block autoplay until the user has
 * interacted with the page — after any click/tap it rings normally.)
 */
export function CallRinger() {
  const status = useCallStore((s) => s.status);
  const direction = useCallStore((s) => s.direction);
  const ringtoneId = useRingtoneStore((s) => s.ringtoneId);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const shouldRing = status === "incoming" && direction === "incoming";
    let cancelled = false;
    let blobUrl: string | null = null;

    if (shouldRing) {
      (async () => {
        const url = await resolveRingtoneUrl(ringtoneId);
        if (cancelled) {
          if (url.startsWith("blob:")) URL.revokeObjectURL(url);
          return;
        }
        if (url.startsWith("blob:")) blobUrl = url;
        let a = audioRef.current;
        if (!a) {
          a = new Audio();
          audioRef.current = a;
        }
        a.src = url;
        a.loop = true;
        a.play().catch(() => {}); // ignore autoplay-policy rejections
      })();
    } else {
      const a = audioRef.current;
      if (a) {
        a.pause();
        a.currentTime = 0;
      }
    }

    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [status, direction, ringtoneId]);

  // Safety: stop audio if this ever unmounts mid-ring.
  useEffect(() => () => audioRef.current?.pause(), []);

  return null;
}
