/**
 * @nexa/shared — the single source of truth for the wire protocol.
 * Imported by backend and web. The Android client mirrors these definitions
 * in mobile/.../data/protocol/ and must be kept in sync with this package.
 *
 * Re-exports are extensionless so every consumer resolves the TS source
 * identically (tsx for the backend, webpack/Next for the web app).
 */
export * from "./events";
export * from "./errors";
export * from "./dto";
export * from "./schemas";
export * from "./lan";
