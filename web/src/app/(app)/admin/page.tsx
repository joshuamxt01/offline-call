"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Users, Smartphone, Wifi, Phone, ScrollText, Activity, Search, Ban, CheckCircle2, ShieldAlert,
  Lock, Trash2, Plus, User, Globe,
} from "lucide-react";
import { adminApi, accessApi } from "@/lib/api/endpoints";
import { useAuthStore } from "@/lib/store/auth";
import { StatTile } from "@/components/dashboard/StatTile";
import { Card, Spinner, Badge, EmptyState, Avatar } from "@/components/ui/misc";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn, formatDay, formatDuration, formatTime } from "@/lib/utils";

type Tab = "overview" | "users" | "devices" | "networks" | "access" | "calls" | "audit";
const tabs: { id: Tab; label: string; icon: typeof Users }[] = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "users", label: "Users", icon: Users },
  { id: "devices", label: "Devices", icon: Smartphone },
  { id: "networks", label: "Networks", icon: Wifi },
  { id: "access", label: "Access", icon: Lock },
  { id: "calls", label: "Calls", icon: Phone },
  { id: "audit", label: "Audit", icon: ScrollText },
];

export default function AdminDashboard() {
  const router = useRouter();
  const role = useAuthStore((s) => s.user?.role);
  const setUserMode = useAuthStore((s) => s.setUserMode);
  const [tab, setTab] = useState<Tab>("overview");

  if (role !== "admin") {
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState icon={<ShieldAlert size={28} />} title="Admins only" description="You don't have permission to view this page." />
      </div>
    );
  }

  return (
    <div className="mx-auto h-full max-w-5xl overflow-y-auto scroll-thin p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Admin dashboard</h1>
          <p className="text-sm text-muted-foreground">Manage users, devices, networks, and monitor the system.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 gap-2"
          onClick={() => { setUserMode(true); router.push("/chats"); }}
        >
          <User size={16} /> Switch to User view
        </Button>
      </div>

      <div className="scroll-thin mt-4 flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              tab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === "overview" && <Overview />}
        {tab === "users" && <UsersTab />}
        {tab === "devices" && <DevicesTab />}
        {tab === "networks" && <NetworksTab />}
        {tab === "access" && <AccessTab />}
        {tab === "calls" && <CallsTab />}
        {tab === "audit" && <AuditTab />}
      </div>
    </div>
  );
}

function Overview() {
  const stats = useQuery({ queryKey: ["admin-stats"], queryFn: adminApi.stats, refetchInterval: 10000 });
  if (stats.isLoading) return <Spinner />;
  const s = stats.data;
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
      <StatTile label="Total users" value={s?.users ?? 0} icon={<Users size={18} />} />
      <StatTile label="Online now" value={s?.onlineUsers ?? 0} icon={<Activity size={18} />} accent="success" hint="last 60s" />
      <StatTile label="Active calls" value={s?.activeCalls ?? 0} icon={<Phone size={18} />} accent="accent" />
      <StatTile label="Devices" value={s?.devices ?? 0} icon={<Smartphone size={18} />} />
      <StatTile label="Messages" value={s?.messages ?? 0} icon={<ScrollText size={18} />} />
      <StatTile label="Calls (total)" value={s?.calls ?? 0} icon={<Phone size={18} />} />
    </div>
  );
}

