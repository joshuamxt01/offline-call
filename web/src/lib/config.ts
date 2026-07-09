export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
export const API_BASE = `${API_URL}/api/v1`;
export const RT_URL = API_URL; // Socket.IO connects to the same origin, /rt namespace
