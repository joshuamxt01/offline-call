"use client";
import { useState, type KeyboardEvent } from "react";
import { Send, Mic, Video, X, Check } from "lucide-react";
import { Textarea } from "@/components/ui/Input";
import { useMediaRecorder } from "@/lib/hooks/useMediaRecorder";
import { VideoRecorderModal } from "./VideoRecorderModal";
import { cn, formatDuration } from "@/lib/utils";

export function Composer({
  onSend,
  onSendVoice,
  onSendVideo,
  onTyping,
}: {
  onSend: (text: string) => void;
  onSendVoice: (blob: Blob, durationMs: number) => void;
  onSendVideo: (blob: Blob, durationMs: number) => void;
  onTyping: () => void;
}) {
  const [text, setText] = useState("");
  const [videoOpen, setVideoOpen] = useState(false);
  const voice = useMediaRecorder();

  function submit() {
    if (!text.trim()) return;
    onSend(text);
    setText("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  async function stopVoiceAndSend() {
    const r = await voice.stop();
    if (r && r.durationMs > 400) onSendVoice(r.blob, r.durationMs);
  }

  // Recording bar (voice)
  if (voice.recording) {
    return (
      <div className="flex items-center gap-3 border-t border-border bg-card px-4 py-3">
        <span className="h-3 w-3 animate-pulse rounded-full bg-destructive" />
        <span className="flex-1 text-sm text-muted-foreground">Recording… {formatDuration(voice.elapsed)}</span>
        <button onClick={voice.cancel} className="grid h-10 w-10 place-items-center rounded-full hover:bg-muted" aria-label="Cancel">
          <X size={20} />
        </button>
        <button onClick={stopVoiceAndSend} className="grid h-11 w-11 place-items-center rounded-full bg-primary text-primary-foreground" aria-label="Send voice message">
          <Check size={20} />
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-end gap-2 border-t border-border bg-card px-3 py-3">
        <Textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            onTyping();
          }}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder="Message…"
          className="max-h-32 flex-1"
        />
        {text.trim() ? (
          <button
            onClick={submit}
            aria-label="Send"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-90"
          >
            <Send size={18} />
          </button>
        ) : (
          <>
            <button
              onClick={() => setVideoOpen(true)}
              aria-label="Record video message"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted"
            >
              <Video size={20} />
            </button>
            <button
              onClick={() => voice.start(false)}
              aria-label="Record voice message"
              className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-90")}
            >
              <Mic size={18} />
            </button>
          </>
        )}
      </div>

      <VideoRecorderModal open={videoOpen} onClose={() => setVideoOpen(false)} onSend={onSendVideo} />
    </>
  );
}
