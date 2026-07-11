"use client";
import { Suspense, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeft, Phone, Video, ShieldCheck } from "lucide-react";
import { useChat } from "@/lib/hooks/useChat";
import { useCall } from "@/lib/webrtc/CallProvider";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { Composer } from "@/components/chat/Composer";
import { Avatar, Spinner } from "@/components/ui/misc";

export default function ChatThreadPage() {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center"><Spinner /></div>}>
      <ChatThread />
    </Suspense>
  );
}

function ChatThread() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const peerId = search.get("peer") ?? undefined;
  const peerName = search.get("name") ?? "Conversation";
  const { startCall } = useCall();

  const { messages, loading, peerTyping, send, sendMedia, notifyTyping, peerId: resolvedPeer } = useChat(
    params.id,
    peerId,
  );
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, peerTyping]);

  const callTarget = resolvedPeer ?? peerId;

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border bg-card px-3 py-2.5">
        <Link href="/chats" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted md:hidden">
          <ArrowLeft size={20} />
        </Link>
        <Avatar name={peerName} size={40} userId={callTarget} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{peerName}</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            {peerTyping ? (
              <span className="text-accent">typing…</span>
            ) : (
              <>
                <ShieldCheck size={12} /> End-to-end encrypted
              </>
            )}
          </p>
        </div>
        <button
          disabled={!callTarget}
          onClick={() => callTarget && startCall(callTarget, peerName, "voice")}
          className="rounded-lg p-2 text-muted-foreground hover:bg-muted disabled:opacity-40"
          aria-label="Voice call"
        >
          <Phone size={20} />
        </button>
        <button
          disabled={!callTarget}
          onClick={() => callTarget && startCall(callTarget, peerName, "video")}
          className="rounded-lg p-2 text-muted-foreground hover:bg-muted disabled:opacity-40"
          aria-label="Video call"
        >
          <Video size={20} />
        </button>
      </header>

      {/* Messages */}
      <div className="scroll-thin flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : (
          messages.map((m) => <MessageBubble key={m.id} message={m} />)
        )}
        {peerTyping && (
          <div className="flex gap-1 px-2 py-1 text-muted-foreground">
            <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:0.15s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:0.3s]" />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <Composer
        onSend={send}
        onSendVoice={(blob, ms) => sendMedia("voice", blob, ms)}
        onSendVideo={(blob, ms) => sendMedia("video", blob, ms)}
        onSendImage={(blob) => sendMedia("image", blob, 0)}
        onTyping={notifyTyping}
      />
    </div>
  );
}
