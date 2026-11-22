import { useEffect, useState } from "react";
import { getFrontendUrl } from "@/lib/crm.functions";
import { DEFAULT_FRONTEND_URL, LEGACY_FRONTEND_HOSTS } from "@/lib/server-url-rules";

const LS = "actes_frontend_url";
const MOVED = "moved";

type BIP = Event & { prompt: () => Promise<void> };

// Installed apps move to the saved frontend URL: first the new link is downloaded
// in a hidden frame (so its offline copy is stored), then the app switches to it.
export function FrontendRedirect() {
  const [target, setTarget] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [install, setInstall] = useState<BIP | null>(null);

  // On arrival from a move: offer installing this link once.
  useEffect(() => {
    const u = new URL(window.location.href);
    if (u.searchParams.get(MOVED) !== "1") return;
    u.searchParams.delete(MOVED);
    history.replaceState(null, "", u.toString());
    const onBip = (e: Event) => { e.preventDefault(); setInstall(e as BIP); };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  useEffect(() => {
    const here = window.location.host;
    const legacy = LEGACY_FRONTEND_HOSTS.includes(here);
    if (!legacy && here !== new URL(DEFAULT_FRONTEND_URL).host) return; // preview or dev
    let started = "";
    let frame: HTMLIFrameElement | null = null;
    let tick: ReturnType<typeof setInterval> | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const go = (url: string) => {
      let to: URL;
      try { to = new URL(url); } catch { return; }
      if (legacy && LEGACY_FRONTEND_HOSTS.includes(to.host)) to = new URL(DEFAULT_FRONTEND_URL);
      if (to.host === here || started === to.origin) return;
      const dest = new URL(to.origin + window.location.pathname + window.location.search + window.location.hash);
      dest.searchParams.set(MOVED, "1");
      const leave = () => window.location.replace(dest.toString());
      if (!navigator.onLine) { leave(); return; } // the new link may already be on the device
      started = to.origin;
      setTarget(to.origin);
      setProgress(5);
      tick = setInterval(() => setProgress((p) => Math.min(p + 4, 90)), 400);
      frame?.remove();
      frame = document.createElement("iframe");
      frame.style.display = "none";
      frame.src = to.origin + "/";
      frame.onload = () => {
        // Give the new link a moment to store its offline copy, then switch.
        setTimeout(() => { clearInterval(tick); setProgress(100); setTimeout(leave, 400); }, 3000);
      };
      document.body.appendChild(frame);
      timeout = setTimeout(leave, 20000);
    };
    const saved = localStorage.getItem(LS);
    if (saved) go(saved);
    else if (legacy) go(DEFAULT_FRONTEND_URL);
    const check = () => {
      if (!navigator.onLine) return;
      getFrontendUrl().then(({ url }) => {
        if (url === DEFAULT_FRONTEND_URL) localStorage.removeItem(LS); else localStorage.setItem(LS, url);
        go(url);
      }).catch(() => {});
    };
    check();
    const id = setInterval(check, 60_000);
    const onVis = () => { if (document.visibilityState === "visible") check(); };
    const onChanged = (e: Event) => {
      const url = (e as CustomEvent<string>).detail;
      if (url === DEFAULT_FRONTEND_URL) localStorage.removeItem(LS); else localStorage.setItem(LS, url);
      go(url);
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("actes-frontend-changed", onChanged);
    return () => {
      clearInterval(id); clearInterval(tick); clearTimeout(timeout); frame?.remove();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("actes-frontend-changed", onChanged);
    };
  }, []);

  if (target) return (
    <div dir="rtl" className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-ink p-6 text-center text-ink-foreground">
      <img src="/icon-192.png" alt="ACTES" className="h-24 w-24 rounded-2xl" />
      <p className="text-lg font-bold">جارٍ تنزيل التطبيق من الرابط الجديد</p>
      <p dir="ltr" className="font-mono text-xs opacity-70">{target}</p>
      <div className="h-2 w-64 overflow-hidden rounded-full bg-ink-foreground/20">
        <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
      </div>
      <p className="text-sm opacity-70">{progress}%</p>
    </div>
  );
  if (install) return (
    <div dir="rtl" className="fixed inset-x-0 bottom-0 z-[60] flex items-center justify-center gap-3 bg-primary px-3 py-2 text-sm text-primary-foreground">
      ثبّت التطبيق من الرابط الجديد على هذا الجهاز
      <button onClick={() => { void install.prompt(); setInstall(null); }} className="rounded bg-primary-foreground px-2 py-0.5 font-semibold text-primary">تثبيت</button>
      <button onClick={() => setInstall(null)} className="opacity-80">لاحقاً</button>
    </div>
  );
  return null;
}
