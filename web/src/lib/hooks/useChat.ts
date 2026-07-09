"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ulid } from "ulid";
import {
  ClientEvents,
  ServerEvents,
  type MessageDto,
} from "@nexa/shared";
import { conversationsApi, keysApi } from "@/lib/api/endpoints";
import { encryptFor, decryptFrom } from "@/lib/crypto/e2ee";
import { uploadEncryptedMedia, cacheLocalMedia, type MediaEnvelope } from "@/lib/media/mediaClient";
import { useSocket } from "@/lib/realtime/socket";
import { useAuthStore } from "@/lib/store/auth";

export type MessageKind = "text" | "voice" | "video";

export interface ChatMessage {
  id: string;
  senderId: string;
  mine: boolean;
  type: MessageKind;
  text: string;
  media: MediaEnvelope | null;
  time: string;
  status: "sending" | "sent" | "delivered" | "read";
  /** True while a voice/video message is still uploading to storage. */
  uploading?: boolean;
  /** True if the upload/send failed. */
  failed?: boolean;
}

export function useChat(conversationId: string, initialPeerId?: string) {
  const { socket } = useSocket();
  const myId = useAuthStore((s) => s.user?.id);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [peerTyping, setPeerTyping] = useState(false);
  const [loading, setLoading] = useState(true);

  const peerIdRef = useRef<string | undefined>(initialPeerId);
  const peerPubRef = useRef<string | null>(null);
  const seen = useRef<Set<string>>(new Set());
  const typingTimeout = useRef<ReturnType<typeof setTimeout>>();

  const resolvePeerPub = useCallback(async (peerId: string) => {
    if (peerPubRef.current) return peerPubRef.current;
    const pub = await keysApi.publicKeyOf(peerId);
    peerPubRef.current = pub;
    return pub;
  }, []);

  const decode = useCallback(
    async (m: MessageDto): Promise<ChatMessage> => {
      const mine = m.senderId === myId;
      // In a direct chat the "other party" key decrypts both directions.
      const peerId = mine ? peerIdRef.current : m.senderId;
      const type = (m.type as MessageKind) ?? "text";
      let body = "🔒 Encrypted";
      if (peerId) {
        const pub = await resolvePeerPub(peerId);
        body = await decryptFrom(pub, m.ciphertext, m.nonce);
      }
      // Media messages carry a JSON envelope (media key + object id) as the body.
      let media: MediaEnvelope | null = null;
      let text = body;
      if (type !== "text") {
        try {
          media = JSON.parse(body) as MediaEnvelope;
          text = "";
        } catch {
          text = "🔒 Media";
        }
      }
      return { id: m.id, senderId: m.senderId, mine, type, text, media, time: m.serverCreatedAt, status: m.status };
    },
    [myId, resolvePeerPub],
  );

  // Load history
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const history = await conversationsApi.history(conversationId).catch(() => []);
      const decoded: ChatMessage[] = [];
      for (const m of history) {
        if (!peerIdRef.current && m.senderId !== myId) peerIdRef.current = m.senderId;
        seen.current.add(m.id);
        decoded.push(await decode(m));
      }
      if (!cancelled) {
        setMessages(decoded);
        setLoading(false);
        // Mark the last incoming message read.
        const lastIncoming = [...history].reverse().find((m) => m.senderId !== myId);
        if (lastIncoming && socket) {
          socket.emit(ClientEvents.MessageRead, { conversationId, upToMessageId: lastIncoming.id });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // Realtime subscription
  useEffect(() => {
    if (!socket) return;

    const onNew = async (m: MessageDto) => {
      if (m.conversationId !== conversationId || seen.current.has(m.id)) return;
      seen.current.add(m.id);
      if (!peerIdRef.current && m.senderId !== myId) peerIdRef.current = m.senderId;
      const decoded = await decode(m);
      setMessages((prev) => [...prev, decoded]);
      if (m.senderId !== myId) {
        socket.emit(ClientEvents.MessageDelivered, { messageId: m.id });
        socket.emit(ClientEvents.MessageRead, { conversationId, upToMessageId: m.id });
      }
    };

    const onReceipt = (r: { messageId?: string; upToMessageId?: string; read_at?: string; delivered_at?: string }) => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (r.messageId && msg.id === r.messageId) {
            return { ...msg, status: r.read_at ? "read" : "delivered" };
          }
          if (r.upToMessageId && msg.mine && msg.id <= r.upToMessageId) {
            return { ...msg, status: "read" };
          }
          return msg;
        }),
      );
    };

    const onTyping = (t: { conversationId: string; active: boolean }) => {
      if (t.conversationId === conversationId) setPeerTyping(t.active);
    };

    socket.on(ServerEvents.MessageNew, onNew);
    socket.on(ServerEvents.MessageReceipt, onReceipt);
    socket.on(ServerEvents.Typing, onTyping);
    return () => {
      socket.off(ServerEvents.MessageNew, onNew);
      socket.off(ServerEvents.MessageReceipt, onReceipt);
      socket.off(ServerEvents.Typing, onTyping);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, conversationId, decode, myId]);

  /** Encrypt an already-serialized body and send it as a message of `type`. */
  const dispatch = useCallback(
    async (
      body: string,
      type: MessageKind,
      optimistic: Pick<ChatMessage, "text" | "media">,
      mediaObjectId?: string,
    ) => {
      const peerId = peerIdRef.current;
      if (!peerId) return;
      const pub = await resolvePeerPub(peerId);
      const { ciphertext, nonce } = await encryptFor(pub, body);
      const id = ulid();
      const clientCreatedAt = new Date().toISOString();
      seen.current.add(id);
      setMessages((prev) => [
        ...prev,
        { id, senderId: myId ?? "", mine: true, type, time: clientCreatedAt, status: "sending", ...optimistic },
      ]);

      const payload = { id, conversationId, type, ciphertext, nonce, mediaObjectId: mediaObjectId ?? null, clientCreatedAt };

      if (socket?.connected) {
        socket.emit(ClientEvents.MessageSend, payload, (ack: { ok: boolean }) => {
          setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, status: ack?.ok ? "sent" : "sending" } : m)));
        });
      } else {
        await conversationsApi.sendFallback(conversationId, payload).catch(() => {});
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, status: "sent" } : m)));
      }
    },
    [conversationId, myId, resolvePeerPub, socket],
  );

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      await dispatch(trimmed, "text", { text: trimmed, media: null });
    },
    [dispatch],
  );

  /** Record → show an "uploading" bubble immediately → upload to B2 → send. */
  const sendMedia = useCallback(
    async (kind: "voice" | "video", blob: Blob, durationMs: number) => {
      const peerId = peerIdRef.current;
      if (!peerId) return;
      const id = ulid();
      const clientCreatedAt = new Date().toISOString();

      // Immediate optimistic bubble with a local, playable preview + "uploading" state.
      cacheLocalMedia(id, blob);
      const placeholder: MediaEnvelope = {
        v: 1, mediaObjectId: id, key: "", nonce: "", mimeType: blob.type, durationMs, kind,
      };
      seen.current.add(id);
      setMessages((prev) => [
        ...prev,
        { id, senderId: myId ?? "", mine: true, type: kind, text: "", media: placeholder, time: clientCreatedAt, status: "sending", uploading: true },
      ]);

      try {
        const env = await uploadEncryptedMedia(blob, kind, durationMs);
        cacheLocalMedia(env.mediaObjectId, blob); // keep playing the local copy after upload
        const pub = await resolvePeerPub(peerId);
        const { ciphertext, nonce } = await encryptFor(pub, JSON.stringify(env));
        // Swap the placeholder for the real (uploaded) media.
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, media: env, uploading: false } : m)));

        const payload = { id, conversationId, type: kind, ciphertext, nonce, mediaObjectId: env.mediaObjectId, clientCreatedAt };
        if (socket?.connected) {
          socket.emit(ClientEvents.MessageSend, payload, (ack: { ok: boolean }) => {
            setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, status: ack?.ok ? "sent" : "sending" } : m)));
          });
        } else {
          await conversationsApi.sendFallback(conversationId, payload).catch(() => {});
          setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, status: "sent" } : m)));
        }
      } catch (e) {
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, uploading: false, failed: true } : m)));
        // eslint-disable-next-line no-console
        console.error("sendMedia failed:", e);
      }
    },
    [conversationId, myId, resolvePeerPub, socket],
  );

  const notifyTyping = useCallback(() => {
    if (!socket) return;
    socket.emit(ClientEvents.TypingStart, { conversationId });
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => socket.emit(ClientEvents.TypingStop, { conversationId }), 2000);
  }, [socket, conversationId]);

  return { messages, loading, peerTyping, send, sendMedia, notifyTyping, peerId: peerIdRef.current };
}
