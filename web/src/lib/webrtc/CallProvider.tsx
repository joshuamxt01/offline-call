"use client";
import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { ulid } from "ulid";
import { ClientEvents, ServerEvents, type CallType } from "@nexa/shared";
import { useSocket } from "../realtime/socket";
import { callsApi } from "../api/endpoints";
import { useCallStore } from "./callStore";

interface CallActions {
  startCall: (peerId: string, peerName: string, type: CallType) => Promise<void>;
  accept: () => Promise<void>;
  reject: () => void;
  hangup: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  switchCamera: () => Promise<void>;
}
const Ctx = createContext<CallActions | null>(null);

/**
 * Drives the WebRTC PeerConnection and wires it to Socket.IO signaling.
 * The server relays SDP/ICE only — the media itself is peer-to-peer (or TURN
 * fallback). The same offer/answer/ice shapes flow over LAN in the mobile app.
 */
export function CallProvider({ children }: { children: ReactNode }) {
  const { socket } = useSocket();
  const store = useCallStore;

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  const facingRef = useRef<"user" | "environment">("user");

  async function iceServers(): Promise<RTCIceServer[]> {
    try {
      const t = await callsApi.turnCredentials();
      return [
        { urls: t.urls.filter((u) => u.startsWith("stun:")) },
        {
          urls: t.urls.filter((u) => u.startsWith("turn:")),
          username: t.username,
          credential: t.credential,
        },
      ].filter((s) => (s.urls as string[]).length > 0);
    } catch {
      return [{ urls: "stun:stun.l.google.com:19302" }];
    }
  }

  async function getMedia(type: CallType): Promise<MediaStream> {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: type === "video" ? { facingMode: facingRef.current } : false,
    });
    localRef.current = stream;
    store.getState().set({ localStream: stream });
    return stream;
  }

  async function createPeer(callId: string): Promise<RTCPeerConnection> {
    const pc = new RTCPeerConnection({ iceServers: await iceServers() });
    pcRef.current = pc;

    pc.onicecandidate = (e) => {
      if (e.candidate) socket?.emit(ClientEvents.SignalIce, { callId, candidate: e.candidate.toJSON() });
    };
    pc.ontrack = (e) => {
      const [remote] = e.streams;
      if (remote) store.getState().set({ remoteStream: remote, status: "connected", startedAt: Date.now() });
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        endLocal("failed");
      }
    };
    localRef.current?.getTracks().forEach((t) => pc.addTrack(t, localRef.current!));
    return pc;
  }

  function cleanup() {
    pcRef.current?.close();
    pcRef.current = null;
    localRef.current?.getTracks().forEach((t) => t.stop());
    localRef.current = null;
    pendingIce.current = [];
  }

  function endLocal(_reason: string) {
    cleanup();
    store.getState().set({ status: "ended" });
    setTimeout(() => store.getState().reset(), 1200);
  }

  // ---- Signaling listeners -------------------------------------------------
  useEffect(() => {
    if (!socket) return;

    const onIncoming = (p: { callId: string; callerId: string; type: CallType; callerName?: string | null }) => {
      // Ignore if already in a call.
      if (store.getState().active) {
        socket.emit(ClientEvents.CallReject, { callId: p.callId, reason: "busy" });
        return;
      }
      store.getState().set({
        active: true,
        callId: p.callId,
        peerId: p.callerId,
        peerName: p.callerName || null,
        type: p.type,
        direction: "incoming",
        status: "incoming",
      });
    };

    const onAnswered = async (p: { callId: string }) => {
      const pc = pcRef.current;
      if (!pc) return;
      store.getState().set({ status: "connecting" });
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit(ClientEvents.SignalOffer, { callId: p.callId, sdp: offer.sdp });
    };

    const onOffer = async (p: { callId: string; sdp: string }) => {
      const pc = pcRef.current ?? (await createPeer(p.callId));
      await pc.setRemoteDescription({ type: "offer", sdp: p.sdp });
      await drainIce();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit(ClientEvents.SignalAnswer, { callId: p.callId, sdp: answer.sdp });
    };

    const onAnswer = async (p: { sdp: string }) => {
      await pcRef.current?.setRemoteDescription({ type: "answer", sdp: p.sdp });
      await drainIce();
    };

    const onIce = async (p: { candidate: RTCIceCandidateInit }) => {
      const pc = pcRef.current;
      if (!pc || !pc.remoteDescription) {
        pendingIce.current.push(p.candidate);
        return;
      }
      await pc.addIceCandidate(p.candidate).catch(() => {});
    };

    async function drainIce() {
      const pc = pcRef.current;
      if (!pc) return;
      for (const c of pendingIce.current) await pc.addIceCandidate(c).catch(() => {});
      pendingIce.current = [];
    }

    const onEnded = () => endLocal("remote-hangup");
    const onRejected = () => endLocal("rejected");
    const onCancelled = () => endLocal("cancelled");

    socket.on(ServerEvents.CallIncoming, onIncoming);
    socket.on(ServerEvents.CallAnswered, onAnswered);
    socket.on(ServerEvents.SignalOffer, onOffer);
    socket.on(ServerEvents.SignalAnswer, onAnswer);
    socket.on(ServerEvents.SignalIce, onIce);
    socket.on(ServerEvents.CallEnded, onEnded);
    socket.on(ServerEvents.CallRejected, onRejected);
    socket.on(ServerEvents.CallCancelled, onCancelled);

    return () => {
      socket.off(ServerEvents.CallIncoming, onIncoming);
      socket.off(ServerEvents.CallAnswered, onAnswered);
      socket.off(ServerEvents.SignalOffer, onOffer);
      socket.off(ServerEvents.SignalAnswer, onAnswer);
      socket.off(ServerEvents.SignalIce, onIce);
      socket.off(ServerEvents.CallEnded, onEnded);
      socket.off(ServerEvents.CallRejected, onRejected);
      socket.off(ServerEvents.CallCancelled, onCancelled);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  // Media (mic/camera) couldn't be acquired — clean up so the call never hangs,
  // optionally notify the peer, and tell the user why.
  function failMedia(err: unknown, notifyPeer?: () => void) {
    notifyPeer?.();
    cleanup();
    const name = (err as { name?: string })?.name;
    const msg =
      name === "NotAllowedError" || name === "SecurityError"
        ? "Microphone/camera permission was denied. Allow access in your browser, then try again."
        : name === "NotFoundError" || name === "NotReadableError"
          ? "No microphone or camera is available on this device."
          : "Couldn't access your microphone/camera.";
    store.getState().set({ status: "ended" });
    if (typeof window !== "undefined") setTimeout(() => window.alert(msg), 30);
    setTimeout(() => store.getState().reset(), 400);
  }

  // ---- Actions -------------------------------------------------------------
  const actions: CallActions = {
    async startCall(peerId, peerName, type) {
      if (!socket) return;
      const callId = ulid();
      store.getState().set({
        active: true, callId, peerId, peerName, type, direction: "outgoing", status: "ringing",
        muted: false, cameraOff: false,
      });
      try {
        await getMedia(type);
        await createPeer(callId);
      } catch (err) {
        failMedia(err);
        return;
      }
      // Ack lets us surface "not allowed / rate limited" instead of ringing forever.
      socket.emit(
        ClientEvents.CallInvite,
        { callId, calleeId: peerId, type },
        (res?: { ok: boolean; error?: { message: string } }) => {
          if (res && !res.ok) {
            store.getState().set({ status: "ended" });
            if (typeof window !== "undefined") {
              window.alert(res.error?.message ?? "Could not start the call.");
            }
            endLocal("rejected");
          }
        },
      );
    },

    async accept() {
      const { callId, type } = store.getState();
      if (!socket || !callId) return;
      store.getState().set({ status: "connecting" });
      try {
        await getMedia(type);
        await createPeer(callId);
      } catch (err) {
        failMedia(err, () => socket.emit(ClientEvents.CallReject, { callId, reason: "media_error" }));
        return;
      }
      socket.emit(ClientEvents.CallAnswer, { callId });
    },

    reject() {
      const { callId } = store.getState();
      if (socket && callId) socket.emit(ClientEvents.CallReject, { callId, reason: "declined" });
      endLocal("declined");
    },

    hangup() {
      const { callId } = store.getState();
      if (socket && callId) socket.emit(ClientEvents.CallEnd, { callId });
      endLocal("hangup");
    },

    toggleMute() {
      const muted = !store.getState().muted;
      localRef.current?.getAudioTracks().forEach((t) => (t.enabled = !muted));
      store.getState().set({ muted });
    },

    toggleCamera() {
      const off = !store.getState().cameraOff;
      localRef.current?.getVideoTracks().forEach((t) => (t.enabled = !off));
      store.getState().set({ cameraOff: off });
    },

    async switchCamera() {
      facingRef.current = facingRef.current === "user" ? "environment" : "user";
      const pc = pcRef.current;
      if (!pc || store.getState().type !== "video") return;
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingRef.current }, audio: false,
      });
      const newTrack = newStream.getVideoTracks()[0];
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (sender && newTrack) await sender.replaceTrack(newTrack);
      // swap track in local preview
      const local = localRef.current;
      if (local && newTrack) {
        local.getVideoTracks().forEach((t) => { t.stop(); local.removeTrack(t); });
        local.addTrack(newTrack);
        store.getState().set({ localStream: local });
      }
    },
  };

  return <Ctx.Provider value={actions}>{children}</Ctx.Provider>;
}

export function useCall(): CallActions {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCall must be used within CallProvider");
  return ctx;
}
