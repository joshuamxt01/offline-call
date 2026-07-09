import { ErrorCodes, type ErrorCode } from "@nexa/shared";

/** Typed application error mapped to an HTTP status + wire error code. */
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: ErrorCode | string,
    message: string,
    public details?: unknown,
    public retryAfter?: number,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const Errors = {
  validation: (details?: unknown) =>
    new HttpError(400, ErrorCodes.VALIDATION, "Validation failed", details),
  unauthenticated: (msg = "Authentication required") =>
    new HttpError(401, ErrorCodes.UNAUTHENTICATED, msg),
  forbidden: (msg = "Forbidden") => new HttpError(403, ErrorCodes.FORBIDDEN, msg),
  notFound: (msg = "Not found") => new HttpError(404, ErrorCodes.NOT_FOUND, msg),
  conflict: (msg = "Conflict") => new HttpError(409, ErrorCodes.CONFLICT, msg),
  deviceUnverified: () =>
    new HttpError(403, ErrorCodes.DEVICE_UNVERIFIED, "Device is not verified"),
  tokenReuse: () =>
    new HttpError(401, ErrorCodes.TOKEN_REUSE, "Refresh token reuse detected"),
  rateLimited: (retryAfter: number) =>
    new HttpError(429, ErrorCodes.RATE_LIMITED, "Too many requests", undefined, retryAfter),
  internal: (msg = "Internal server error") =>
    new HttpError(500, ErrorCodes.INTERNAL, msg),
};
