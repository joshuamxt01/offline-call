import type { Socket } from "socket.io";
import { verifyAccessToken } from "../lib/jwt.js";
import type { UserRole } from "@nexa/shared";

export interface SocketData {
  userId: string;
  deviceId: string;
  role: UserRole;
}

/** Socket.IO namespace middleware — authenticates the handshake via JWT. */
export function socketAuth(socket: Socket, next: (err?: Error) => void): void {
  const token =
    (socket.handshake.auth?.accessToken as string | undefined) ??
    socket.handshake.headers.authorization?.replace("Bearer ", "");

  if (!token) return next(new Error("UNAUTHENTICATED"));
  try {
    const claims = verifyAccessToken(token);
    const data: SocketData = { userId: claims.sub, deviceId: claims.did, role: claims.role };
    socket.data = data;
    next();
  } catch {
    next(new Error("UNAUTHENTICATED"));
  }
}
