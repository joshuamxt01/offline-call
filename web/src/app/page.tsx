"use client";
import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Phone, Video, MessageSquare, Wifi, ShieldCheck, ArrowRight, Download } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useAuthStore, useHydrated } from "@/lib/store/auth";

const features = [
  { icon: Phone, title: "Crystal voice calls", desc: "Peer-to-peer WebRTC audio — the server never touches your media." },
  { icon: Video, title: "Face-to-face video", desc: "Front/back camera, full-screen, adaptive quality." },
  { icon: MessageSquare, title: "Encrypted chat", desc: "End-to-end encrypted messages with delivery & read receipts." },
  { icon: Wifi, title: "Works offline", desc: "Call & message over local Wi-Fi with zero internet." },
];

export default function LandingPage() {
  const router = useRouter();
  const { accessToken } = useAuthStore();
  const hydrated = useHydrated();

  useEffect(() => {
    if (hydrated && accessToken) router.replace("/chats");
  }, [hydrated, accessToken, router]);

  return (
    <div className="app-gradient min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground font-bold">
            N
          </div>
          <span className="text-lg font-bold">Nexa</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/login">
            <Button variant="ghost" size="sm">Log in</Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5">
        <section className="grid items-center gap-10 py-14 md:grid-cols-2 md:py-24">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
              <ShieldCheck size={14} className="text-accent" /> Private by design · Online & offline
            </div>
            <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-6xl">
              Talk anywhere.
              <br />
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Even off the grid.
              </span>
            </h1>
            <p className="mt-5 max-w-md text-lg text-muted-foreground">
              Voice, video, and messaging that keep working over local Wi-Fi when the internet
              doesn&apos;t — with media that never routes through a server.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register">
                <Button size="lg" className="gap-2">
                  Get started <ArrowRight size={18} />
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline">I have an account</Button>
              </Link>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href="https://github.com/joshuamxt01/offline-call/releases/latest/download/nexa.apk"
                className="inline-flex"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button size="lg" variant="secondary" className="gap-2">
                  <Download size={18} /> Android app (.apk)
                </Button>
              </a>
              <a
                href="https://github.com/joshuamxt01/offline-call/releases/latest/download/nexa-windows.exe"
                className="inline-flex"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button size="lg" variant="secondary" className="gap-2">
                  <Download size={18} /> Windows app (.exe)
                </Button>
              </a>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Android: allow &quot;install from unknown sources&quot;. Windows: needs the WebView2 runtime (already on most Win10/11).
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="grid grid-cols-2 gap-4"
          >
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.08 }}
                className="glass rounded-2xl border border-border p-5"
              >
                <f.icon className="mb-3 text-primary" />
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </section>
      </main>
    </div>
  );
}
