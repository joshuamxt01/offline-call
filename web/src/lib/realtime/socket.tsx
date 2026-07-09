"use client";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { io, type Socket } from "socket.io-client";
import { RT_URL } from "../config";
import { RT_NAMESPACE, ClientEvents } from "@nexa/shared";
import { useAuthStore } from "../store/auth";

interface SocketCtx {
  socket: Socket | null;
  connected: boolean;
}
const Ctx = createContext<SocketCtx>({ socket: null, connected: false });

/**
 * Maintains one authenticated Socket.IO connection to the /rt namespace for the
 * whole app: presence heartbeats, message delivery, and call signaling.
 */
export function SocketProvider({ children }: { children: ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!accessToken) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setConnected(false);
      return;
    }

    const socket = io(`${RT_URL}${RT_NAMESPACE}`, {
      auth: { accessToken },
      transports: ["websocket"],
      reconnection: true,
    });
    socketRef.current = socket;

    let heartbeat: ReturnType<typeof setInterval>;
    socket.on("connect", () => {
      setConnected(true);
      socket.emit(ClientEvents.PresenceHeartbeat);
      heartbeat = setInterval(() => socket.emit(ClientEvents.PresenceHeartbeat), 25_000);
    });
    socket.on("disconnect", () => {
      setConnected(false);
      clearInterval(heartbeat);
    });

    return () => {
      clearInterval(heartbeat);
      socket.disconnect();
    };
  }, [accessToken]);

  return <Ctx.Provider value={{ socket: socketRef.current, connected }}>{children}</Ctx.Provider>;
}

export function useSocket(): SocketCtx {
  return useContext(Ctx);
}
