"use client";
import { useCallback, useRef, useState } from "react";

function pickMime(candidates: string[]): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return candidates.find((c) => MediaRecorder.isTypeSupported(c));
}

export interface RecordingResult {
  blob: Blob;
  durationMs: number;
}

/** Records audio or audio+video via MediaRecorder. Exposes the live stream so a
 *  video recorder can show a preview. */
export function useMediaRecorder() {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const start = useCallback(async (video: boolean) => {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true, video });
    setStream(s);
    const mime = video
      ? pickMime(["video/webm;codecs=vp8,opus", "video/webm", "video/mp4"])
      : pickMime(["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]);
    const rec = new MediaRecorder(s, mime ? { mimeType: mime } : undefined);
    chunksRef.current = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
    rec.start();
    recorderRef.current = rec;
    startedAtRef.current = Date.now();
    setRecording(true);
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000)), 250);
  }, []);

  const stop = useCallback(
    () =>
      new Promise<RecordingResult | null>((resolve) => {
        const rec = recorderRef.current;
        if (!rec) return resolve(null);
        rec.onstop = () => {
          const durationMs = Date.now() - startedAtRef.current;
          const blob = new Blob(chunksRef.current, { type: rec.mimeType || "application/octet-stream" });
          teardown();
          resolve({ blob, durationMs });
        };
        rec.stop();
      }),
    [],
  );

  const cancel = useCallback(() => {
    try { recorderRef.current?.stop(); } catch { /* ignore */ }
    teardown();
  }, []);

  function teardown() {
    clearInterval(timerRef.current);
    setStream((s) => {
      s?.getTracks().forEach((t) => t.stop());
      return null;
    });
    recorderRef.current = null;
    setRecording(false);
  }

  return { recording, elapsed, stream, start, stop, cancel };
}
