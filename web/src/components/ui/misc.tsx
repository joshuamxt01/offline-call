"use client";
import { useState, type HTMLAttributes, type ReactNode } from "react";
import { cn, initials } from "@/lib/utils";

/** Public URL that redirects to a user's profile picture (or 404 → initials). */
export function avatarUrl(userId: string, version?: string | null): string {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "";
  return `${base}/api/v1/users/${userId}/avatar${version ? `?v=${version}` : ""}`;
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-lg border border-border bg-card text-card-foreground shadow-sm", className)}
      {...props}
    />
  );
}

export function Badge({
  children,
  variant = "muted",
  className,
}: {
  children: ReactNode;
  variant?: "muted" | "primary" | "success" | "danger" | "accent";
  className?: string;
}) {
  const styles = {
    muted: "bg-muted text-muted-foreground",
    primary: "bg-primary/15 text-primary",
    success: "bg-success/15 text-success",
    danger: "bg-destructive/15 text-destructive",
    accent: "bg-accent/15 text-accent",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        styles[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/40 border-t-primary",
        className,
      )}
    />
  );
}

/**
 * Full-area branded loading animation: a pulsing Nexa mark with a spinning ring
 * and an optional caption. Use for route transitions and first-load states.
 */
export function FullPageLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] w-full flex-1 flex-col items-center justify-center gap-4">
      <div className="relative h-16 w-16">
        <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" />
        <span className="absolute inset-2 flex items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent font-bold text-primary-foreground animate-pulse">
          N
        </span>
      </div>
      {label && <p className="text-sm text-muted-foreground animate-pulse">{label}</p>}
    </div>
  );
}

export function Avatar({
  name,
  src,
  userId,
  avatarVersion,
  size = 44,
  online,
  className,
}: {
  name?: string | null;
  src?: string | null;
  userId?: string | null;
  avatarVersion?: string | null;
  size?: number;
  online?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const url = src ?? (userId ? avatarUrl(userId, avatarVersion) : null);
  const showImg = url && !failed;
  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }}>
      <div
        className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-primary to-accent font-semibold uppercase text-primary-foreground"
        style={{ fontSize: size * 0.4 }}
      >
        {showImg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={name ?? ""}
            onError={() => setFailed(true)}
            className="h-full w-full rounded-full object-cover"
          />
        ) : (
          initials(name)
        )}
      </div>
      {online !== undefined && (
        <span
          className={cn(
            "absolute bottom-0 right-0 block rounded-full border-2 border-card",
            online ? "bg-success" : "bg-muted-foreground/50",
          )}
          style={{ width: size * 0.28, height: size * 0.28 }}
        />
      )}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      {icon && <div className="rounded-full bg-muted p-4 text-muted-foreground">{icon}</div>}
      <div>
        <h3 className="font-semibold text-foreground">{title}</h3>
        {description && <p className="mt-1 max-w-xs text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
