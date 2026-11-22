import { X, Calculator } from "lucide-react";
import { explainEquations, type DetailLine } from "@/lib/equation-details";
import type { EqItem } from "@/lib/formulas";
import { MathStep } from "@/components/MathStep";

export function EquationDetails({ lines, items, need, nightPct, onClose }: { lines: DetailLine[]; items: EqItem[]; need: number | null; nightPct: number | null; onClose: () => void }) {
  const rows = explainEquations(lines, items, { need, nightPct });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-3 animate-in fade-in" onClick={onClose}>
      <div className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-card shadow-2xl animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b p-3">
          <Calculator className="h-4 w-4 text-primary" />
          <b className="flex-1 text-sm">تفاصيل الحساب بالمعادلات</b>
          <button onClick={onClose} aria-label="إغلاق" className="rounded-md p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          {rows.length === 0 && <p className="text-center text-xs text-muted-foreground">لا توجد أصناف محسوبة بالمعادلات في هذا العرض (يلزم إنفرتر وألواح).</p>}
          {rows.map((r, i) => (
            <div key={i} className="rounded-lg border bg-muted/30 p-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><div className="text-xs font-bold">{r.title}</div>{r.item && <div className="truncate text-[10px] text-muted-foreground">{r.item}</div>}</div>
                <span className="shrink-0 rounded bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">{r.result}</span>
              </div>
              <div className="mt-1 divide-y divide-border/60 rounded-md border-r-2 border-primary/40 bg-card px-2">
                {r.steps.map((s, j) => <MathStep key={j} s={s} />)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
