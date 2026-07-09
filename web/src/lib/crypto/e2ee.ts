"use client";
import _sodium from "libsodium-wrappers";

/**
 * End-to-end encryption for messages using libsodium `crypto_box` (X25519 +
 * XSalsa20-Poly1305, authenticated). The server only ever sees ciphertext+nonce.
 *
 * Base64: we ENCODE as standard base64 (ORIGINAL) so it matches the Android
 * client (`Base64.NO_WRAP`) and stays cross-platform. We DECODE tolerantly
 * (standard OR url-safe, padded OR not) so keys/ciphertext from any client — or
 * from older web sessions that used url-safe — still work.
 */
let sodium: typeof _sodium | null = null;

export async function ready(): Promise<typeof _sodium> {
  if (sodium) return sodium;
  await _sodium.ready;
  sodium = _sodium;
  return sodium;
}

/** Standard base64 (matches Android Base64.NO_WRAP). */
export function toB64(bytes: Uint8Array): string {
  const s = sodium!;
  return s.to_base64(bytes, s.base64_variants.ORIGINAL);
}

/** Decode standard OR url-safe base64, padded or not. */
export function fromB64(str: string): Uint8Array {
  const s = sodium!;
  const variants = [
    s.base64_variants.ORIGINAL,
    s.base64_variants.URLSAFE_NO_PADDING,
    s.base64_variants.URLSAFE,
    s.base64_variants.ORIGINAL_NO_PADDING,
  ];
  for (const v of variants) {
    try {
      return s.from_base64(str, v);
    } catch {
      /* try the next variant */
    }
  }
  throw new Error("invalid base64");
}

export interface IdentityKeypair {
  publicKey: string; // base64
  privateKey: string; // base64
}

const KEY = "nexa-identity-key";

export async function getOrCreateIdentity(): Promise<IdentityKeypair> {
  await ready();
  const existing = typeof window !== "undefined" ? localStorage.getItem(KEY) : null;
  if (existing) return JSON.parse(existing) as IdentityKeypair;

  const kp = sodium!.crypto_box_keypair();
  const identity: IdentityKeypair = { publicKey: toB64(kp.publicKey), privateKey: toB64(kp.privateKey) };
  if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(identity));
  return identity;
}

/** Overwrite with a brand-new identity (used on fresh account registration). */
export async function createFreshIdentity(): Promise<IdentityKeypair> {
  await ready();
  const kp = sodium!.crypto_box_keypair();
  const identity: IdentityKeypair = { publicKey: toB64(kp.publicKey), privateKey: toB64(kp.privateKey) };
  if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(identity));
  return identity;
}

export async function getIdentity(): Promise<IdentityKeypair | null> {
  await ready();
  const existing = typeof window !== "undefined" ? localStorage.getItem(KEY) : null;
  return existing ? (JSON.parse(existing) as IdentityKeypair) : null;
}

export interface Encrypted {
  ciphertext: string; // base64
  nonce: string; // base64
}

export async function encryptFor(recipientPubB64: string, plaintext: string): Promise<Encrypted> {
  const s = await ready();
  const identity = await getIdentity();
  if (!identity) throw new Error("No identity keypair");
  const nonce = s.randombytes_buf(s.crypto_box_NONCEBYTES);
  const cipher = s.crypto_box_easy(
    s.from_string(plaintext),
    nonce,
    fromB64(recipientPubB64),
    fromB64(identity.privateKey),
  );
  return { ciphertext: toB64(cipher), nonce: toB64(nonce) };
}

export async function decryptFrom(
  senderPubB64: string,
  ciphertextB64: string,
  nonceB64: string,
): Promise<string> {
  const s = await ready();
  const identity = await getIdentity();
  if (!identity) throw new Error("No identity keypair");
  try {
    const plain = s.crypto_box_open_easy(
      fromB64(ciphertextB64),
      fromB64(nonceB64),
      fromB64(senderPubB64),
      fromB64(identity.privateKey),
    );
    return s.to_string(plain);
  } catch {
    return "🔒 Unable to decrypt";
  }
}
