"use client";
import { useRouter } from "next/navigation";
import { Shield, User } from "lucide-react";
import { useAuthStore } from "@/lib/store/auth";
import { cn } from "@/lib/utils";

/**
 * Lets an admin flip between the Admin experience and the normal User
 * experience without logging out. It's a client-side view toggle only — the
 * backend still enforces the real role on every request.
 */
export function ModeSwitch({ className }: { className?: string }) {
  const router = useRouter();
  const role = useAuthStore((s) => s.user?.role);
  const userMode = useAuthStore((s) => s.userMode);
  const setUserMode = useAuthStore((s) => s.setUserMode);

  if (role !== "admin") return null;

  function toUser() {
    setUserMode(true);
    window.dispatchEvent(new Event("nexa:navigating"));
    router.push("/chats");
  }
  function toAdmin() {
    setUserMode(false);
    window.dispatchEvent(new Event("nexa:navigating"));
    router.push("/admin");
  }

  return (
    <div className={cn("flex items-center gap-1 rounded-lg border border-border bg-muted/50 p-1", className)}>
      <button
        onClick={toAdmin}
        className={cn(
          "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
          !userMode ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
        )}
        aria-pressed={!userMode}
      >
        <Shield size={14} /> Admin
      </button>
      <button
        onClick={toUser}
        className={cn(
          "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
          userMode ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
        )}
        aria-pressed={userMode}
      >
        <User size={14} /> User
      </button>
    </div>
  );
}
