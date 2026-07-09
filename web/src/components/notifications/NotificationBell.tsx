"use client";
import { useEffect, useState } from "react";
import { Bell, UserPlus, Check, Phone, MessageSquare, X } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { notificationsApi } from "@/lib/api/endpoints";
import { useSocket } from "@/lib/realtime/socket";
import { ServerEvents, type NotificationDto } from "@nexa/shared";
import { cn, relativeLastSeen } from "@/lib/utils";

const ICONS: Record<string, typeof Bell> = {
  contact_request: UserPlus,
  request_accepted: Check,
  request_rejected: X,
  incoming_call: Phone,
  missed_call: Phone,
  new_message: MessageSquare,
};

const LABELS: Record<string, string> = {
  contact_request: "sent you a contact request",
  request_accepted: "accepted your request",
  request_rejected: "declined your request",
  incoming_call: "called you",
  missed_call: "missed call",
  new_message: "new message",
};

export function NotificationBell({ className }: { className?: string }) {
  const qc = useQueryClient();
  const { socket } = useSocket();
  const [open, setOpen] = useState(false);

  const q = useQuery({
    queryKey: ["notifications"],
    queryFn: notificationsApi.list,
    refetchInterval: 60_000,
  });

  // Live: refetch when a notification arrives.
  useEffect(() => {
    if (!socket) return;
    const onNew = () => qc.invalidateQueries({ queryKey: ["notifications"] });
    socket.on(ServerEvents.NotificationNew, onNew);
    return () => void socket.off(ServerEvents.NotificationNew, onNew);
  }, [socket, qc]);

  const unread = q.data?.unread ?? 0;
  const items = q.data?.data ?? [];

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      await notificationsApi.markAllRead().catch(() => {});
      qc.invalidateQueries({ queryKey: ["notifications"] });
    }
  }

  return (
    <div className="relative">
      <button
        onClick={toggle}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        className={cn("relative grid h-10 w-10 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground", className)}
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="absolute right-0 z-50 mt-2 max-h-96 w-80 overflow-y-auto rounded-xl border border-border bg-popover shadow-xl scroll-thin"
            >
              <div className="border-b border-border px-4 py-2.5 text-sm font-semibold">Notifications</div>
              {items.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {items.map((n: NotificationDto) => {
                    const Icon = ICONS[n.type] ?? Bell;
                    const who = (n.payload?.username as string) ?? "Someone";
                    return (
                      <li key={n.id} className={cn("flex items-start gap-3 px-4 py-3", !n.readAt && "bg-primary/5")}>
                        <span className="mt-0.5 rounded-full bg-muted p-1.5 text-primary">
                          <Icon size={15} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm">
                            <span className="font-medium">@{who}</span> {LABELS[n.type] ?? n.type}
                          </p>
                          <p className="text-xs text-muted-foreground">{relativeLastSeen(n.createdAt)}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
