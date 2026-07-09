"use client";
import { ready, toB64, fromB64 } from "./e2ee";

/**
 * Symmetric media encryption (libsodium secretbox / XSalsa20-Poly1305).
 * Each media blob gets a fresh random key; the key + nonce travel inside the
 * E2E-encrypted chat message, so the server/B2 only ever hold ciphertext.
 */
export async function encryptBytes(
  bytes: Uint8Array,
): Promise<{ cipher: Uint8Array; key: string; nonce: string }> {
  const s = await ready();
  const key = s.crypto_secretbox_keygen();
  const nonce = s.randombytes_buf(s.crypto_secretbox_NONCEBYTES);
  const cipher = s.crypto_secretbox_easy(bytes, nonce, key);
  return { cipher, key: toB64(key), nonce: toB64(nonce) };
}

export async function decryptBytes(
  cipher: Uint8Array,
  keyB64: string,
  nonceB64: string,
): Promise<Uint8Array> {
  const s = await ready();
  return s.crypto_secretbox_open_easy(cipher, fromB64(nonceB64), fromB64(keyB64));
}
