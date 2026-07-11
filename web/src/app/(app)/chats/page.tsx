"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { MessageSquarePlus, MessagesSquare } from "lucide-react";
import { conversationsApi } from "@/lib/api/endpoints";
import { useAuthStore } from "@/lib/store/auth";
import { Avatar, EmptyState, Badge, FullPageLoader } from "@/components/ui/misc";
import { Button } from "@/components/ui/Button";
import { formatDay } from "@/lib/utils";

export default function ChatsPage() {
  const myId = useAuthStore((s) => s.user?.id);
  const convos = useQuery({ queryKey: ["conversations"], queryFn: conversationsApi.list, refetchInterval: 20000 });

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col">
      <header className="flex items-center justify-between border-b border-border px-5 py-4">
        <h1 className="text-xl font-bold">Chats</h1>
        <Link href="/contacts">
          <Button size="sm" variant="secondary"><MessageSquarePlus size={16} /> New</Button>
        </Link>
      </header>

      <div className="scroll-thin flex-1 overflow-y-auto">
        {convos.isLoading ? (
          <FullPageLoader label="Loading chats…" />
        ) : convos.data?.length ? (
          <ul className="divide-y divide-border">
            {convos.data.map((c) => {
              const peer = c.participants[0];
              const name = peer?.displayName ?? peer?.username ?? "Conversation";
              return (
                <li key={c.id}>
                  <Link
                    href={`/chats/${c.id}?peer=${peer?.id ?? ""}&name=${encodeURIComponent(name)}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60"
                  >
                    <Avatar name={name} size={50} userId={peer?.id} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate font-medium">{name}</p>
                        {c.lastMessage && (
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {formatDay(c.lastMessage.serverCreatedAt)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm text-muted-foreground">
                          {c.lastMessage
                            ? c.lastMessage.senderId === myId
                              ? "You: 🔒 message"
                              : "🔒 Encrypted message"
                            : "Say hello 👋"}
                        </p>
                        {c.unread > 0 && <Badge variant="primary">{c.unread}</Badge>}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            icon={<MessagesSquare size={28} />}
            title="No conversations yet"
            description="Start a chat from your contacts — messages are end-to-end encrypted."
            action={
              <Link href="/contacts">
                <Button variant="secondary">Go to contacts</Button>
              </Link>
            }
          />
        )}
      </div>
    </div>
  );
}
