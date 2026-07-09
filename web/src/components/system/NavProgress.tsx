"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * A thin animated bar at the very top of the screen that appears the instant you
 * click something that navigates to another page, and disappears once the new
 * page is showing. Gives immediate "it's working, hang on" feedback so the app
 * never feels frozen while a page loads.
 */
export function NavProgress() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);

  // The route actually changed → navigation finished.
  useEffect(() => {
    setLoading(false);
  }, [pathname]);

  // Start the bar on any click that leads to an internal navigation.
  useEffect(() => {
    function isInternalNav(a: HTMLAnchorElement): boolean {
      const href = a.getAttribute("href");
      if (!href || a.target === "_blank" || a.hasAttribute("download")) return false;
      if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return false;
      try {
        const url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin) return false;
        // Same page → no navigation, don't show the bar.
        if (url.pathname === window.location.pathname) return false;
      } catch {
        return false;
      }
      return true;
    }

    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest?.("a") as HTMLAnchorElement | null;
      if (anchor && isInternalNav(anchor)) setLoading(true);
    }

    // Programmatic navigations (router.push) dispatch this to show the bar too.
    function onManual() {
      setLoading(true);
    }

    document.addEventListener("click", onClick, true);
    window.addEventListener("nexa:navigating", onManual);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("nexa:navigating", onManual);
    };
  }, []);

  // Failsafe: never leave the bar stuck on screen.
  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => setLoading(false), 8000);
    return () => clearTimeout(t);
  }, [loading]);

  if (!loading) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-[200] h-[3px] overflow-hidden bg-primary/20">
      <div className="animate-nav-progress h-full w-1/3 rounded-full bg-primary" />
    </div>
  );
}
