"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Phone, SwitchCamera } from "lucide-react";
import { useCallStore } from "@/lib/webrtc/callStore";
import { useCall } from "@/lib/webrtc/CallProvider";
import { Avatar } from "@/components/ui/misc";
import { cn, formatDuration } from "@/lib/utils";

export function CallOverlay() {
  const call = useCallStore();
  const actions = useCall();
  const remoteRef = useRef<HTMLVideoElement>(null);
  const localRef = useRef<HTMLVideoElement>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (remoteRef.current && call.remoteStream) remoteRef.current.srcObject = call.remoteStream;
  }, [call.remoteStream]);
  useEffect(() => {
    if (localRef.current && call.localStream) localRef.current.srcObject = call.localStream;
  }, [call.localStream]);

  useEffect(() => {
    if (call.status !== "connected" || !call.startedAt) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - call.startedAt!) / 1000)), 1000);
    return () => clearInterval(t);
  }, [call.status, call.startedAt]);

  if (!call.active) return null;

  const isVideo = call.type === "video";
  const showVideo = isVideo && call.status === "connected";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-slate-900 to-black text-white"
      >
        {/* Remote video / avatar backdrop */}
        <div className="relative flex flex-1 items-center justify-center overflow-hidden">
          {showVideo ? (
            <video ref={remoteRef} autoPlay playsInline className="h-full w-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-5">
              <div className="relative">
                {(call.status === "ringing" || call.status === "incoming") && (
                  <>
                    <span className="absolute inset-0 animate-pulse-ring rounded-full bg-primary/40" />
                    <span className="absolute inset-0 animate-pulse-ring rounded-full bg-primary/30 [animation-delay:0.5s]" />
                  </>
                )}
                <Avatar name={call.peerName ?? "Contact"} size={132} userId={call.peerId} />
              </div>
              <div className="text-center">
                <h2 className="text-2xl font-semibold">{call.peerName ?? "Nexa contact"}</h2>
                <p className="mt-1 text-white/70">{statusLabel(call.status, call.direction, isVideo, elapsed)}</p>
              </div>
            </div>
          )}

          {/* Local preview (video calls) */}
          {isVideo && call.localStream && call.status !== "incoming" && (
            <video
              ref={localRef}
              autoPlay
              playsInline
              muted
              className="absolute bottom-5 right-5 h-40 w-28 scale-x-[-1] rounded-2xl border border-white/20 object-cover shadow-2xl"
            />
          )}

          {showVideo && (
            <div className="absolute left-1/2 top-6 -translate-x-1/2 rounded-full bg-black/40 px-4 py-1.5 text-sm backdrop-blur">
              {call.peerName ?? "Contact"} · {formatDuration(elapsed)}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="pb-10 pt-6">
          {call.status === "incoming" ? (
            <div className="flex items-center justify-center gap-16">
              <CallButton onClick={actions.reject} className="bg-destructive" label="Decline">
                <PhoneOff />
              </CallButton>
              <CallButton onClick={actions.accept} className="animate-bounce bg-success" label="Accept">
                <Phone />
              </CallButton>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-5">
              <CallButton onClick={actions.toggleMute} className={call.muted ? "bg-white text-black" : "bg-white/15"} label={call.muted ? "Unmute" : "Mute"}>
                {call.muted ? <MicOff /> : <Mic />}
              </CallButton>
              {isVideo && (
                <>
                  <CallButton onClick={actions.toggleCamera} className={call.cameraOff ? "bg-white text-black" : "bg-white/15"} label="Camera">
                    {call.cameraOff ? <VideoOff /> : <Video />}
                  </CallButton>
                  <CallButton onClick={actions.switchCamera} className="bg-white/15" label="Flip">
                    <SwitchCamera />
                  </CallButton>
                </>
              )}
              <CallButton onClick={actions.hangup} className="bg-destructive" label="End">
                <PhoneOff />
              </CallButton>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function CallButton({
  children,
  onClick,
  className,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={cn(
        "grid h-16 w-16 place-items-center rounded-full text-white transition-transform active:scale-90",
        className,
      )}
    >
      {children}
    </button>
  );
}

function statusLabel(status: string, direction: string | null, isVideo: boolean, elapsed: number): string {
  if (status === "connected") return formatDuration(elapsed);
  if (status === "connecting") return "Connecting…";
  if (status === "incoming") return `Incoming ${isVideo ? "video" : "voice"} call…`;
  if (status === "ringing") return direction === "outgoing" ? "Ringing…" : "Calling…";
  if (status === "ended") return "Call ended";
  return "";
}
