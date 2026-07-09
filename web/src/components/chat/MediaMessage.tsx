"use client";
import { useRef, useState } from "react";
import { Play, Pause, Video as VideoIcon, Loader2 } from "lucide-react";
import { resolveMediaUrl, type MediaEnvelope } from "@/lib/media/mediaClient";
import { cn, formatDuration } from "@/lib/utils";

export function VoiceMessage({ media, mine, uploading, failed }: { media: MediaEnvelope; mine: boolean; uploading?: boolean; failed?: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    if (!url) {
      setLoading(true);
      const u = await resolveMediaUrl(media).catch(() => null);
      setLoading(false);
      if (!u) return;
      setUrl(u);
      requestAnimationFrame(() => void audioRef.current?.play());
      return;
    }
    if (playing) audioRef.current?.pause();
    else audioRef.current?.play();
  }

  const seconds = Math.round(media.durationMs / 1000);
  const fg = mine ? "text-primary-foreground" : "text-foreground";
  const track = mine ? "bg-primary-foreground/30" : "bg-muted-foreground/30";
  const fill = mine ? "bg-primary-foreground" : "bg-primary";

  return (
    <div className="flex min-w-[180px] items-center gap-3 py-0.5">
      <button
        onClick={toggle}
        disabled={uploading}
        className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full", mine ? "bg-primary-foreground/20" : "bg-primary/15", uploading && "opacity-70")}
        aria-label={playing ? "Pause" : "Play"}
      >
        {uploading || loading ? <Loader2 size={18} className={cn("animate-spin", fg)} /> : playing ? <Pause size={18} className={fg} /> : <Play size={18} className={fg} />}
      </button>
      <div className="flex-1">
        <div className={cn("h-1.5 w-full overflow-hidden rounded-full", track)}>
          <div className={cn("h-full rounded-full transition-[width]", fill)} style={{ width: `${progress}%` }} />
        </div>
        <span className={cn("mt-1 block text-[11px]", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
          {failed ? "⚠️ Failed to send" : uploading ? "Uploading…" : `🎤 ${formatDuration(seconds)}`}
        </span>
      </div>
      {url && (
        <audio
          ref={audioRef}
          src={url}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => { setPlaying(false); setProgress(0); }}
          onTimeUpdate={(e) => {
            const a = e.currentTarget;
            if (a.duration) setProgress((a.currentTime / a.duration) * 100);
          }}
          className="hidden"
        />
      )}
    </div>
  );
}

export function VideoMessage({ media, uploading, failed }: { media: MediaEnvelope; mine: boolean; uploading?: boolean; failed?: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (uploading) return;
    setLoading(true);
    const u = await resolveMediaUrl(media).catch(() => null);
    setLoading(false);
    if (u) setUrl(u);
  }

  const seconds = Math.round(media.durationMs / 1000);

  if (url) {
    return (
      <video
        src={url}
        controls
        playsInline
        autoPlay
        className="max-h-72 w-full max-w-[260px] rounded-xl bg-black"
      />
    );
  }

  return (
    <button
      onClick={load}
      disabled={uploading}
      className="relative grid h-40 w-[240px] place-items-center overflow-hidden rounded-xl bg-black/80 text-white"
    >
      {uploading || loading ? (
        <div className="flex flex-col items-center gap-2">
          <Loader2 size={28} className="animate-spin" />
          {uploading && <span className="text-xs text-white/80">Uploading…</span>}
        </div>
      ) : failed ? (
        <span className="px-3 text-center text-sm text-red-300">⚠️ Failed to send</span>
      ) : (
        <>
          <div className="grid h-14 w-14 place-items-center rounded-full bg-white/20 backdrop-blur">
            <VideoIcon size={26} />
          </div>
          <span className="absolute bottom-2 right-2 rounded bg-black/50 px-1.5 py-0.5 text-xs">
            {formatDuration(seconds)}
          </span>
        </>
      )}
    </button>
  );
}
