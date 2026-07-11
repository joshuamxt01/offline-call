"use client";
import { useRef, useState, type KeyboardEvent } from "react";
import { Send, Mic, Video, X, Check, Image as ImageIcon, Smile } from "lucide-react";
import { Textarea } from "@/components/ui/Input";
import { useMediaRecorder } from "@/lib/hooks/useMediaRecorder";
import { VideoRecorderModal } from "./VideoRecorderModal";
import { cn, formatDuration } from "@/lib/utils";

const EMOJIS = "😀 😁 😂 🤣 😊 😍 😘 😎 🤩 🥳 😉 🙂 🙃 😇 🥰 🤗 🤔 🙄 😏 😴 😌 😔 😢 😭 😤 😠 😡 🤯 😳 🥺 😅 😆 😜 😝 🤪 😋 👍 👎 👏 🙏 💪 👌 ✌️ 🤝 🙌 👋 👀 ❤️ 🧡 💛 💚 💙 💜 🖤 💔 💯 🔥 🎉 🎊 ✨ ⭐ 🌟 💫 🙈".split(" ");

export function Composer({
  onSend,
  onSendVoice,
  onSendVideo,
  onSendImage,
  onTyping,
  replyTo,
  onCancelReply,
}: {
  onSend: (text: string) => void;
  onSendVoice: (blob: Blob, durationMs: number) => void;
  onSendVideo: (blob: Blob, durationMs: number) => void;
  onSendImage: (blob: Blob) => void;
  onTyping: () => void;
  replyTo?: { name: string; text: string } | null;
  onCancelReply?: () => void;
}) {
  const [text, setText] = useState("");
  const [videoOpen, setVideoOpen] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
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
      <div className="border-t border-border bg-card">
        {replyTo && (
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <div className="min-w-0 flex-1 border-l-2 border-primary pl-2">
              <p className="text-xs font-medium text-primary">Replying to {replyTo.name}</p>
              <p className="truncate text-xs text-muted-foreground">{replyTo.text}</p>
            </div>
            <button onClick={onCancelReply} aria-label="Cancel reply" className="rounded p-1 hover:bg-muted">
              <X size={16} />
            </button>
          </div>
        )}
        {showEmoji && (
          <div className="grid max-h-48 grid-cols-8 gap-1 overflow-y-auto border-b border-border p-2 text-2xl">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setText((t) => t + e)}
                className="rounded p-1 hover:bg-muted"
              >
                {e}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2 px-3 py-3">
          <button
            type="button"
            onClick={() => setShowEmoji((v) => !v)}
            aria-label="Emoji"
            className={cn(
              "grid h-11 w-11 shrink-0 place-items-center rounded-full hover:bg-muted",
              showEmoji ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Smile size={20} />
          </button>
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
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onSendImage(file);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => fileInput.current?.click()}
              aria-label="Send photo"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted"
            >
              <ImageIcon size={20} />
            </button>
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
      </div>

      <VideoRecorderModal open={videoOpen} onClose={() => setVideoOpen(false)} onSend={onSendVideo} />
    </>
  );
}
