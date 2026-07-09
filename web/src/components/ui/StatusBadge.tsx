"use client";
import { motion } from "framer-motion";
import { useConnectivityMode } from "@/lib/hooks/useConnectivityMode";
import { cn } from "@/lib/utils";

const MODES = {
  online: { label: "Online Mode", emoji: "🟢", dot: "bg-success", text: "text-success", ring: "bg-success/12" },
  local: { label: "Local Mode", emoji: "🔵", dot: "bg-blue-500", text: "text-blue-500", ring: "bg-blue-500/12" },
  offline: { label: "Offline", emoji: "🔴", dot: "bg-destructive", text: "text-destructive", ring: "bg-destructive/12" },
} as const;

export function StatusBadge({ compact = false, className }: { compact?: boolean; className?: string }) {
  const mode = useConnectivityMode();
  const m = MODES[mode];
  return (
    <motion.div
      key={mode}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        m.ring,
        m.text,
        className,
      )}
      title={m.label}
      aria-label={`Communication mode: ${m.label}`}
      role="status"
    >
      <span className={cn("relative flex h-2 w-2")}>
        {mode === "online" && (
          <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", m.dot)} />
        )}
        <span className={cn("relative inline-flex h-2 w-2 rounded-full", m.dot)} />
      </span>
      {!compact && m.label}
    </motion.div>
  );
}
