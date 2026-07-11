"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search, UserPlus, Phone, Video, MessageSquare, Check, X, Users, Star, Ban, Trash2, MoreVertical, Clock,
} from "lucide-react";
import { contactsApi, usersApi, conversationsApi } from "@/lib/api/endpoints";
import { useSocket } from "@/lib/realtime/socket";
import { ServerEvents, type UserPublic, type ContactDto, type PresenceState } from "@nexa/shared";
import { Avatar, EmptyState, Badge, Spinner, FullPageLoader } from "@/components/ui/misc";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useCall } from "@/lib/webrtc/CallProvider";
import { cn, relativeLastSeen } from "@/lib/utils";

const PRESENCE: Record<PresenceState, { label: string; color: string }> = {
  online: { label: "Online", color: "bg-success" },
  local: { label: "Local Network", color: "bg-blue-500" },
  busy: { label: "Busy", color: "bg-amber-500" },
  in_call: { label: "In a call", color: "bg-primary" },
  away: { label: "Away", color: "bg-muted-foreground" },
  offline: { label: "Offline", color: "bg-muted-foreground/40" },
};

export default function ContactsPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const { socket } = useSocket();
  const { startCall } = useCall();
  const [query, setQuery] = useState("");

  const contacts = useQuery({ queryKey: ["contacts"], queryFn: contactsApi.list });

  useEffect(() => {
    if (!socket) return;
    const refresh = () => qc.invalidateQueries({ queryKey: ["contacts"] });
    socket.on(ServerEvents.PresenceUpdate, refresh);
    return () => void socket.off(ServerEvents.PresenceUpdate, refresh);
  }, [socket, qc]);

  const search = useQuery({
    queryKey: ["user-search", query],
    queryFn: () => usersApi.search(query),
    enabled: query.trim().length >= 2,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["contacts"] });
  const add = useMutation({ mutationFn: (id: string) => contactsApi.add(id), onSuccess: () => { setQuery(""); invalidate(); } });
  const respond = useMutation({ mutationFn: (v: { id: string; accept: boolean }) => contactsApi.respond(v.id, v.accept), onSuccess: invalidate });
  const cancel = useMutation({ mutationFn: (id: string) => contactsApi.cancel(id), onSuccess: invalidate });
  const fav = useMutation({ mutationFn: (v: { id: string; favorite: boolean }) => contactsApi.update(v.id, { favorite: v.favorite }), onSuccess: invalidate });
  const block = useMutation({ mutationFn: (userId: string) => contactsApi.block(userId), onSuccess: invalidate });
  const remove = useMutation({ mutationFn: (id: string) => contactsApi.remove(id), onSuccess: invalidate });

  const existingIds = useMemo(() => new Set(contacts.data?.map((c) => c.user.id)), [contacts.data]);

  const all = contacts.data ?? [];
  const incoming = all.filter((c) => c.state === "pending" && c.incoming);
  const sent = all.filter((c) => c.state === "pending" && !c.incoming);
  const accepted = all.filter((c) => c.state === "accepted");
  const favorites = accepted.filter((c) => c.favorite);

  async function openChat(userId: string) {
    const convId = await conversationsApi.getOrCreateDirect(userId);
    router.push(`/chats/${convId}?peer=${userId}`);
  }

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col">
      <header className="border-b border-border px-5 py-4">
        <h1 className="text-xl font-bold">Contacts</h1>
        <div className="relative mt-3">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search people by username…" className="pl-10" />
        </div>
      </header>

      <div className="scroll-thin flex-1 overflow-y-auto px-3 py-3">
        {/* Search results */}
        {query.trim().length >= 2 && (
          <Section title="Search results">
            {search.isLoading ? (
              <div className="flex justify-center py-6"><Spinner /></div>
            ) : search.data?.length ? (
              search.data.map((u: UserPublic) => (
                <Row key={u.id} name={u.displayName ?? u.username} sub={`@${u.username}`}>
                  {existingIds.has(u.id) ? (
                    <Badge>Added</Badge>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => add.mutate(u.id)} loading={add.isPending}>
                      <UserPlus size={16} /> Add
                    </Button>
                  )}
                </Row>
              ))
            ) : (
              <p className="px-3 py-4 text-sm text-muted-foreground">No users found. Private users don&apos;t appear in search.</p>
            )}
          </Section>
        )}

        {/* Incoming requests */}
        {incoming.length > 0 && (
          <Section title={`Requests (${incoming.length})`}>
            {incoming.map((c) => (
              <Row key={c.id} name={c.user.displayName ?? c.user.username} sub={`@${c.user.username} · wants to connect`}>
                <Button size="sm" variant="success" onClick={() => respond.mutate({ id: c.id, accept: true })} aria-label="Accept"><Check size={16} /></Button>
                <Button size="sm" variant="ghost" onClick={() => respond.mutate({ id: c.id, accept: false })} aria-label="Reject"><X size={16} /></Button>
              </Row>
            ))}
          </Section>
        )}

        {/* Sent requests */}
        {sent.length > 0 && (
          <Section title={`Sent (${sent.length})`}>
            {sent.map((c) => (
              <Row key={c.id} name={c.user.displayName ?? c.user.username} sub={`@${c.user.username} · pending`}>
                <span className="text-xs text-muted-foreground"><Clock size={14} className="inline" /></span>
                <Button size="sm" variant="ghost" onClick={() => cancel.mutate(c.id)}>Cancel</Button>
              </Row>
            ))}
          </Section>
        )}

        {/* Favorites */}
        {favorites.length > 0 && (
          <Section title="Favorites">
            {favorites.map((c) => (
              <ContactRow key={c.id} c={c} onChat={openChat} startCall={startCall} fav={fav} block={block} remove={remove} />
            ))}
          </Section>
        )}

        {/* All contacts */}
        <Section title="My contacts">
          {contacts.isLoading ? (
            <FullPageLoader label="Loading contacts…" />
          ) : accepted.length ? (
            accepted.map((c) => (
              <ContactRow key={c.id} c={c} onChat={openChat} startCall={startCall} fav={fav} block={block} remove={remove} />
            ))
          ) : (
            <EmptyState icon={<Users size={28} />} title="No contacts yet" description="Search for people by username above and send a request." />
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4">
      <p className="px-2 pb-1 text-xs font-semibold uppercase text-muted-foreground">{title}</p>
      {children}
    </section>
  );
}

