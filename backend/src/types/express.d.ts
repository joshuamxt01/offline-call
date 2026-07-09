import type { UserRole } from "@nexa/shared";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        deviceId: string;
        role: UserRole;
      };
    }
  }
}

export {};
