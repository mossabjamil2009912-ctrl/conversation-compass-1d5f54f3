import React, { useEffect, useState } from "react";
import { X, Maximize2, Minimize2, ZoomIn, ZoomOut } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getFormulas, saveFormulas, getKwhPrice, setKwhPrice, listCatalog } from "@/lib/crm.functions";
import { offlineQuery } from "@/lib/offline-cache";
import { DEFAULT_FORMULAS, applyFormulas, type Formulas } from "@/lib/formulas";
import { BOT_PRESETS } from "@/lib/bot-presets";
import { PRESETS, comKeyOf, panelsOf, defaultPresetItems } from "@/components/QuoteBuilder";

const RES = BOT_PRESETS.filter((p) => p.type !== "com");
const COM = PRESETS.filter((p) => p.type === "com");
const clampZ = (z: number) => Math.min(2.5, Math.max(0.6, Math.round(z * 100) / 100));
const groupsOf = <T extends { group: string }>(l: T[]) => [...new Set(l.map((p) => p.group))];

// Keeps bracketed English/number parts like "(1500V)" in one piece inside Arabic text.
const bidi = (t: string) => t.split(/(\([^()]*[A-Za-z√][^()]*\))/).map((x, i) => (i % 2 ? <bdi key={i} dir="ltr">{x}</bdi> : x));

function Num({ label, value, onChange, hint }: { label: string; value: number; onChange: (v: number) => void; hint?: string }) {
  const [t, setT] = useState(String(value));
  useEffect(() => setT(String(value)), [value]);
  return (
    <label className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-2 py-1.5 text-xs">
      <span className="min-w-0">{bidi(label)}{hint && <span className="block text-[10px] text-muted-foreground">{bidi(hint)}</span>}</span>
      <input value={t} inputMode="decimal" onChange={(e) => { const s = e.target.value.replace(/[^\d.]/g, ""); setT(s); const n = Number(s); if (n > 0) onChange(n); }}
        className="w-20 shrink-0 rounded-md border border-border bg-card px-2 py-1 text-center font-bold" />
    </label>
  );
}

type Cat = { key: string; name: string; category: string; price: number | string | null };
const CAT_AR: Record<string, string> = { inverters: "الإنفرترات", panels: "الألواح", batteries: "البطاريات" };

