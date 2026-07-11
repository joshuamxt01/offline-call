"use client";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LogOut, Smartphone, Trash2, ShieldCheck, Monitor, Globe, Lock, Users } from "lucide-react";
import type { UserPrivacy } from "@nexa/shared";
import { devicesApi, usersApi } from "@/lib/api/endpoints";
import { uploadAvatar } from "@/lib/media/mediaClient";
import { useAuthStore } from "@/lib/store/auth";
import { useAuthActions } from "@/lib/hooks/useAuthActions";
import { getIdentity } from "@/lib/crypto/e2ee";
import { Card, Avatar, Spinner, Badge } from "@/components/ui/misc";
import { Button } from "@/components/ui/Button";
import { Input, Field, Textarea } from "@/components/ui/Input";
import { RingtoneSettings } from "@/components/settings/RingtoneSettings";
import { formatDay } from "@/lib/utils";

export default function SettingsPage() {
  const qc = useQueryClient();
  const { user, device, setUser } = useAuthStore();
  const { logout } = useAuthActions();

  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [privacy, setPrivacy] = useState<UserPrivacy>(user?.privacy ?? "public");
  const [statusKind, setStatusKind] = useState<string>(user?.statusKind ?? "available");
  const [statusMessage, setStatusMessage] = useState(user?.statusMessage ?? "");
  const [fingerprint, setFingerprint] = useState<string>("");

  useEffect(() => {
    getIdentity().then((id) => {
      if (id) setFingerprint(id.publicKey.slice(0, 32));
    });
  }, []);

  const devices = useQuery({ queryKey: ["devices"], queryFn: devicesApi.list });

  const saveProfile = useMutation({
    mutationFn: () => usersApi.updateProfile({ displayName, bio }),
    onSuccess: (u) => setUser(u),
  });

  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarVersion, setAvatarVersion] = useState<string | null>(user?.avatarObjectId ?? null);
  const changeAvatar = useMutation({
    mutationFn: async (file: File) => {
      const objectId = await uploadAvatar(file);
      return usersApi.updateProfile({ avatarObjectId: objectId });
    },
    onSuccess: (u) => {
      setUser(u);
      setAvatarVersion(u.avatarObjectId ?? String(Date.now()));
    },
  });
  const setAvatarPrivacy = useMutation({
    mutationFn: (v: "public" | "contacts_only") => usersApi.updateProfile({ avatarPrivacy: v }),
    onSuccess: (u) => setUser(u),
  });

  const savePrivacy = useMutation({
    mutationFn: () => usersApi.updateProfile({ privacy, statusKind, statusMessage: statusMessage || null }),
    onSuccess: (u) => setUser(u),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => devicesApi.revoke(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["devices"] }),
  });

  return (
    <div className="mx-auto h-full max-w-2xl overflow-y-auto scroll-thin">
      <header className="border-b border-border px-5 py-4">
        <h1 className="text-xl font-bold">Settings</h1>
      </header>

      <div className="space-y-6 p-5">
        {/* Profile */}
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-4">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) changeAvatar.mutate(f);
                e.target.value = "";
              }}
            />
            <button onClick={() => fileRef.current?.click()} className="relative shrink-0" aria-label="Change photo">
              <Avatar name={displayName || user?.username} size={64} userId={user?.id} avatarVersion={avatarVersion} />
              {changeAvatar.isPending && (
                <span className="absolute inset-0 grid place-items-center rounded-full bg-black/40">
                  <Spinner />
                </span>
              )}
            </button>
            <div>
              <h2 className="font-semibold">{user?.displayName ?? user?.username}</h2>
              <p className="text-sm text-muted-foreground">@{user?.username}</p>
              <button onClick={() => fileRef.current?.click()} className="text-sm text-primary hover:underline">
                Change photo
              </button>
            </div>
          </div>
          <label className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Only contacts can see my photo</p>
              <p className="text-xs text-muted-foreground">When off, your profile picture is public.</p>
            </div>
            <input
              type="checkbox"
              className="h-5 w-5 accent-primary"
              checked={user?.avatarPrivacy === "contacts_only"}
              onChange={(e) => setAvatarPrivacy.mutate(e.target.checked ? "contacts_only" : "public")}
            />
          </label>
          <div className="space-y-4">
            <Field label="Display name" htmlFor="dn">
              <Input id="dn" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </Field>
            <Field label="Bio" htmlFor="bio">
              <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={3} placeholder="A short bio…" />
            </Field>
            <Button onClick={() => saveProfile.mutate()} loading={saveProfile.isPending}>
              Save profile
            </Button>
          </div>
        </Card>

        {/* Privacy & status */}
        <Card className="p-5">
          <h2 className="mb-1 flex items-center gap-2 font-semibold">
            <Lock size={18} className="text-primary" /> Privacy &amp; status
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">Control who can find and contact you.</p>

          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium">Who can find me</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { v: "public", label: "Public", icon: Globe, hint: "Searchable" },
                  { v: "contacts_only", label: "Contacts", icon: Users, hint: "Approved only" },
                  { v: "private", label: "Private", icon: Lock, hint: "Hidden" },
                ] as const).map((opt) => {
                  const active = privacy === opt.v;
                  return (
                    <button
                      key={opt.v}
                      onClick={() => setPrivacy(opt.v)}
                      className={
                        "flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition-colors " +
                        (active ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted")
                      }
                    >
                      <opt.icon size={18} />
                      <span className="text-sm font-medium">{opt.label}</span>
                      <span className="text-[11px] text-muted-foreground">{opt.hint}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <Field label="Availability" htmlFor="sk">
              <select
                id="sk"
                value={statusKind}
                onChange={(e) => setStatusKind(e.target.value)}
                className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
              >
                <option value="available">🟢 Available</option>
                <option value="busy">⛔ Busy</option>
                <option value="in_meeting">📅 In a meeting</option>
                <option value="at_work">💼 At work</option>
                <option value="away">🌙 Away</option>
                <option value="dnd">🔕 Do not disturb</option>
                <option value="custom">✨ Custom</option>
              </select>
            </Field>

            <Field label="Status message" htmlFor="sm" hint="Shown to people who can see your profile.">
              <Input id="sm" value={statusMessage} onChange={(e) => setStatusMessage(e.target.value)} placeholder="e.g. Working from home" maxLength={120} />
            </Field>

            <Button onClick={() => savePrivacy.mutate()} loading={savePrivacy.isPending}>
              Save privacy &amp; status
            </Button>
          </div>
        </Card>

        {/* Ringtone */}
        <RingtoneSettings />

        {/* Security */}
        <Card className="p-5">
          <h2 className="mb-1 flex items-center gap-2 font-semibold">
            <ShieldCheck size={18} className="text-accent" /> Security
          </h2>
          <p className="text-sm text-muted-foreground">
            Your messages are end-to-end encrypted with a key that never leaves this device.
          </p>
          <div className="mt-3 rounded-lg bg-muted p-3">
            <p className="text-xs text-muted-foreground">Identity key fingerprint</p>
            <p className="mt-1 break-all font-mono text-sm">{fingerprint || "…"}</p>
          </div>
        </Card>

        {/* Devices */}
        <Card className="p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <Smartphone size={18} /> Connected devices
          </h2>
          {devices.isLoading ? (
            <div className="flex justify-center py-6"><Spinner /></div>
          ) : (
            <ul className="space-y-2">
              {devices.data?.map((d) => (
                <li key={d.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                  {d.platform === "web" ? <Monitor size={20} /> : <Smartphone size={20} />}
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-sm font-medium">
                      {d.deviceName ?? "Device"}
                      {d.id === device?.id && <Badge variant="primary">This device</Badge>}
                      {!d.verified && <Badge variant="danger">Unverified</Badge>}
                    </p>
                    <p className="text-xs text-muted-foreground">Added {formatDay(d.createdAt)}</p>
                  </div>
                  {d.id !== device?.id && (
                    <Button size="sm" variant="ghost" onClick={() => revoke.mutate(d.id)} aria-label="Revoke">
                      <Trash2 size={16} className="text-destructive" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Button variant="danger" className="w-full" onClick={logout}>
          <LogOut size={18} /> Log out
        </Button>
      </div>
    </div>
  );
}
