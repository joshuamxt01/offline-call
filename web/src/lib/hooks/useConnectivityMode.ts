"use client";
import { useEffect, useState } from "react";
import { useSocket } from "@/lib/realtime/socket";
import type { ConnectivityMode } from "@nexa/shared";

/**
 * Auto-detects the communication mode for the status badge:
 *   - online:  the cloud backend is reachable (socket connected)
 *   - local:   a network is present but the backend is unreachable
 *              (browsers can't do true mDNS LAN P2P — native Android does)
 *   - offline: no network at all
 * Updates automatically; the user never switches manually.
 */
export function useConnectivityMode(): ConnectivityMode {
  const { connected } = useSocket();
  const [networkUp, setNetworkUp] = useState(true);

  useEffect(() => {
    const on = () => setNetworkUp(true);
    const off = () => setNetworkUp(false);
    setNetworkUp(navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (connected) return "online";
  if (networkUp) return "local";
  return "offline";
}