// Items of one ready-made system: tap an item to swap it for another of the same category, change its count, delete or add.
function PresetItems({ title, base, value, cat, onChange }: { title: string; base: [string, number][]; value?: [string, number][] | undefined; cat: Cat[]; onChange: (v: [string, number][] | null) => void }) {
  const [open, setOpen] = useState(false);
  const [swap, setSwap] = useState<number | null>(null);
  const [add, setAdd] = useState(false);
  const list = value ?? base;
  const nameOf = (k: string) => cat.find((c) => c.key === k)?.name ?? k;
  const set = (l: [string, number][]) => onChange(l.length ? l : null);
  return (
    <div className="rounded-lg border border-border bg-background">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-right text-[11px]">
        <span className="min-w-0 font-semibold">{bidi(title)}</span>
        <span className={`shrink-0 rounded px-1.5 ${value ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{value ? "أصناف معدّلة" : "الأصناف"} {open ? "▲" : "▼"}</span>
      </button>
      {open && <div className="space-y-1 border-t border-border p-1.5">
        {list.map(([k, q], i) => {
          const c = cat.find((x) => x.key === k);
          return (
            <div key={i} className="space-y-1 rounded-md bg-muted/50 p-1">
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setSwap(swap === i ? null : i)} className="min-w-0 flex-1 text-right text-[11px] underline decoration-dotted">{bidi(nameOf(k))}</button>
                <input inputMode="numeric" defaultValue={q} key={k + q} onBlur={(e) => { const n = Number(e.target.value); if (n > 0 && n !== q) set(list.map((x, j) => (j === i ? [x[0], n] : x))); }} className="w-14 rounded-md border border-border bg-card px-1 py-0.5 text-center text-xs font-bold" aria-label="العدد" />
                <button type="button" onClick={() => set(list.filter((_, j) => j !== i))} aria-label="حذف" className="px-1 text-destructive"><X className="h-3.5 w-3.5" /></button>
              </div>
              {swap === i && <div className="max-h-48 space-y-0.5 overflow-y-auto rounded border border-border bg-card p-1">
                <div className="text-[10px] text-muted-foreground">{c ? `اختر بديلاً من ${CAT_AR[c.category] ?? c.category}` : "اختر صنفاً"}</div>
                {cat.filter((x) => !c || x.category === c.category).map((x) => (
                  <button type="button" key={x.key} onClick={() => { set(list.map((y, j) => (j === i ? [x.key, y[1]] : y))); setSwap(null); }} className={`block w-full rounded px-1 py-1 text-right text-[11px] hover:bg-muted ${x.key === k ? "bg-primary/10 font-bold" : ""}`}>{bidi(x.name)} {x.price != null && <span className="text-muted-foreground">· {Number(x.price)}$</span>}</button>
                ))}
              </div>}
            </div>
          );
        })}
        {add ? <select autoFocus defaultValue="" onChange={(e) => { if (e.target.value) set([...list, [e.target.value, 1]]); setAdd(false); }} className="w-full rounded-md border border-border bg-card p-1 text-[11px]">
          <option value="">اختر صنفاً لإضافته…</option>
          {[...new Set(cat.map((c) => c.category))].map((g) => <optgroup key={g} label={CAT_AR[g] ?? g}>{cat.filter((c) => c.category === g).map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}</optgroup>)}
        </select> : <div className="grid grid-cols-2 gap-1">
          <button type="button" onClick={() => setAdd(true)} className="rounded-md border border-border px-1 py-1 text-[11px]">+ إضافة صنف</button>
          <button type="button" disabled={!value} onClick={() => onChange(null)} className="rounded-md border border-border px-1 py-1 text-[11px] disabled:opacity-40">استعادة الأصناف الأصلية</button>
        </div>}
      </div>}
    </div>
  );
}

function Eq({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5 rounded-xl border border-border p-2">
      <div className="text-xs font-bold"><span className="ml-1 rounded bg-primary px-1.5 text-primary-foreground">{n}</span>{bidi(title)}</div>
      {children}
    </div>
  );
}

export function FormulasDialog({ pw, code, onClose }: { pw: string; code: string; onClose: () => void }) {
  const qc = useQueryClient();
  const get = useServerFn(getFormulas), save = useServerFn(saveFormulas), getK = useServerFn(getKwhPrice), saveK = useServerFn(setKwhPrice);
  const [f, setF] = useState<Formulas | null>(null);
  const [kwh, setKwh] = useState(290);
  const [tab, setTab] = useState<"res" | "com">("com");
  // What is shown for editing only; the active system is chosen in «النظام الحسابي».
  const [view, setView] = useState<"eq" | "ranges">("eq");
  const [resSub, setResSub] = useState<"small" | "big">("small");
  const [comSub, setComSub] = useState<"lv" | "hv">("lv");
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { get({ data: { pw } }).then((r) => setF(r.formulas)).catch((e) => setMsg({ ok: false, t: e.message })); getK({ data: { pw } }).then((r) => setKwh(r.kwh_price)).catch(() => {}); }, []);
  const listC = useServerFn(listCatalog);
  const { data: rows = [] } = useQuery(offlineQuery({ queryKey: ["catalog"], queryFn: () => listC({ data: { pw } }) }));
  const cat = (rows as (Cat & { kind: string; active: boolean })[]).filter((r) => r.kind === "item" && r.active);
  const setItems = (title: string, v: [string, number][] | null) => setF((o) => { if (!o) return o; const m = { ...o.presetItems }; if (v) m[title] = v; else delete m[title]; return { ...o, presetItems: m }; });
  const itemsOf = (p: Parameters<typeof defaultPresetItems>[0]) => f ? <PresetItems title={p.title} base={defaultPresetItems(p)} value={f.presetItems[p.title]} cat={cat} onChange={(v) => setItems(p.title, v)} /> : null;
  const up = (p: Partial<Formulas>) => setF((o) => (o ? { ...o, ...p } : o));
  const setRange = (i: number, j: number, v: number) => setF((o) => { if (!o) return o; const r = o.resRanges.map((x) => [...x]); r[i]![j] = v; return { ...o, resRanges: r }; });

  const doSave = async () => {
    if (!f) return;
    setBusy(true); setMsg(null);
    try {
      // Keep the active system as stored: only «النظام الحسابي» may change it.
      const cur = await get({ data: { pw } });
      const r = await save({ data: { pw, code, formulas: { ...f, mode: cur.formulas.mode } as unknown as Record<string, unknown> } });
      await saveK({ data: { pw, price: kwh } });
      applyFormulas(r.formulas);
      await qc.invalidateQueries({ queryKey: ["formulas"] }); await qc.invalidateQueries({ queryKey: ["kwh_price"] });
      setMsg({ ok: true, t: "تم الحفظ — يطبَّق في التطبيق والبوت فوراً" });
    } catch (e) { setMsg({ ok: false, t: (e as Error).message }); }
    setBusy(false);
  };

  // Math rendering: brackets are drawn with borders and fractions are stacked,
  // so right-to-left text can never flip or misplace them.
  type K = { children?: React.ReactNode };
  const L = ({ children }: K) => <div className="eq-box space-y-1.5 rounded-lg border border-primary/30 bg-muted/60 px-2.5 py-2 text-[13px] leading-6">{children}</div>;
  const Ln = ({ l, children }: K & { l: React.ReactNode }) => (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
      <span className="font-semibold text-foreground">{l}</span><span className="font-bold text-primary">=</span>
      <span className="inline-flex flex-wrap items-center gap-x-1 gap-y-1">{children}</span>
    </div>
  );
  const Nt = ({ children }: K) => <div className="text-[11px] leading-5 text-muted-foreground">{children}</div>;
  const O = ({ c }: { c: string }) => <span className="px-0.5 font-bold text-primary">{c}</span>;
  const V = ({ children }: K) => <bdi dir="ltr" className="eq-v">{children}</bdi>;
  const R = ({ children }: K) => <span className="inline-flex flex-wrap items-center justify-center gap-x-1">{children}</span>;
  const Fr = ({ n, d }: { n: React.ReactNode; d: React.ReactNode }) => (
    <span className="mx-0.5 inline-flex flex-col items-stretch text-center align-middle leading-5">
      <span className="border-b-[1.5px] border-foreground/70 px-1 pb-0.5">{n}</span><span className="px-1 pt-0.5">{d}</span>
    </span>
  );
  const P = ({ children }: K) => <span className="eq-paren inline-flex items-center gap-x-1 border-x-[1.5px] border-primary px-2 py-0.5">{children}</span>;

  const Ceil = P;
  const Floor = P;

  const need = (fx: Formulas, com = false) => (
    <Eq n={1} title="معادلة الاستهلاك اليومي">
      <L>
        <Ln l="الاستهلاك الشهري"><Fr n="الفاتورة" d="سعر الكيلووات" /></Ln>
        {com && <><Ln l="أو مباشرة">الكيلووات الشهري</Ln><Ln l="أو"><Fr n="لترات الديزل" d={<V>0.27</V>} /></Ln></>}
        <Ln l="الاستهلاك اليومي"><Fr n="الاستهلاك الشهري" d="أيام الشهر" /></Ln>
      </L>
      <Num label="سعر الكيلووات (ريال يمني)" value={kwh} onChange={setKwh} />
      <Num label="أيام الشهر" value={fx.days} onChange={(v) => up({ days: v })} />
    </Eq>
  );
  const per = (v: number, fx: Formulas) => Math.max(1, Math.floor(v / (fx.panelVoc * fx.coldFactor)));
  const items = (fx: Formulas, hv: boolean, single = false) => {
    const vmax = hv ? fx.vmaxHV : fx.vmaxThree;
    let n = 0;
    return (<>
      {need(fx, !single)}
      <Eq n={++n + 1} title="صنف الألواح الشمسية">
        <L>
          <Ln l="إجمالي عدد الألواح"><Ceil><Fr n={<R>الاستهلاك اليومي<O c="×" /><V>1000</V></R>} d={<R>ساعات الإشعاع<O c="×" />قدرة اللوح</R>} /></Ceil></Ln>
          <Ln l="سعة الاسترنق (أقصى ألواح بالسلسلة)"><Floor><Fr n="أقصى جهد الإنفرتر" d={<R><V>Voc</V><O c="×" />معامل الحرارة</R>} /></Floor></Ln>
          <Nt>تُوزَّع الألواح بالتساوي على الاسترنقات مع التقريب للأعلى</Nt>
        </L>
        <Num label="ساعات الإشعاع اليومي" value={fx.sun} onChange={(v) => up({ sun: v })} />
        <Num label="قدرة اللوح (واط)" value={fx.panelW} onChange={(v) => up({ panelW: v })} />
        <Num label="جهد اللوح Voc (فولت)" value={fx.panelVoc} onChange={(v) => up({ panelVoc: v })} />
        <Num label="معامل الأمان الحراري" value={fx.coldFactor} onChange={(v) => up({ coldFactor: v })} />
        {!hv && <Num label="أقصى جهد إنفرتر سنجل فاز (فولت)" value={fx.vmaxSingle} onChange={(v) => up({ vmaxSingle: v })} />}
        {!hv && !single && <Num label="أقصى جهد إنفرتر ثري فاز (فولت)" value={fx.vmaxThree} onChange={(v) => up({ vmaxThree: v })} />}
        {hv && <Num label="أقصى جهد إنفرتر هاي فولتج (فولت)" value={fx.vmaxHV} onChange={(v) => up({ vmaxHV: v })} />}
        <p className="text-xs text-muted-foreground">النتيجة الآن: {single ? `سنجل ${per(fx.vmaxSingle, fx)} لوح بالاسترنق` : hv ? `هاي فولتج ${per(vmax, fx)} لوح بالاسترنق` : `سنجل ${per(fx.vmaxSingle, fx)} · ثري ${per(fx.vmaxThree, fx)} لوح بالاسترنق`}</p>
      </Eq>
      <Eq n={++n + 1} title={hv ? "صنف إنفرتر الجهد العالي" : single ? "صنف الإنفرتر (Single Phase 8 / 12)" : "صنف الإنفرتر"}>
        <L>
          <Ln l="القدرة المطلوبة">الأكبر من<P>حمل الذروة<O c="،" /><Fr n="إجمالي قدرة الألواح" d="نسبة الألواح للإنفرتر" /></P></Ln>
          <Ln l="عدد الإنفرترات"><Ceil><Fr n="القدرة المطلوبة" d="قدرة الإنفرتر" /></Ceil></Ln>
          <Nt>عدد الإنفرترات لا يتجاوز الحد الأقصى بالتوازي</Nt>
          <Nt>{hv ? "يُستخدم الهاي فولتج عندما تتجاوز القدرة حد الجهد المنخفض" : "جهد منخفض ما دامت القدرة ≤ حد الجهد المنخفض"}</Nt>
        </L>
        <Num label="نسبة الألواح إلى الإنفرتر (دايا)" value={fx.dcRatio} onChange={(v) => up({ dcRatio: v })} />
        <Num label="نسبة الألواح إلى الإنفرتر (سوليس)" value={fx.dcRatioSolis} onChange={(v) => up({ dcRatioSolis: v })} />
        <Num label="أقصى قدرة للجهد المنخفض (كيلو)" value={fx.lvMaxKw} onChange={(v) => up({ lvMaxKw: v })} />
        <Num label="أقصى عدد إنفرترات بالتوازي" value={fx.maxInverters} onChange={(v) => up({ maxInverters: Math.round(v) })} />
      </Eq>
      <Eq n={++n + 1} title={hv ? "نظام التخزين" : "صنف بطاريات الليثيوم"}>
        <L>
          {hv && <Nt>السعة المطلوبة</Nt>}
          <Ln l={hv ? "السعة (استهلاك الليل)" : "استهلاك الليل"}>الاستهلاك اليومي<O c="×" />نسبة الليل</Ln>
          {hv && <Nt>خيار 1 — راكات Hithium 16 HV (الافتراضي)</Nt>}
          {(() => {
            const c = <Ceil><Fr n={<R>استهلاك الليل<O c="−" />السماحية</R>} d={<R>سعة البطارية<O c="×" />التفريغ</R>} /></Ceil>;
            return <Ln l="عدد البطاريات">{hv ? <>الأكبر من<P>أقل عدد<O c="،" />{c}</P></> : c}</Ln>;
          })()}
          {hv && <>
            <Nt>خيار 2 — راكات Pylontech M1 أو M5</Nt>
            <Nt>خيار 3 — كبائن التخزين (Hithium 112C · Pylontech 261 · Pylontech 313)</Nt>
            <Ln l="عدد الكبائن">أقرب عدد صحيح لـ<P><Fr n="السعة" d="سعة الكبينة" /></P></Ln>
            <Ln l="الفرق"><P>السعة<O c="−" />عدد الكبائن<O c="×" />سعة الكبينة</P></Ln>
            <Nt>تظهر الكبينة فقط إذا كان الفرق بين −السماحية و +السماحية، وإلا تختفي</Nt>
          </>}
        </L>
        <Num label="نسبة الليل عند اختيار 30% ليل" value={fx.night[30]} onChange={(v) => up({ night: { ...fx.night, 30: v } })} />
        <Num label="نسبة الليل عند اختيار 50/50" value={fx.night[50]} onChange={(v) => up({ night: { ...fx.night, 50: v } })} />
        <Num label="نسبة الليل عند اختيار 70% ليل" value={fx.night[70]} onChange={(v) => up({ night: { ...fx.night, 70: v } })} />
        <Num label="معامل تفريغ البطارية" value={fx.dod} onChange={(v) => up({ dod: Math.min(v, 1) })} />
        <Num label={hv ? "سعة بطارية Hithium 16 HV (كيلووات ساعة)" : "سعة البطارية (كيلووات ساعة)"} value={fx.batKwh} onChange={(v) => up({ batKwh: v })} />
        <Num label="سماحية نقص الليل (كيلووات ساعة)" value={fx.batTol} onChange={(v) => up({ batTol: v })} />
        {hv && <>
          <Num label="أقل عدد بطاريات Hithium 16 HV" value={fx.hvMinBat} onChange={(v) => up({ hvMinBat: Math.round(v) })} />
          <Num label="سعة كبينة Hithium 112C (كيلووات ساعة)" value={fx.cabKwh} onChange={(v) => up({ cabKwh: v })} />
          <Num label="سماحية الكبائن ± (كيلووات ساعة)" value={fx.cabTol} onChange={(v) => up({ cabTol: v })} />
          <Num label="سعة بطارية بايلونتك M1 (كيلووات ساعة)" value={fx.m1Kwh} onChange={(v) => up({ m1Kwh: v })} />
          <Num label="سعة بطارية بايلونتك M5 (كيلووات ساعة)" value={fx.m5Kwh} onChange={(v) => up({ m5Kwh: v })} />
        </>}
      </Eq>
      {hv && <Eq n={++n + 1} title="صنف بطاريات وراك بايلونتك M1">
        <L>
          <Ln l={<>بطاريات <V>M1</V></>}>الأكبر من<P><V>{fx.m1MinBat}</V><O c="،" /><Fr n="السعة" d={<R>سعة <V>M1</V></R>} /></P></Ln>
          <Ln l={<>عدد راكات <V>M1</V></>}><Ceil><Fr n={<R>بطاريات <V>M1</V></R>} d={<V>{fx.m1MaxBat}</V>} /></Ceil></Ln>
          <Ln l="بطاريات كل راك"><Ceil><Fr n="البطاريات" d="عدد الراكات" /></Ceil></Ln>
          <Ln l="مقاس الراك">راك <V>{fx.m1RackSmall}</V> إذا بطاريات كل راك ≤ <V>{fx.m1RackSmall}</V></Ln>
          <Ln l="">راك <V>{fx.m1MaxBat}</V> إذا بطاريات كل راك أكبر من <V>{fx.m1RackSmall}</V></Ln>
        </L>
        <Num label="أقل عدد بطاريات M1" value={fx.m1MinBat} onChange={(v) => up({ m1MinBat: Math.round(v) })} />
        <Num label="سعة الراك الصغير M1 (بطارية)" value={fx.m1RackSmall} onChange={(v) => up({ m1RackSmall: Math.round(v) })} />
        <Num label="أقصى عدد بطاريات M1 (الراك الكبير)" value={fx.m1MaxBat} onChange={(v) => up({ m1MaxBat: Math.round(v), m1MaxKwh: Math.round(v) * fx.m1Kwh })} />
      </Eq>}
      {hv && <Eq n={++n + 1} title="صنف بطاريات وراك بايلونتك M5">
        <L>
          <Ln l={<>بطاريات <V>M5</V></>}>الأكبر من<P><V>{fx.m5MinBat}</V><O c="،" /><Fr n="السعة" d={<R>سعة <V>M5</V></R>} /></P></Ln>
          <Ln l={<>عدد راكات <V>M5</V></>}><Ceil><Fr n={<R>بطاريات <V>M5</V></R>} d={<V>{fx.m5MaxBat}</V>} /></Ceil></Ln>
          <Ln l="بطاريات كل راك"><Ceil><Fr n="البطاريات" d="عدد الراكات" /></Ceil></Ln>
          <Ln l="مقاس الراك">راك <V>{fx.m5RackSmall}</V> إذا بطاريات كل راك ≤ <V>{fx.m5RackSmall}</V></Ln>
          <Ln l="">راك <V>{fx.m5RackMedium}</V> إذا بطاريات كل راك ≤ <V>{fx.m5RackMedium}</V></Ln>
          <Ln l="">راك <V>{fx.m5MaxBat}</V> إذا بطاريات كل راك أكبر من <V>{fx.m5RackMedium}</V></Ln>
        </L>
        <Num label="أقل عدد بطاريات M5" value={fx.m5MinBat} onChange={(v) => up({ m5MinBat: Math.round(v) })} />
        <Num label="سعة الراك الصغير M5 (بطارية)" value={fx.m5RackSmall} onChange={(v) => up({ m5RackSmall: Math.round(v) })} />
        <Num label="سعة الراك الوسط M5 (بطارية)" value={fx.m5RackMedium} onChange={(v) => up({ m5RackMedium: Math.round(v) })} />
        <Num label="أقصى بطاريات في راك M5" value={fx.m5MaxBat} onChange={(v) => up({ m5MaxBat: Math.round(v) })} />
      </Eq>}
      {hv && <Eq n={++n + 1} title="صنف كنترول الهاي فولتج BCU">
        <L>
          <Ln l={<>عدد <V>BCU</V></>}><Ceil><Fr n="عدد البطاريات" d={<R>بطاريات كل كنترول</R>} /></Ceil></Ln>
          <Nt>كل كنترول يأخذ حتى <V>{fx.hvBatPerBcu}</V> بطارية، والباقي يروح للكنترول الأخير</Nt>
        </L>
        <Num label="أقصى بطاريات لكل كنترول BCU" value={fx.hvBatPerBcu} onChange={(v) => up({ hvBatPerBcu: Math.round(v) })} />
      </Eq>}
      {hv && <Eq n={++n + 1} title="صنف كنترول الربط الإضافي EBC">
        <L>
          <Ln l={<>عدد <V>EBC</V></>}>عدد الكنترولات التي فيها أكثر من <V>{fx.ebcOver}</V> بطاريات</Ln>
        </L>
        <Num label="يحتاج EBC إذا زادت بطاريات الكنترول عن" value={fx.ebcOver} onChange={(v) => up({ ebcOver: Math.round(v) })} />
      </Eq>}
      {hv && <Eq n={++n + 1} title="صنف قاطع حماية البطاريات">
        <L><Ln l="عدد القواطع">عدد وحدات <V>BCU</V></Ln></L>
      </Eq>}
      <Eq n={++n + 1} title={hv ? "صنف صناديق حماية DC (1500V)" : "صنف صندوق حماية DC"}>
        <L>
          <Ln l="عدد الصناديق"><Ceil><Fr n="عدد الاسترنقات" d="أقصى خطوط الصندوق" /></Ceil></Ln>
          <Ln l="خطوط الصندوق"><Fr n="عدد الاسترنقات" d="عدد الصناديق" /></Ln>
          <Nt>تُقرَّب خطوط الصندوق لأقرب مقاس زوجي أعلى: 2 · 4 · 6 · 8 · 10</Nt>
        </L>
        <Num label="أقصى خطوط للصندوق الواحد" value={fx.dcMaxLines} onChange={(v) => up({ dcMaxLines: v })} />
        <Num label="تدرج مقاسات الصناديق (خطوط)" value={fx.dcStep} onChange={(v) => up({ dcStep: v })} />
      </Eq>
      <Eq n={++n + 1} title="صنف لوحة AC / لوحة التجميع">
        <L>
          {!hv && <Ln l="قاطع سنجل فاز"><Fr n="واط الإنفرترات" d="جهد السنجل" /><O c="×" />معامل الأمان</Ln>}
          {!single && <Ln l="قاطع ثري فاز"><Fr n="واط الإنفرترات" d={<R><V>√3</V><O c="×" /><V>380</V></R>} /><O c="×" />معامل الأمان</Ln>}
          {!single && <Nt>إنفرتر واحد ← لوحة AC · إنفرتران فأكثر ← لوحة تجميع</Nt>}
        </L>
        {!hv && <Num label="جهد سنجل فاز (فولت)" value={fx.acSingleV} onChange={(v) => up({ acSingleV: v })} />}
        {!single && <Num label="مقسوم ثري فاز (√3×380)" value={fx.acThreeDiv} onChange={(v) => up({ acThreeDiv: v })} />}
        <Num label="معامل الأمان" value={fx.acSafety} onChange={(v) => up({ acSafety: v })} />
      </Eq>
      <Eq n={++n + 1} title="صنف الكابل">
        <L><Ln l="أمتار الكابل">ثابت</Ln></L>
        <Num label="أمتار الكابل في العرض" value={fx.cableM} onChange={(v) => up({ cableM: v })} />
      </Eq>
      <Eq n={++n + 1} title="صنف كنشات MC4">
        <L><Ln l={<>أطقم <V>MC4</V></>}>عدد الاسترنقات<O c="×" />أطقم لكل استرنق</Ln></L>
        <Num label="أطقم الكنشات MC4 لكل استرنق" value={fx.mc4PerString} onChange={(v) => up({ mc4PerString: v })} />
      </Eq>
    </>);
  };

  const [full, setFull] = useState(false);
  const [zoom, setZoom] = useState(1);
  const boxRef = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = boxRef.current; if (!el) return;
    // Ctrl/⌘ + mouse wheel (and laptop touchpad pinch) zooms the content.
    const wheel = (e: WheelEvent) => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); setZoom((z) => clampZ(z * (e.deltaY < 0 ? 1.08 : 1 / 1.08))); };
    // Two-finger pinch on touch screens.
    let d0 = 0, z0 = 1;
    const dist = (t: TouchList) => Math.hypot(t[0]!.clientX - t[1]!.clientX, t[0]!.clientY - t[1]!.clientY);
    const ts = (e: TouchEvent) => { if (e.touches.length === 2) { d0 = dist(e.touches); setZoom((z) => (z0 = z)); } };
    const tm = (e: TouchEvent) => { if (e.touches.length === 2 && d0) { e.preventDefault(); const r = dist(e.touches) / d0; setZoom(clampZ(z0 * r)); } };
    const te = () => { d0 = 0; };
    el.addEventListener("wheel", wheel, { passive: false });
    el.addEventListener("touchstart", ts, { passive: true });
    el.addEventListener("touchmove", tm, { passive: false });
    el.addEventListener("touchend", te);
    return () => { el.removeEventListener("wheel", wheel); el.removeEventListener("touchstart", ts); el.removeEventListener("touchmove", tm); el.removeEventListener("touchend", te); };
  }, []);

  const small = RES.map((p, i) => (/^إنفرتر (1\.6|6\.2) /.test(p.group) ? i : -1)).filter((i) => i >= 0);

  return (
    <div dir="rtl" className={`fixed inset-0 z-[60] flex items-center justify-center bg-foreground/40 ${full ? "p-0" : "p-2"}`} onClick={onClose}>
      <div ref={boxRef} className={`flex flex-col gap-2 border border-border bg-card p-3 text-card-foreground shadow-lg ${full ? "h-full w-full rounded-none" : "max-h-[92vh] w-full max-w-lg rounded-xl"}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2"><h2 className="font-bold">المعادلات</h2>
          <div className="flex items-center gap-1">
            <button onClick={() => setZoom((z) => clampZ(z - 0.1))} aria-label="تصغير" className="rounded-md border border-border p-1"><ZoomOut className="h-4 w-4" /></button>
            <button onClick={() => setZoom(1)} className="min-w-12 rounded-md border border-border px-1 py-0.5 text-[11px] font-bold" aria-label="الحجم الأصلي">{Math.round(zoom * 100)}%</button>
            <button onClick={() => setZoom((z) => clampZ(z + 0.1))} aria-label="تكبير" className="rounded-md border border-border p-1"><ZoomIn className="h-4 w-4" /></button>
            <button onClick={() => setFull(!full)} aria-label={full ? "تصغير النافذة" : "ملء الشاشة"} className="rounded-md border border-border p-1">{full ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</button>
            <button onClick={onClose} aria-label="إغلاق" className="p-1"><X className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-2" style={{ zoom }}>
        <div className="grid grid-cols-2 gap-1 text-[11px] font-semibold">
          {([["eq", "تعديل المعادلات"], ["ranges", "تعديل النطاقات"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setView(k)} className={`rounded-lg px-1 py-1.5 ${view === k ? "bg-ink text-ink-foreground" : "bg-muted"}`}>{l}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1 text-[11px] font-semibold">
          {([["res", "معادلات النظام السكني"], ["com", "معادلات النظام التجاري"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`rounded-lg px-1 py-1.5 ${tab === k ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{l}</button>
          ))}
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
          {!f ? <p className="text-xs text-muted-foreground">جاري التحميل…</p> : view === "ranges" ? (
            tab === "res" ? (
              <div className="space-y-2">
                <p className="text-[11px] text-muted-foreground">نطاق كل منظومة = الاستهلاك اليومي (كيلووات ساعة / يوم). يُختار أقرب نطاق للعميل.</p>
                {groupsOf(RES).map((g, gi) => (
                  <Eq key={g} n={gi + 1} title={g}>
                    {RES.map((p, i) => p.group !== g ? null : <div key={i} className="space-y-1">{f.resRanges[i]!.map((v, j) => <Num key={j} label={p.title} value={v} onChange={(n) => setRange(i, j, n)} />)}{itemsOf(p)}</div>)}
                  </Eq>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] text-muted-foreground">نطاق كل منظومة = الاستهلاك اليومي الذي تغطيه (كيلووات ساعة / يوم). يُختار أصغر نظام نطاقه يغطي الاحتياج. القيمة الأولية = الألواح × قدرة اللوح × ساعات الإشعاع، ويمكنك تعديلها.</p>
                <Num label="ساعات الإشعاع (للنطاقات غير المعدّلة)" value={f.sun} onChange={(v) => up({ sun: v })} />
                <button onClick={() => up({ comRanges: {} })} className="w-full rounded-lg border border-border px-2 py-1.5 text-[11px]">إرجاع كل النطاقات التجارية للحساب التلقائي</button>
                {groupsOf(COM).map((g, gi) => (
                  <Eq key={g} n={gi + 1} title={g}>
                    {COM.filter((p) => p.group === g).map((p) => {
                      const k = comKeyOf(p), auto = Math.round(panelsOf(p) * (p.pw ?? 720) * f.sun / 10) / 100, edited = (f.comRanges[k] ?? 0) > 0;
                      return <div key={p.title} className="space-y-1"><Num label={p.title} hint={edited ? `معدّل — التلقائي ${auto}` : "تلقائي"} value={edited ? f.comRanges[k]! : auto} onChange={(n) => up({ comRanges: { ...f.comRanges, [k]: n } })} />{itemsOf(p)}</div>;
                    })}
                  </Eq>
                ))}
              </div>
            )
          ) : tab === "res" ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-1 text-[11px] font-semibold">
                <button onClick={() => setResSub("small")} className={`rounded-lg px-1 py-1.5 ${resSub === "small" ? "bg-ink text-ink-foreground" : "bg-muted"}`}>انفرتر 1.6 و 6.2</button>
                <button onClick={() => setResSub("big")} className={`rounded-lg px-1 py-1.5 ${resSub === "big" ? "bg-ink text-ink-foreground" : "bg-muted"}`}>انفرتر 8 و 12 Single Phase</button>
              </div>
              {resSub === "small" && (<>
                {need(f)}
                <Eq n={2} title="معادلة اختيار المنظومة (1.6 / 6.2)">
                  <p className="text-[11px] text-muted-foreground">تُقارن قيمة الاستهلاك اليومي بنطاق كل منظومة<br />يُختار أقرب نطاق<br />عند تساوي المسافة تُعرض المنظومتان<br />الألواح والإنفرتر حسب المنظومة المختارة (بدون خيارات أقل/أكثر)</p>
                  {small.map((i) => f.resRanges[i]!.map((v, j) => <Num key={i + "-" + j} label={RES[i]!.group + " · " + RES[i]!.title} value={v} onChange={(n) => setRange(i, j, n)} />))}
                </Eq>
                <Eq n={3} title="معادلة البطارية (1.6 / 6.2)">
                  <p className="text-[11px] text-muted-foreground">استهلاك الليل = الاستهلاك اليومي × نسبة الليل<br />السعة المتاحة = سعة بطارية المنظومة × معامل التفريغ<br />إذا كانت المتاحة + السماحية ≥ استهلاك الليل تبقى البطارية<br />غير ذلك تُرفع إلى البطارية الأكبر<br />السكني: خياران فقط 50/50 و 70% ليل</p>
                  <Num label="نسبة الليل عند اختيار 50/50" value={f.night[50]} onChange={(v) => up({ night: { ...f.night, 50: v } })} />
                  <Num label="نسبة الليل عند اختيار 70% ليل" value={f.night[70]} onChange={(v) => up({ night: { ...f.night, 70: v } })} />
                  <Num label="معامل تفريغ البطارية" value={f.dod} onChange={(v) => up({ dod: Math.min(v, 1) })} />
                  <Num label="سماحية نقص الليل (كيلووات ساعة)" value={f.batTol} onChange={(v) => up({ batTol: v })} />
                </Eq>
              </>)}
              {resSub === "big" && (<>
                {items(f, false, true)}
              </>)}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-1 text-[11px] font-semibold">
                <button onClick={() => setComSub("lv")} className={`rounded-lg px-1 py-1.5 ${comSub === "lv" ? "bg-ink text-ink-foreground" : "bg-muted"}`}>Low Voltage (8–20)</button>
                <button onClick={() => setComSub("hv")} className={`rounded-lg px-1 py-1.5 ${comSub === "hv" ? "bg-ink text-ink-foreground" : "bg-muted"}`}>High Voltage (30/50/80/125)</button>
              </div>
              {comSub === "lv" && items(f, false)}
              {comSub === "hv" && items(f, true)}
            </div>
          )}
        </div>
        </div>
        {msg && <p className={`text-xs ${msg.ok ? "text-primary" : "text-destructive"}`}>{msg.t}</p>}
        <div className="flex gap-2">
          <button disabled={busy || !f} onClick={doSave} className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">حفظ</button>
          <button disabled={busy} onClick={() => { setF(structuredClone(DEFAULT_FORMULAS)); setMsg({ ok: true, t: "تمت استعادة القيم الافتراضية — اضغط حفظ لاعتمادها" }); }} className="rounded-lg border border-border px-3 py-2 text-xs">الافتراضي</button>
        </div>
      </div>
    </div>
  );
}
