"use client";
import { motion } from "framer-motion";
import { Check, CheckCheck, Clock } from "lucide-react";
import { cn, formatTime } from "@/lib/utils";
import type { ChatMessage } from "@/lib/hooks/useChat";
import { VoiceMessage, VideoMessage } from "./MediaMessage";

export function MessageBubble({ message }: { message: ChatMessage }) {
  const { mine, text, time, status, type, media, uploading, failed } = message;
  const isMedia = type !== "text" && media;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex w-full", mine ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "max-w-[78%] rounded-2xl px-3.5 py-2 text-sm shadow-sm",
          mine
            ? "rounded-br-md bg-primary text-primary-foreground"
            : "rounded-bl-md bg-card text-card-foreground border border-border",
          type === "video" && media && "p-1",
        )}
      >
        {isMedia && type === "voice" && <VoiceMessage media={media} mine={mine} uploading={uploading} failed={failed} />}
        {isMedia && type === "video" && <VideoMessage media={media} mine={mine} uploading={uploading} failed={failed} />}
        {!isMedia && <p className="whitespace-pre-wrap break-words">{text}</p>}
        <div
          className={cn(
            "mt-0.5 flex items-center justify-end gap-1 text-[10px]",
            mine ? "text-primary-foreground/70" : "text-muted-foreground",
          )}
        >
          <span>{formatTime(time)}</span>
          {mine && <StatusIcon status={status} />}
        </div>
      </div>
    </motion.div>
  );
}

function StatusIcon({ status }: { status: ChatMessage["status"] }) {
  if (status === "sending") return <Clock size={12} />;
  if (status === "sent") return <Check size={12} />;
  if (status === "delivered") return <CheckCheck size={12} />;
  return <CheckCheck size={12} className="text-accent" />; // read
}
