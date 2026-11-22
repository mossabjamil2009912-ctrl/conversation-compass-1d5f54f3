import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { RotateCw, ZoomIn, ZoomOut } from "lucide-react";

// Renders every PDF page as a sharp image so phones show it inline.
// Wide pages (like the SLD) turn sideways on portrait phones to fill the screen; zoom stays crisp.
export function PdfView({ url }: { url: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState("");
  const [rotate, setRotate] = useState<boolean | null>(null);
  const [zoom, setZoom] = useState(1);
  const scroller = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(1);
  // Zoom level the pages were last drawn for; redrawn sharp shortly after zooming stops.
  const [sharpZoom, setSharpZoom] = useState(1);
  useEffect(() => { const t = setTimeout(() => setSharpZoom(zoom), 300); return () => clearTimeout(t); }, [zoom]);
  zoomRef.current = zoom;
  // Zoom around a screen point (mouse/fingers) so the spot under it stays put.
  const zoomAt = (next: number, cx?: number, cy?: number) => {
    const sc = scroller.current; if (!sc) return;
    const z = zoomRef.current;
    next = Math.min(5, Math.max(1, next));
    if (next === z) return;
    const r = sc.getBoundingClientRect();
    const px = (cx ?? r.left + r.width / 2) - r.left, py = (cy ?? r.top + r.height / 2) - r.top;
    const k = next / z;
    const sl = (sc.scrollLeft + px) * k - px, st = (sc.scrollTop + py) * k - py;
    zoomRef.current = next; setZoom(next);
    requestAnimationFrame(() => { sc.scrollLeft = sl; sc.scrollTop = st; });
  };
  const zoomAtRef = useRef(zoomAt); zoomAtRef.current = zoomAt;
  useEffect(() => {
    const sc = scroller.current; if (!sc) return;
    // Mouse wheel and trackpad pinch zoom around the pointer.
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      zoomAtRef.current(zoomRef.current * Math.exp(-dy * 0.002), e.clientX, e.clientY);
    };
    // Two-finger pinch on touch screens.
    let start: { d: number; z: number } | null = null;
    const dist = (t: TouchList) => Math.hypot(t[0]!.clientX - t[1]!.clientX, t[0]!.clientY - t[1]!.clientY);
    const onStart = (e: TouchEvent) => { if (e.touches.length === 2) start = { d: dist(e.touches), z: zoomRef.current }; };
    const onMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !start) return;
      e.preventDefault();
      const cx = (e.touches[0]!.clientX + e.touches[1]!.clientX) / 2, cy = (e.touches[0]!.clientY + e.touches[1]!.clientY) / 2;
      zoomAtRef.current(start.z * dist(e.touches) / start.d, cx, cy);
    };
    const onEnd = (e: TouchEvent) => { if (e.touches.length < 2) start = null; };
    // Drag with the mouse to move around when zoomed.
    let drag: { x: number; y: number; l: number; t: number } | null = null;
    const onDown = (e: MouseEvent) => { if (e.button === 0 && !(e.target as HTMLElement).closest("button")) drag = { x: e.clientX, y: e.clientY, l: sc.scrollLeft, t: sc.scrollTop }; };
    const onMouseMove = (e: MouseEvent) => { if (drag) { sc.scrollLeft = drag.l - (e.clientX - drag.x); sc.scrollTop = drag.t - (e.clientY - drag.y); } };
    const onUp = () => { drag = null; };
    const onDbl = (e: MouseEvent) => zoomAtRef.current(zoomRef.current > 1 ? 1 : 2.5, e.clientX, e.clientY);
    sc.addEventListener("wheel", onWheel, { passive: false });
    sc.addEventListener("touchstart", onStart, { passive: true });
    sc.addEventListener("touchmove", onMove, { passive: false });
    sc.addEventListener("touchend", onEnd);
    sc.addEventListener("mousedown", onDown);
    sc.addEventListener("dblclick", onDbl);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      sc.removeEventListener("wheel", onWheel); sc.removeEventListener("touchstart", onStart);
      sc.removeEventListener("touchmove", onMove); sc.removeEventListener("touchend", onEnd);
      sc.removeEventListener("mousedown", onDown); sc.removeEventListener("dblclick", onDbl);
      window.removeEventListener("mousemove", onMouseMove); window.removeEventListener("mouseup", onUp);
    };
  }, []);
  const docRef = useRef<{ url: string; doc: Promise<PDFDocumentProxy> } | null>(null);
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        // Load the file once per url; rotating or re-rendering reuses it.
        if (docRef.current?.url !== url) {
          docRef.current = { url, doc: (async () => {
            const pdfjs = await import("pdfjs-dist");
            const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
            pdfjs.GlobalWorkerOptions.workerSrc = worker;
            return pdfjs.getDocument({ url, standardFontDataUrl: "/pdf-fonts/", useSystemFonts: false, disableFontFace: true }).promise;
          })() };
        }
        const doc = await docRef.current.doc;
        const el = box.current;
        if (!el || dead) return;
        const first = (await doc.getPage(1)).getViewport({ scale: 1 });
        const portraitScreen = window.innerHeight > window.innerWidth;
        const turn = rotate ?? (first.width > first.height * 1.3 && portraitScreen);
        if (rotate === null) { setRotate(turn); return; }
        const out: HTMLCanvasElement[] = [];
        const dpr = window.devicePixelRatio || 1;
        for (let i = 1; i <= doc.numPages && !dead; i++) {
          const page = await doc.getPage(i);
          const base = page.getViewport({ scale: 1, rotation: turn ? 90 : 0 });
          // Match real screen pixels at the current zoom, capped per page to protect phone memory.
          const want = Math.max(1200, el.clientWidth * dpr);
          const maxPx = 16_000_000, ratio = base.height / base.width;
          const target = Math.min(want, 8000, Math.sqrt(maxPx / ratio));
          const scale = target / base.width;
          const vp = page.getViewport({ scale, rotation: turn ? 90 : 0 });
          const c = document.createElement("canvas");
          c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
          c.style.cssText = "width:100%;height:auto;display:block;margin-bottom:8px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.2)";
          await page.render({ canvasContext: c.getContext("2d")!, viewport: vp }).promise;
          out.push(c);
        }
        // Swap in the sharp pages all at once so nothing flickers.
        if (!dead) el.replaceChildren(...out);
      } catch (e) { if (!dead) setErr((e as Error).message); }
    })();
    return () => { dead = true; };
  }, [url, rotate, sharpZoom]);
  const btn = "flex h-9 w-9 items-center justify-center rounded-full bg-card text-foreground shadow border border-border";
  return (
    <div ref={scroller} className="relative min-h-0 w-full flex-1 cursor-grab overflow-auto bg-muted p-2 select-none" style={{ touchAction: "pan-x pan-y" }}>
      <div className="sticky top-0 z-10 flex justify-end gap-2 pb-2" dir="ltr">
        <button type="button" aria-label="تصغير" className={btn} onClick={() => zoomAt(zoom - 0.5)}><ZoomOut className="h-4 w-4" /></button>
        <button type="button" aria-label="تكبير" className={btn} onClick={() => zoomAt(zoom + 0.5)}><ZoomIn className="h-4 w-4" /></button>
        <button type="button" aria-label="عرض أفقي" className={btn} onClick={() => setRotate((r) => !r)}><RotateCw className="h-4 w-4" /></button>
      </div>
      {err ? <p className="p-4 text-center text-sm text-destructive">تعذر عرض التقرير: {err}</p> : null}
      <div ref={box} style={{ width: `${zoom * 100}%` }}><p className="p-6 text-center text-sm text-muted-foreground">جارٍ تحميل التقرير...</p></div>
    </div>
  );
}
