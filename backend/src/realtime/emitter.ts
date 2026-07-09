import type { Server } from "socket.io";

/**
 * Holds the Socket.IO server reference so REST modules (e.g. message fallback,
 * contact requests) can push realtime events without importing the io bootstrap
 * (avoids circular imports). Set once at startup.
 */
let io: Server | null = null;

export function setIo(server: Server): void {
  io = server;
}

export function userRoom(userId: string): string {
  return `user:${userId}`;
}
export function deviceRoom(deviceId: string): string {
  return `device:${deviceId}`;
}

export function emitToUser(userId: string, event: string, payload: unknown): void {
  io?.of("/rt").to(userRoom(userId)).emit(event, payload);
}

export function emitToDevice(deviceId: string, event: string, payload: unknown): void {
  io?.of("/rt").to(deviceRoom(deviceId)).emit(event, payload);
}

export function emitToUsers(userIds: string[], event: string, payload: unknown): void {
  if (!io) return;
  const rooms = userIds.map(userRoom);
  io.of("/rt").to(rooms).emit(event, payload);
}