function Row({ name, sub, online, presence, children }: { name: string; sub: string; online?: boolean; presence?: PresenceState; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/60">
      <div className="relative">
        <Avatar name={name} size={44} online={online} />
        {presence && <span className={cn("absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card", PRESENCE[presence].color)} />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{name}</p>
        <p className="truncate text-sm text-muted-foreground">{sub}</p>
      </div>
      <div className="flex items-center gap-1">{children}</div>
    </div>
  );
}

function ContactRow({
  c, onChat, startCall, fav, block, remove,
}: {
  c: ContactDto;
  onChat: (id: string) => void;
  startCall: (id: string, name: string, type: "voice" | "video") => void;
  fav: { mutate: (v: { id: string; favorite: boolean }) => void };
  block: { mutate: (userId: string) => void };
  remove: { mutate: (id: string) => void };
}) {
  const [menu, setMenu] = useState(false);
  const name = c.user.displayName ?? c.user.username;
  const sub = c.presence === "online" ? "Online" : c.presence === "offline" ? relativeLastSeen(c.lastSeen) : PRESENCE[c.presence].label;

  return (
    <Row name={name} sub={sub} presence={c.presence}>
      <button onClick={() => fav.mutate({ id: c.id, favorite: !c.favorite })} aria-label="Favorite" className="p-1.5">
        <Star size={18} className={cn(c.favorite ? "fill-amber-400 text-amber-400" : "text-muted-foreground")} />
      </button>
      <Button size="sm" variant="ghost" onClick={() => onChat(c.user.id)} aria-label="Message"><MessageSquare size={18} /></Button>
      <Button size="sm" variant="ghost" onClick={() => startCall(c.user.id, name, "voice")} aria-label="Voice call"><Phone size={18} /></Button>
      <Button size="sm" variant="ghost" onClick={() => startCall(c.user.id, name, "video")} aria-label="Video call"><Video size={18} /></Button>
      <div className="relative">
        <button onClick={() => setMenu((v) => !v)} aria-label="More" className="p-1.5 text-muted-foreground hover:text-foreground"><MoreVertical size={18} /></button>
        {menu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
            <div className="absolute right-0 z-50 mt-1 w-40 overflow-hidden rounded-lg border border-border bg-popover shadow-xl">
              <button onClick={() => { setMenu(false); remove.mutate(c.id); }} className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted">
                <Trash2 size={15} /> Remove
              </button>
              <button onClick={() => { setMenu(false); block.mutate(c.user.id); }} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-muted">
                <Ban size={15} /> Block
              </button>
            </div>
          </>
        )}
      </div>
    </Row>
  );
}
