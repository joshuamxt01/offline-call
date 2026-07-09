/** Canonical error codes shared by REST + realtime. */
export const ErrorCodes = {
  VALIDATION: "VALIDATION",
  UNAUTHENTICATED: "UNAUTHENTICATED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",
  DEVICE_UNVERIFIED: "DEVICE_UNVERIFIED",
  TOKEN_REUSE: "TOKEN_REUSE",
  INTERNAL: "INTERNAL",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export interface ApiError {
  error: {
    code: ErrorCode | string;
    message: string;
    details?: unknown;
    retryAfter?: number;
  };
}
