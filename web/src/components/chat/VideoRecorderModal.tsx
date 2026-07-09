"use client";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Square, Send, RotateCcw } from "lucide-react";
import { useMediaRecorder, type RecordingResult } from "@/lib/hooks/useMediaRecorder";
import { formatDuration } from "@/lib/utils";

export function VideoRecorderModal({
  open,
  onClose,
  onSend,
}: {
  open: boolean;
  onClose: () => void;
  onSend: (blob: Blob, durationMs: number) => void;
}) {
  const { recording, elapsed, stream, start, stop, cancel } = useMediaRecorder();
  const previewRef = useRef<HTMLVideoElement>(null);
  const [result, setResult] = useState<RecordingResult | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  // Auto-start a video note when the modal opens.
  useEffect(() => {
    if (open) void start(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (previewRef.current && stream) previewRef.current.srcObject = stream;
  }, [stream]);

  if (!open) return null;

  async function handleStop() {
    const r = await stop();
    if (r) {
      setResult(r);
      setResultUrl(URL.createObjectURL(r.blob));
    }
  }

  function retake() {
    setResult(null);
    setResultUrl(null);
    void start(true);
  }

  function close() {
    cancel();
    setResult(null);
    setResultUrl(null);
    onClose();
  }

  function handleSend() {
    if (result) {
      onSend(result.blob, result.durationMs);
      close();
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4"
      >
        <button onClick={close} className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white" aria-label="Close">
          <X size={22} />
        </button>

        <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-black">
          {result && resultUrl ? (
            <video src={resultUrl} controls autoPlay playsInline className="max-h-[70vh] w-full" />
          ) : (
            <video ref={previewRef} autoPlay playsInline muted className="max-h-[70vh] w-full scale-x-[-1]" />
          )}
          {recording && (
            <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/50 px-3 py-1 text-sm text-white">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
              {formatDuration(elapsed)}
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center gap-6">
          {result ? (
            <>
              <button onClick={retake} className="grid h-14 w-14 place-items-center rounded-full bg-white/15 text-white" aria-label="Retake">
                <RotateCcw size={24} />
              </button>
              <button onClick={handleSend} className="grid h-16 w-16 place-items-center rounded-full bg-primary text-primary-foreground" aria-label="Send">
                <Send size={26} />
              </button>
            </>
          ) : (
            <button onClick={handleStop} className="grid h-16 w-16 place-items-center rounded-full bg-red-500 text-white" aria-label="Stop">
              <Square size={26} fill="currentColor" />
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
