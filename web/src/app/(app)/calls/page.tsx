"use client";
import { useQuery } from "@tanstack/react-query";
import { PhoneIncoming, PhoneOutgoing, PhoneMissed, Video, Phone as PhoneIcon } from "lucide-react";
import { callsApi } from "@/lib/api/endpoints";
import { useAuthStore } from "@/lib/store/auth";
import { EmptyState, FullPageLoader, Badge } from "@/components/ui/misc";
import { formatDay, formatDuration, formatTime } from "@/lib/utils";
import type { CallDto } from "@nexa/shared";

export default function CallsPage() {
  const myId = useAuthStore((s) => s.user?.id);
  const calls = useQuery({ queryKey: ["calls"], queryFn: callsApi.history });

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col">
      <header className="border-b border-border px-5 py-4">
        <h1 className="text-xl font-bold">Calls</h1>
      </header>

      <div className="scroll-thin flex-1 overflow-y-auto">
        {calls.isLoading ? (
          <FullPageLoader label="Loading calls…" />
        ) : calls.data?.length ? (
          <ul className="divide-y divide-border">
            {calls.data.map((c) => (
              <CallRow key={c.id} call={c} outgoing={c.callerId === myId} />
            ))}
          </ul>
        ) : (
          <EmptyState icon={<PhoneIcon size={28} />} title="No calls yet" description="Your voice and video call history will appear here." />
        )}
      </div>
    </div>
  );
}

function CallRow({ call, outgoing }: { call: CallDto; outgoing: boolean }) {
  const missed = call.status === "missed" || call.status === "rejected";
  const Icon = missed ? PhoneMissed : outgoing ? PhoneOutgoing : PhoneIncoming;
  const color = missed ? "text-destructive" : outgoing ? "text-accent" : "text-success";

  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <div className={`rounded-full bg-muted p-2 ${color}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 font-medium">
          {call.type === "video" ? <Video size={15} /> : <PhoneIcon size={15} />}
          {outgoing ? "Outgoing" : "Incoming"} {call.type} call
          {call.transport && <Badge variant={call.transport === "lan" ? "accent" : "muted"}>{call.transport}</Badge>}
        </p>
        <p className="text-sm text-muted-foreground">
          {formatDay(call.startedAt)} · {formatTime(call.startedAt)}
          {call.durationSeconds ? ` · ${formatDuration(call.durationSeconds)}` : ""}
        </p>
      </div>
    </li>
  );
}
