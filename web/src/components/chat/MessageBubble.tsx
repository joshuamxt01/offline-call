"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Check, CheckCheck, Clock, SmilePlus, Reply } from "lucide-react";
import { cn, formatTime } from "@/lib/utils";
import type { ChatMessage } from "@/lib/hooks/useChat";
import { VoiceMessage, VideoMessage, ImageMessage } from "./MediaMessage";

const QUICK = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

function preview(m: ChatMessage): string {
  if (m.type === "voice") return "🎤 Voice message";
  if (m.type === "video") return "📹 Video";
  if (m.type === "image") return "📷 Photo";
  return m.text || "Message";
}

export function MessageBubble({
  message,
  myId,
  replyTo,
  onReact,
  onReply,
}: {
  message: ChatMessage;
  myId?: string | null;
  replyTo?: ChatMessage;
  onReact?: (emoji: string) => void;
  onReply?: () => void;
}) {
  const { mine, text, time, status, type, media, uploading, failed } = message;
  const isMedia = type !== "text" && media;
  const [showPicker, setShowPicker] = useState(false);

  // Group reactions by emoji → count + whether I reacted.
  const grouped = new Map<string, { count: number; mine: boolean }>();
  for (const r of message.reactions ?? []) {
    const g = grouped.get(r.emoji) ?? { count: 0, mine: false };
    g.count++;
    if (r.userId === myId) g.mine = true;
    grouped.set(r.emoji, g);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("group flex w-full items-end gap-1", mine ? "justify-end" : "justify-start")}
    >
      {/* Hover actions (react + reply) */}
      {!mine && (
        <BubbleActions onReact={onReact} onReply={onReply} showPicker={showPicker} setShowPicker={setShowPicker} />
      )}

      <div className="flex max-w-[80%] flex-col" style={{ alignItems: mine ? "flex-end" : "flex-start" }}>
        <div
          className={cn(
            "rounded-2xl px-3.5 py-2 text-sm shadow-sm",
            mine ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md border border-border bg-card text-card-foreground",
            (type === "video" || type === "image") && media && "p-1",
          )}
        >
          {replyTo && (
            <div
              className={cn(
                "mb-1 rounded-md border-l-2 px-2 py-1 text-xs",
                mine ? "border-primary-foreground/50 bg-primary-foreground/10" : "border-primary bg-muted",
              )}
            >
              <p className="font-medium opacity-80">{replyTo.mine ? "You" : "Them"}</p>
              <p className="truncate opacity-70">{preview(replyTo)}</p>
            </div>
          )}
          {isMedia && type === "voice" && <VoiceMessage media={media} mine={mine} uploading={uploading} failed={failed} />}
          {isMedia && type === "video" && <VideoMessage media={media} mine={mine} uploading={uploading} failed={failed} />}
          {isMedia && type === "image" && <ImageMessage media={media} mine={mine} uploading={uploading} failed={failed} />}
          {!isMedia && <p className="whitespace-pre-wrap break-words">{text}</p>}
          <div className={cn("mt-0.5 flex items-center justify-end gap-1 text-[10px]", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
            <span>{formatTime(time)}</span>
            {mine && <StatusIcon status={status} />}
          </div>
        </div>

        {/* Reaction chips */}
        {grouped.size > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {[...grouped.entries()].map(([emoji, g]) => (
              <button
                key={emoji}
                onClick={() => onReact?.(emoji)}
                className={cn(
                  "flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-xs",
                  g.mine ? "border-primary bg-primary/10" : "border-border bg-card",
                )}
              >
                <span>{emoji}</span>
                {g.count > 1 && <span className="text-[10px] text-muted-foreground">{g.count}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {mine && (
        <BubbleActions onReact={onReact} onReply={onReply} showPicker={showPicker} setShowPicker={setShowPicker} />
      )}
    </motion.div>
  );
}

function BubbleActions({
  onReact,
  onReply,
  showPicker,
  setShowPicker,
}: {
  onReact?: (emoji: string) => void;
  onReply?: () => void;
  showPicker: boolean;
  setShowPicker: (v: boolean) => void;
}) {
  return (
    <div className="relative flex items-center gap-0.5 self-center opacity-0 transition-opacity group-hover:opacity-100">
      <button onClick={() => setShowPicker(!showPicker)} className="rounded-full p-1 text-muted-foreground hover:bg-muted" aria-label="React">
        <SmilePlus size={16} />
      </button>
      <button onClick={onReply} className="rounded-full p-1 text-muted-foreground hover:bg-muted" aria-label="Reply">
        <Reply size={16} />
      </button>
      {showPicker && (
        <div className="absolute bottom-full z-10 mb-1 flex gap-1 rounded-full border border-border bg-card p-1 shadow-md">
          {QUICK.map((e) => (
            <button
              key={e}
              onClick={() => { onReact?.(e); setShowPicker(false); }}
              className="rounded-full px-1 text-lg hover:bg-muted"
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: ChatMessage["status"] }) {
  if (status === "sending") return <Clock size={12} />;
  if (status === "sent") return <Check size={12} />;
  if (status === "delivered") return <CheckCheck size={12} />;
  return <CheckCheck size={12} className="text-accent" />; // read
}
