"use client";
import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuthStore, useHydrated } from "@/lib/store/auth";
import { useSocket } from "@/lib/realtime/socket";
import { navItems } from "@/components/layout/navItems";
import { ModeSwitch } from "@/components/layout/ModeSwitch";
import { CallOverlay } from "@/components/call/CallOverlay";
import { CallRinger } from "@/components/call/CallRinger";
import { UpdateToast } from "@/components/system/UpdateToast";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { Avatar, Spinner } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, accessToken, userMode } = useAuthStore();
  const hydrated = useHydrated();
  const { connected } = useSocket();

  useEffect(() => {
    if (hydrated && !accessToken) router.replace("/login");
  }, [hydrated, accessToken, router]);

  if (!hydrated || !accessToken) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  const isAdmin = user?.role === "admin";
  // An admin can browse "as a user" — that hides admin-only nav until they switch back.
  const effectiveAdmin = isAdmin && !userMode;
  const items = navItems.filter((i) => !i.adminOnly || effectiveAdmin);

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card md:flex">
        <div className="px-5 py-5">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground font-bold">
              N
            </div>
            <span className="text-lg font-bold">Nexa</span>
            <NotificationBell className="ml-auto" />
          </div>
          <StatusBadge className="mt-3" />
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {items.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-lg bg-primary/10"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <item.icon size={20} className="relative" />
                <span className="relative">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {isAdmin && <ModeSwitch className="mx-3 mb-1" />}
        <div className="flex items-center gap-3 border-t border-border p-3">
          <Avatar name={user?.displayName ?? user?.username} size={40} online={connected} userId={user?.id} avatarVersion={user?.avatarObjectId} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user?.displayName ?? user?.username}</p>
            <p className="truncate text-xs text-muted-foreground">@{user?.username}</p>
          </div>
          <ThemeToggle />
        </div>
      </aside>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top strip: mode badge + notifications (sidebar is hidden on mobile) */}
        <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2 md:hidden">
          <StatusBadge compact={false} />
          <NotificationBell />
        </div>
        {/* Admin browsing "as a user" — always offer a one-tap way back. */}
        {isAdmin && userMode && (
          <button
            onClick={() => useAuthStore.getState().setUserMode(false)}
            className="flex w-full items-center justify-center gap-2 bg-primary/10 px-4 py-2 text-xs font-medium text-primary hover:bg-primary/15"
          >
            You&apos;re viewing as a user — tap to switch back to Admin
          </button>
        )}
        {isAdmin && <ModeSwitch className="m-3 md:hidden" />}
        <main className="flex-1 overflow-hidden">{children}</main>

        {/* Mobile bottom nav */}
        <nav className="grid grid-cols-4 border-t border-border bg-card md:hidden">
          {items
            .filter((i) => !i.desktopOnly)
            .map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2.5 text-xs",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <item.icon size={22} />
                  {item.label}
                </Link>
              );
            })}
        </nav>
      </div>

      <CallOverlay />
      <CallRinger />
      <UpdateToast />
    </div>
  );
}
