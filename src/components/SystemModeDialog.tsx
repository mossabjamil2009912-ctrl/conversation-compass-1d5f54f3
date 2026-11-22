import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { getFormulas, saveFormulas } from "@/lib/crm.functions";
import { applyFormulas, type Formulas } from "@/lib/formulas";

// «النظام الحسابي»: the only place that switches app + bot between equations and ranges.
export function SystemModeDialog({ pw, code, onClose }: { pw: string; code: string; onClose: () => void }) {
  const qc = useQueryClient();
  const get = useServerFn(getFormulas), save = useServerFn(saveFormulas);
  const [mode, setMode] = useState<Formulas["mode"] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  useEffect(() => { get({ data: { pw } }).then((r) => setMode(r.formulas.mode)).catch((e) => setMsg({ ok: false, t: e.message })); }, []);

  const pick = async (m: Formulas["mode"]) => {
    if (m === mode) return;
    setBusy(true); setMsg(null);
    try {
      const cur = await get({ data: { pw } });
      const r = await save({ data: { pw, code, formulas: { ...cur.formulas, mode: m } as unknown as Record<string, unknown> } });
      applyFormulas(r.formulas); setMode(r.formulas.mode);
      await qc.invalidateQueries({ queryKey: ["formulas"] });
      setMsg({ ok: true, t: "تم التفعيل — يطبَّق في التطبيق والبوت فوراً" });
    } catch (e) { setMsg({ ok: false, t: (e as Error).message }); }
    setBusy(false);
  };

  return (
    <div dir="rtl" className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/40 p-4" onClick={onClose}>
      <div className="w-full max-w-xs space-y-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h2 className="font-bold">النظام الحسابي</h2><button onClick={onClose} aria-label="إغلاق"><X className="h-4 w-4" /></button></div>
        <p className="text-[11px] text-muted-foreground">النظام المفعّل هنا هو الذي يحسب به التطبيق والبوت.</p>
        {!mode ? <p className="text-xs text-muted-foreground">جاري التحميل…</p> : (
          <div className="space-y-2">
            {([["eq", "استخدام نظام المعادلات"], ["ranges", "استخدام نظام النطاقات"]] as const).map(([k, l]) => (
              <button key={k} disabled={busy} onClick={() => pick(k)} aria-pressed={mode === k}
                className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${mode === k ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted"}`}>
                <span className={`h-3.5 w-3.5 rounded-full border-2 ${mode === k ? "border-primary-foreground bg-primary-foreground" : "border-muted-foreground"}`} />
                {l}{mode === k && <span className="ms-auto text-[10px]">مفعّل</span>}
              </button>
            ))}
          </div>
        )}
        {msg && <p className={`text-xs ${msg.ok ? "text-primary" : "text-destructive"}`}>{msg.t}</p>}
      </div>
    </div>
  );
}