function UsersTab() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const users = useQuery({ queryKey: ["admin-users", q], queryFn: () => adminApi.users(q) });
  const mut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { status?: string; role?: string } }) =>
      adminApi.updateUser(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  return (
    <div>
      <div className="relative mb-4 max-w-sm">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search users…" className="pl-10" />
      </div>
      {users.isLoading ? (
        <Spinner />
      ) : (
        <Card className="divide-y divide-border">
          {users.data?.map((u) => {
            const networkLabel = (u as { networkLabel?: string }).networkLabel;
            const isOnline = !networkLabel || networkLabel === "Online";
            return (
            <div key={u.id} className="flex items-center gap-3 p-3">
              <Avatar name={u.displayName ?? u.username} size={40} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate font-medium">
                  {u.displayName ?? u.username}
                  {u.role === "admin" && <Badge variant="primary">admin</Badge>}
                  {u.status !== "active" && <Badge variant="danger">{u.status}</Badge>}
                </p>
                <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                  <span className="truncate">@{u.username} · {u.email}</span>
                  {networkLabel && (
                    <span
                      className={
                        "inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium " +
                        (isOnline ? "bg-muted text-muted-foreground" : "bg-accent/15 text-accent")
                      }
                      title={isOnline ? "Registered online (off the office Wi-Fi)" : "Registered on this office network"}
                    >
                      {isOnline ? <Globe size={10} /> : <Wifi size={10} />}
                      {networkLabel}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex gap-1">
                {u.status === "active" ? (
                  <Button size="sm" variant="ghost" onClick={() => mut.mutate({ id: u.id, body: { status: "suspended" } })} aria-label="Suspend">
                    <Ban size={16} className="text-destructive" />
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => mut.mutate({ id: u.id, body: { status: "active" } })} aria-label="Activate">
                    <CheckCircle2 size={16} className="text-success" />
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => mut.mutate({ id: u.id, body: { role: u.role === "admin" ? "user" : "admin" } })}
                >
                  {u.role === "admin" ? "Demote" : "Promote"}
                </Button>
              </div>
            </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}

function DevicesTab() {
  const devices = useQuery({ queryKey: ["admin-devices"], queryFn: adminApi.devices });
  if (devices.isLoading) return <Spinner />;
  return (
    <Card className="divide-y divide-border">
      {devices.data?.map((d) => {
        const meta = d as { ownerUsername?: string | null; networkLabel?: string };
        const networkLabel = meta.networkLabel;
        const isOnline = !networkLabel || networkLabel === "Online";
        return (
        <div key={d.id} className="flex items-center gap-3 p-3 text-sm">
          <Smartphone size={18} className="text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">{d.deviceName ?? "Device"} <Badge>{d.platform}</Badge></p>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="truncate">
                {meta.ownerUsername ? `@${meta.ownerUsername} · ` : ""}Added {formatDay(d.createdAt)}
              </span>
              {networkLabel && (
                <span
                  className={
                    "inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium " +
                    (isOnline ? "bg-muted text-muted-foreground" : "bg-accent/15 text-accent")
                  }
                  title={isOnline ? "Owner registered online (off the office Wi-Fi)" : "Owner registered on this office network"}
                >
                  {isOnline ? <Globe size={10} /> : <Wifi size={10} />}
                  {networkLabel}
                </span>
              )}
            </p>
          </div>
          {d.verified ? <Badge variant="success">verified</Badge> : <Badge variant="danger">unverified</Badge>}
        </div>
        );
      })}
    </Card>
  );
}

function NetworksTab() {
  const networks = useQuery({ queryKey: ["admin-networks"], queryFn: adminApi.networks });
  if (networks.isLoading) return <Spinner />;
  const data = networks.data as Array<{ id: string; label?: string; localIdentifier: string; approved: boolean }>;
  if (!data?.length) return <EmptyState icon={<Wifi size={28} />} title="No networks" description="Approved local networks will appear here." />;
  return (
    <Card className="divide-y divide-border">
      {data.map((n) => (
        <div key={n.id} className="flex items-center gap-3 p-3 text-sm">
          <Wifi size={18} className="text-muted-foreground" />
          <div className="flex-1">
            <p className="font-medium">{n.label ?? n.localIdentifier}</p>
            <p className="text-xs text-muted-foreground">{n.localIdentifier}</p>
          </div>
          {n.approved ? <Badge variant="success">approved</Badge> : <Badge>pending</Badge>}
        </div>
      ))}
    </Card>
  );
}

function CallsTab() {
  const calls = useQuery({ queryKey: ["admin-calls"], queryFn: adminApi.calls });
  if (calls.isLoading) return <Spinner />;
  return (
    <Card className="divide-y divide-border">
      {calls.data?.map((c) => (
        <div key={c.id} className="flex items-center gap-3 p-3 text-sm">
          <Phone size={18} className="text-muted-foreground" />
          <div className="flex-1">
            <p className="font-medium capitalize">{c.type} call · {c.status}</p>
            <p className="text-xs text-muted-foreground">
              {formatDay(c.startedAt)} {formatTime(c.startedAt)} · {formatDuration(c.durationSeconds)}
            </p>
          </div>
          {c.transport && <Badge variant={c.transport === "lan" ? "accent" : "muted"}>{c.transport}</Badge>}
        </div>
      ))}
    </Card>
  );
}

function AccessTab() {
  const qc = useQueryClient();
  const access = useQuery({ queryKey: ["admin-access"], queryFn: accessApi.get });
  const [cidr, setCidr] = useState("");
  const [label, setLabel] = useState("");
  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-access"] });

  const lock = useMutation({ mutationFn: (v: boolean) => accessApi.setLock(v), onSuccess: invalidate });
  const addNet = useMutation({
    mutationFn: (v: { cidr: string; label?: string }) => accessApi.addNetwork(v.cidr, v.label),
    onSuccess: () => { setCidr(""); setLabel(""); invalidate(); },
  });
  const removeNet = useMutation({ mutationFn: (id: string) => accessApi.removeNetwork(id), onSuccess: invalidate });

  if (access.isLoading) return <Spinner />;
  const d = access.data!;
  const myIp = d.yourIp || "";
  const my24 = myIp.match(/^(\d+\.\d+\.\d+)\./)?.[1] ? `${myIp.split(".").slice(0, 3).join(".")}.0/24` : "";

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="flex items-center gap-2 font-semibold"><Lock size={18} /> Network access lock</h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              When ON, only devices on an approved network below can use the app (calls, chat, everything).
              Great for locking a deployment to one office/site Wi‑Fi. Login &amp; this admin page always work.
            </p>
          </div>
          <button
            onClick={() => lock.mutate(!d.enabled)}
            className={cn("relative h-7 w-12 rounded-full transition-colors", d.enabled ? "bg-primary" : "bg-muted-foreground/40")}
            aria-label="Toggle network lock"
          >
            <span className={cn("absolute top-1 h-5 w-5 rounded-full bg-white transition-all", d.enabled ? "left-6" : "left-1")} />
          </button>
        </div>
        <div className="mt-3 rounded-lg bg-muted p-3 text-sm">
          Your current IP: <span className="font-mono">{myIp || "unknown"}</span>
          {my24 && (
            <Button size="sm" variant="secondary" className="ml-3" onClick={() => addNet.mutate({ cidr: my24, label: "My network" })}>
              <Plus size={14} /> Approve my network ({my24})
            </Button>
          )}
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="mb-3 font-semibold">Approved networks</h3>
        <div className="mb-4 flex flex-wrap gap-2">
          <Input value={cidr} onChange={(e) => setCidr(e.target.value)} placeholder="192.168.1.0/24 or 192.168.1.50" className="max-w-[220px]" />
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (e.g. Office Wi‑Fi)" className="max-w-[200px]" />
          <Button onClick={() => cidr && addNet.mutate({ cidr, label: label || undefined })} loading={addNet.isPending}>
            <Plus size={16} /> Add
          </Button>
        </div>
        {d.networks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No approved networks yet. Add one (or approve yours above).</p>
        ) : (
          <ul className="divide-y divide-border">
            {d.networks.map((n) => (
              <li key={n.id} className="flex items-center justify-between py-2">
                <span>
                  <span className="font-mono text-sm">{n.cidr}</span>
                  {n.label && <span className="ml-2 text-sm text-muted-foreground">{n.label}</span>}
                </span>
                <Button size="sm" variant="ghost" onClick={() => removeNet.mutate(n.id)} aria-label="Remove">
                  <Trash2 size={16} className="text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function AuditTab() {
  const audit = useQuery({ queryKey: ["admin-audit"], queryFn: adminApi.audit });
  if (audit.isLoading) return <Spinner />;
  const data = audit.data as Array<{ id: number; action: string; target?: string; createdAt: string }>;
  return (
    <Card className="divide-y divide-border">
      {data?.map((a) => (
        <div key={a.id} className="flex items-center justify-between p-3 text-sm">
          <span className="font-mono text-xs">{a.action}</span>
          <span className="text-xs text-muted-foreground">{formatDay(a.createdAt)} {formatTime(a.createdAt)}</span>
        </div>
      ))}
    </Card>
  );
}
