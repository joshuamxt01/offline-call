"use client";
import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserPrivate, DeviceDto } from "@nexa/shared";

interface AuthState {
  user: UserPrivate | null;
  device: DeviceDto | null;
  accessToken: string | null;
  refreshToken: string | null;
  setSession: (s: {
    user: UserPrivate;
    device: DeviceDto;
    accessToken: string;
    refreshToken: string;
  }) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: UserPrivate) => void;
  /** Admins can browse the app as a normal user; this hides admin-only UI. */
  userMode: boolean;
  setUserMode: (v: boolean) => void;
  clear: () => void;
}

/**
 * Auth session for the SPA. Tokens are stored in localStorage and sent as
 * bearer tokens (the backend is stateless bearer-auth). httpOnly cookies would
 * be stronger; documented as a hardening item.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      device: null,
      accessToken: null,
      refreshToken: null,
      setSession: (s) =>
        set({
          user: s.user,
          device: s.device,
          accessToken: s.accessToken,
          refreshToken: s.refreshToken,
        }),
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      setUser: (user) => set({ user }),
      userMode: false,
      setUserMode: (v) => set({ userMode: v }),
      clear: () => set({ user: null, device: null, accessToken: null, refreshToken: null, userMode: false }),
    }),
    {
      name: "nexa-auth",
      partialize: (s) => ({
        user: s.user,
        device: s.device,
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
        userMode: s.userMode,
      }),
    },
  ),
);

/**
 * True once the persisted store has rehydrated from localStorage. Uses zustand's
 * persist API (not a rehydrate callback) so it's reliable regardless of sync vs
 * async rehydration timing. Auth guards must wait for this before redirecting,
 * otherwise they'd bounce a logged-in user to /login on first paint.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    // Catch the case where rehydration already finished before this effect ran.
    if (useAuthStore.persist.hasHydrated()) setHydrated(true);
    const unsub = useAuthStore.persist.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, []);
  return hydrated;
}
