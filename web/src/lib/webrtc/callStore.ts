"use client";
import { create } from "zustand";
import type { CallType } from "@nexa/shared";

export type CallStatus = "idle" | "ringing" | "incoming" | "connecting" | "connected" | "ended";

interface CallState {
  active: boolean;
  callId: string | null;
  peerId: string | null;
  peerName: string | null;
  type: CallType;
  direction: "incoming" | "outgoing" | null;
  status: CallStatus;
  muted: boolean;
  cameraOff: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  startedAt: number | null;

  set: (patch: Partial<CallState>) => void;
  reset: () => void;
}

const initial = {
  active: false,
  callId: null,
  peerId: null,
  peerName: null,
  type: "voice" as CallType,
  direction: null,
  status: "idle" as CallStatus,
  muted: false,
  cameraOff: false,
  localStream: null,
  remoteStream: null,
  startedAt: null,
};

export const useCallStore = create<CallState>((set) => ({
  ...initial,
  set: (patch) => set(patch),
  reset: () => set({ ...initial }),
}));
