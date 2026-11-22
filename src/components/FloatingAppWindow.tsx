import { useEffect, useRef, useState } from "react";

type Box = { x: number; y: number; w: number; h: number };
const KEY = "floating_win_";

export function FloatingAppWindow({ title, src, allow, onClose }: { title: string; src: string; allow?: string; onClose: () => void }) {
  const [desk, setDesk] = useState(false);
  const [box, setBox] = useState<Box>({ x: 0, y: 0, w: 390, h: 740 });
  const [max, setMax] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mini, setMini] = useState(false);
  const drag = useRef<{ mode: string; sx: number; sy: number; b: Box } | null>(null);

  useEffect(() => {
    const d = window.innerWidth >= 768;
    setDesk(d);
    const h = Math.min(740, window.innerHeight - 24);
    let b: Box = { w: 390, h, x: (window.innerWidth - 390) / 2, y: (window.innerHeight - h) / 2 };
    try {
      const saved = JSON.parse(localStorage.getItem(KEY + title) || "null");
      if (saved && typeof saved.w === "number") {
        const w = Math.min(Math.max(300, saved.w), window.innerWidth);
        const hh = Math.min(Math.max(300, saved.h), window.innerHeight);
        b = { w, h: hh, x: Math.min(Math.max(0, saved.x), window.innerWidth - w), y: Math.min(Math.max(0, saved.y), window.innerHeight - hh) };
      }
    } catch { /* ignore */ }
    setBox(b);
  }, [title]);

  const start = (mode: string) => (e: React.PointerEvent) => {
    if (!desk || max) return;
    e.preventDefault();
    drag.current = { mode, sx: e.clientX, sy: e.clientY, b: box };
    setBusy(true);
    let last: Box | null = null;
    const move = (ev: PointerEvent) => {
      const s = drag.current; if (!s) return;
      const dx = ev.clientX - s.sx, dy = ev.clientY - s.sy;
      const n = { ...s.b };
      if (s.mode === "move") { n.x = s.b.x + dx; n.y = Math.max(0, s.b.y + dy); }
      if (s.mode.includes("r")) n.w = Math.max(300, s.b.w + dx);
      if (s.mode.includes("l")) { n.w = Math.max(300, s.b.w - dx); n.x = s.b.x + s.b.w - n.w; }
      if (s.mode.includes("b")) n.h = Math.max(300, s.b.h + dy);
      setBox(n);
      last = n;
    };
    const up = () => { if (last) try { localStorage.setItem(KEY + title, JSON.stringify(last)); } catch { /* ignore */ } drag.current = null; setBusy(false); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const free = desk && !max;
  return (
    <>
    {mini && <button type="button" onClick={() => setMini(false)} className="fixed bottom-3 left-3 z-50 rounded-full border border-border bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-2xl">{title} ▴</button>}
    <div className={`fixed inset-0 z-50 ${free ? "pointer-events-none" : ""} ${mini ? "hidden" : ""}`}>
      <div
        className={`pointer-events-auto absolute flex flex-col overflow-hidden bg-background ${free ? "rounded-2xl border border-border shadow-2xl" : "inset-0"}`}
        style={free ? { left: box.x, top: box.y, width: box.w, height: box.h } : undefined}
      >
        <div onPointerDown={start("move")} onDoubleClick={() => desk && setMax((m) => !m)} className={`flex h-7 shrink-0 select-none items-center justify-between border-b border-border px-2 ${free ? "cursor-move" : ""}`}>
          <span className="text-xs font-semibold leading-none">{title}</span>
          <div className="flex items-center" onPointerDown={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setMini(true)} aria-label="تصغير" className="px-2 text-sm leading-none">—</button>
            {desk && <button type="button" onClick={() => setMax((m) => !m)} aria-label={max ? "استعادة" : "تكبير"} className="px-2 text-sm leading-none">{max ? "❐" : "□"}</button>}
            <button type="button" onClick={onClose} aria-label="إغلاق" className="px-2 text-sm leading-none">✕</button>
          </div>
        </div>
        <div className="relative flex-1 overflow-hidden">
          <iframe src={src} title={title} allow={allow} className="app-frame border-0" />
          {busy && <div className="absolute inset-0" />}
        </div>
        {free && <>
          <div onPointerDown={start("r")} className="absolute right-0 top-7 bottom-3 w-1.5 cursor-ew-resize" />
          <div onPointerDown={start("l")} className="absolute left-0 top-7 bottom-3 w-1.5 cursor-ew-resize" />
          <div onPointerDown={start("b")} className="absolute bottom-0 left-3 right-3 h-1.5 cursor-ns-resize" />
          <div onPointerDown={start("rb")} className="absolute bottom-0 right-0 h-3 w-3 cursor-nwse-resize" />
          <div onPointerDown={start("lb")} className="absolute bottom-0 left-0 h-3 w-3 cursor-nesw-resize" />
        </>}
      </div>
    </div>
    </>
  );
}
