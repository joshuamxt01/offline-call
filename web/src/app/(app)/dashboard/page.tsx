"use client";
import { useQuery } from "@tanstack/react-query";
import { Phone, MessageSquare, Smartphone, Users, Clock, Mic } from "lucide-react";
import { callsApi, devicesApi, contactsApi } from "@/lib/api/endpoints";
import { useAuthStore } from "@/lib/store/auth";
import { StatTile } from "@/components/dashboard/StatTile";
import { Card, Avatar, Spinner, Badge } from "@/components/ui/misc";
import { formatDay, formatDuration, formatTime } from "@/lib/utils";

export default function UserDashboard() {
  const { user } = useAuthStore();
  const calls = useQuery({ queryKey: ["calls"], queryFn: callsApi.history });
  const devices = useQuery({ queryKey: ["devices"], queryFn: devicesApi.list });
  const contacts = useQuery({ queryKey: ["contacts"], queryFn: contactsApi.list });

  const totalCallSeconds = calls.data?.reduce((a, c) => a + (c.durationSeconds ?? 0), 0) ?? 0;

  return (
    <div className="mx-auto h-full max-w-4xl overflow-y-auto scroll-thin p-5">
      <div className="mb-6 flex items-center gap-4">
        <Avatar name={user?.displayName ?? user?.username} size={56} />
        <div>
          <h1 className="text-2xl font-bold">Welcome, {user?.displayName ?? user?.username}</h1>
          <p className="text-sm text-muted-foreground">Your Nexa activity at a glance.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Contacts" value={contacts.data?.filter((c) => c.state === "accepted").length ?? 0} icon={<Users size={18} />} />
        <StatTile label="Total calls" value={calls.data?.length ?? 0} icon={<Phone size={18} />} accent="accent" />
        <StatTile label="Talk time" value={formatDuration(totalCallSeconds)} icon={<Clock size={18} />} accent="success" />
        <StatTile label="Devices" value={devices.data?.length ?? 0} icon={<Smartphone size={18} />} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Recent calls */}
        <Card className="p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold"><Phone size={18} /> Recent calls</h2>
          {calls.isLoading ? (
            <Spinner />
          ) : calls.data?.length ? (
            <ul className="space-y-2">
              {calls.data.slice(0, 6).map((c) => (
                <li key={c.id} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Badge variant={c.status === "missed" ? "danger" : "muted"}>{c.type}</Badge>
                    {formatDay(c.startedAt)} {formatTime(c.startedAt)}
                  </span>
                  <span className="text-muted-foreground">{formatDuration(c.durationSeconds)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No calls yet.</p>
          )}
        </Card>

        {/* Media / recordings */}
        <Card className="p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold"><Mic size={18} /> Voice & video notes</h2>
          <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-muted-foreground">
            <MessageSquare className="text-muted-foreground/60" />
            Recordings you send appear here. Capture voice/video notes from any chat.
          </div>
        </Card>
      </div>
    </div>
  );
}
