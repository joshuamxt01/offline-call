"use client";
import { useEffect, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "./theme";
import { SocketProvider } from "./realtime/socket";
import { CallProvider } from "./webrtc/CallProvider";
import { NavProgress } from "@/components/system/NavProgress";

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <SocketProvider>
          <CallProvider>
            <NavProgress />
            {children}
          </CallProvider>
        </SocketProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
