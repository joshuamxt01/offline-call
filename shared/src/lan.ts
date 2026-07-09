/**
 * LAN / offline protocol contracts — used by the Android LanSignaling channel
 * (and any local relay helper). Mirrors the cloud signal:* shapes so the same
 * WebRTC PeerConnection can be driven over the local network.
 */

export const LAN_SERVICE_TYPE = "_nexa._tcp";
export const LAN_PROTOCOL_VERSION = 1;

/** TXT record advertised via mDNS/NSD for peer discovery + offline trust. */
export interface LanServiceTxt {
  uid: string; // userId
  did: string; // deviceId
  name: string; // displayName
  ipk: string; // base64 identity public key
  ver: string; // protocol version
  nonce: string; // random challenge
  sig: string; // Ed25519 signature over `${uid}|${did}|${nonce}` with identity key
}

export type LanFrameType =
  | "invite"
  | "offer"
  | "answer"
  | "ice"
  | "bye"
  | "msg";

/** Length-prefixed JSON frame exchanged over the direct LAN socket. */
export interface LanFrame {
  t: LanFrameType;
  callId?: string;
  from: string; // deviceId
  type?: "voice" | "video";
  sdp?: string;
  candidate?: unknown;
  // offline chat (E2E-encrypted like cloud messages):
  id?: string;
  convId?: string;
  ciphertext?: string;
  nonce?: string;
}
