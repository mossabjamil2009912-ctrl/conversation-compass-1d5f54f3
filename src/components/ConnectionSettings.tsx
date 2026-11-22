import { useEffect, useRef, useState } from "react";
import { FormulasDialog } from "@/components/FormulasDialog";
import { Settings, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { SystemModeDialog } from "@/components/SystemModeDialog";
import { AppUpdatePanel } from "@/components/AppUpdatePanel";
import { getFrontendUrl, saveFrontendUrl, testFrontendUrl, verifyFlowPin } from "@/lib/crm.functions";

export function ConnectionSettings({ pw }: { pw: string }) {
  const [open, setOpen] = useState(false);
  const verifyPin = useServerFn(verifyFlowPin);
  // Hidden: hold the gear 3 seconds → code (checked on server) → "المعادلات" button.
  const holdT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const [askCode, setAskCode] = useState(false);
  const [code, setCode] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [showM, setShowM] = useState(false);
  const [showF, setShowF] = useState(false);
  const startHold = () => { held.current = false; holdT.current = setTimeout(() => { held.current = true; setCode(""); setAskCode(true); }, 3000); };
  const endHold = () => { if (holdT.current) clearTimeout(holdT.current); holdT.current = null; };
  const [current, setCurrent] = useState("");
  const [def, setDef] = useState("");
  const [url, setUrl] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const get = useServerFn(getFrontendUrl);
  const test = useServerFn(testFrontendUrl);
  const save = useServerFn(saveFrontendUrl);

  useEffect(() => {
    if (!open) return;
    setMsg(null);
    get().then((r) => { setCurrent(r.url); setDef(r.defaultUrl); setUrl(r.url); }).catch((e) => setMsg({ ok: false, t: e.message }));
  }, [open]);

  const run = async (fn: () => Promise<{ ok: boolean; message: string; url?: string }>) => {
    setBusy(true); setMsg(null);
    try { const r = await fn(); setMsg({ ok: r.ok, t: r.message }); if (r.ok && r.url) { setCurrent(r.url); setUrl(r.url); window.dispatchEvent(new CustomEvent("actes-frontend-changed", { detail: r.url })); } }
    catch (e) { setMsg({ ok: false, t: (e as Error).message }); }
    setBusy(false);
  };

  return (
    <>
      <button onClick={() => { if (held.current) { held.current = false; return; } setOpen(true); }}
        onPointerDown={startHold} onPointerUp={endHold} onPointerLeave={endHold} onPointerCancel={endHold} onContextMenu={(e) => e.preventDefault()}
        style={{ touchAction: "none", WebkitTouchCallout: "none", userSelect: "none" }} aria-label="إعدادات الاتصال" title="إعدادات الاتصال" className="rounded-md p-1.5 hover:bg-ink-foreground/10">
        <Settings className="h-4 w-4" />
      </button>
      {showM && <SystemModeDialog pw={pw} code={code} onClose={() => setShowM(false)} />}
      {askCode && (
        <div dir="rtl" className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/40 p-4" onClick={() => setAskCode(false)}>
          <form className="w-full max-w-xs space-y-2 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-lg" onClick={(e) => e.stopPropagation()}
            onSubmit={async (e) => { e.preventDefault(); const r = await verifyPin({ data: { pw, code } }).catch(() => ({ ok: false })); if (r.ok) { setUnlocked(true); setAskCode(false); setOpen(true); } else setCode(""); }}>
            <h2 className="text-sm font-bold">أدخل الرمز</h2>
            <input autoFocus type="password" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-center tracking-widest" />
            <button type="submit" className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">دخول</button>
          </form>
        </div>
      )}
      {showF && <FormulasDialog pw={pw} code={code} onClose={() => setShowF(false)} />}
      {open && (
        <div dir="rtl" className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md space-y-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold">إعدادات الاتصال</h2>
              <button onClick={() => setOpen(false)} aria-label="إغلاق"><X className="h-4 w-4" /></button>
            </div>
            <div className="text-sm"><span className="text-muted-foreground">رابط واجهة التطبيق: </span><span dir="ltr" className="font-mono">{current || "..."}</span></div>
            <input dir="ltr" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..."
              className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm" />
            {msg && <p className={`text-sm ${msg.ok ? "text-primary" : "text-destructive"}`}>{msg.t}</p>}
            <div className="flex flex-wrap gap-2">
              <button disabled={busy} onClick={() => run(() => test({ data: { pw, url } }))} className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-semibold disabled:opacity-50">اختبار الاتصال</button>
              <button disabled={busy} onClick={() => run(() => save({ data: { pw, url } }))} className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">حفظ التغييرات</button>
              <button disabled={busy} onClick={() => run(() => save({ data: { pw, url: def, reset: true } }))} className="w-full rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50">استعادة الرابط الافتراضي</button>
            </div>
            {unlocked && (
              <div className="flex gap-2">
                <button onClick={() => { setOpen(false); setShowF(true); }} className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground">المعادلات</button>
                <button onClick={() => { setOpen(false); setShowM(true); }} className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground">النظام الحسابي</button>
              </div>
            )}
            <AppUpdatePanel />
          </div>
        </div>
      )}
    </>
  );
}
