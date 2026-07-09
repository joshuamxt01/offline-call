"use client";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

export function StatTile({
  label,
  value,
  icon,
  accent = "primary",
  hint,
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  accent?: "primary" | "accent" | "success" | "danger";
  hint?: string;
}) {
  const accents = {
    primary: "text-primary bg-primary/10",
    accent: "text-accent bg-accent/10",
    success: "text-success bg-success/10",
    danger: "text-destructive bg-destructive/10",
  };
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{label}</p>
          {icon && <span className={cn("rounded-lg p-1.5", accents[accent])}>{icon}</span>}
        </div>
        <p className="mt-2 text-3xl font-bold tabular-nums">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </Card>
    </motion.div>
  );
}
