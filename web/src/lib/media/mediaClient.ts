"use client";
import { mediaApi } from "@/lib/api/endpoints";
import { encryptBytes, decryptBytes } from "@/lib/crypto/media";

export interface MediaEnvelope {
  v: 1;
  mediaObjectId: string;
  key: string; // base64 secretbox key
  nonce: string; // base64
  mimeType: string;
  durationMs: number;
  kind: "voice" | "video" | "image" | "file";
}

/** Encrypt a recorded blob, upload the ciphertext to B2, commit, and return the
 *  envelope the recipient needs to fetch + decrypt + play it. */
export async function uploadEncryptedMedia(
  blob: Blob,
  kind: "voice" | "video" | "image" | "file",
  durationMs: number,
): Promise<MediaEnvelope> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const enc = await encryptBytes(bytes);

  const { objectId, uploadUrl, headers } = await mediaApi.uploadUrl({
    kind: kind === "voice" ? "voice_note" : kind === "video" ? "video_note" : kind,
    contentType: "application/octet-stream", // encrypted bytes are opaque
    sizeBytes: enc.cipher.length,
    durationMs,
  });

  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers,
    body: enc.cipher as BodyInit,
  });
  if (!res.ok) throw new Error(`upload failed: ${res.status}`);
  await mediaApi.commit(objectId);

  return { v: 1, mediaObjectId: objectId, key: enc.key, nonce: enc.nonce, mimeType: blob.type, durationMs, kind };
}

// Cache decrypted object URLs so we don't re-download on every render.
const urlCache = new Map<string, string>();

/** Download the encrypted blob from B2, decrypt it, and return a playable URL. */
export async function resolveMediaUrl(env: MediaEnvelope): Promise<string> {
  const cached = urlCache.get(env.mediaObjectId);
  if (cached) return cached;

  const { url } = await mediaApi.downloadUrl(env.mediaObjectId);
  const res = await fetch(url);
  const cipher = new Uint8Array(await res.arrayBuffer());
  const plain = await decryptBytes(cipher, env.key, env.nonce);
  // Copy into a plain ArrayBuffer for Blob (avoids ArrayBufferLike/SharedArrayBuffer typing).
  const buf = plain.buffer.slice(plain.byteOffset, plain.byteOffset + plain.byteLength) as ArrayBuffer;
  const objectUrl = URL.createObjectURL(new Blob([buf], { type: env.mimeType || "application/octet-stream" }));
  urlCache.set(env.mediaObjectId, objectUrl);
  return objectUrl;
}

/** Seed the cache with a locally-recorded blob so the sender plays instantly. */
export function cacheLocalMedia(objectId: string, blob: Blob): string {
  const url = URL.createObjectURL(blob);
  urlCache.set(objectId, url);
  return url;
}
