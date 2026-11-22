import { useMemo, useState, useRef, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Save, RotateCcw, ChevronDown, MessageSquareText, Check, MousePointerClick, Trash2 } from "lucide-react";
import { listBotTexts, saveBotText, saveBotButtonDelete } from "@/lib/crm.functions";
import { Home, Store, Factory, Zap, Hand, ShoppingCart, Sun, Network, ImageIcon } from "lucide-react";
import { HeaderImage } from "@/components/HeaderImage";
import { offlineQuery } from "@/lib/offline-cache";
import ALL from "@/lib/bot-texts.json";

type T = { k: string; m: string; t: string; s: string; o: string; b?: string; d?: string };
const TEXTS = ALL as T[];
// Sentinel stored as a button's value: the bot drops that button (n8n "ACTES المسار" layer).
const DEL = "__DEL__";

// Keep the original leading/trailing spaces and line breaks so the message layout stays intact.
const edges = (s: string) => { const m = s.match(/^(\s*)([\s\S]*?)(\s*)$/)!; return [m[1] ?? "", m[2] ?? "", m[3] ?? ""] as const; };

function Field({ row, saved, onSave, del }: { row: T; saved: { value: string | null; desc_value: string | null } | undefined; onSave: (v: string | null, d: string | null) => Promise<void>; del?: { deleted: boolean; set: (on: boolean) => Promise<void> } }) {
  const [lead, core, trail] = edges(row.o);
  const cur = saved?.value != null && saved.value !== DEL ? edges(saved.value)[1] : core;
  const [v, setV] = useState(cur);
  const [d, setD] = useState(saved?.desc_value ?? row.d ?? "");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const isBtn = row.t === "b";
  const [menu, setMenu] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const changed = v !== cur || (isBtn && row.d != null && d !== (saved?.desc_value ?? row.d));
  const edited = saved != null && saved.value !== DEL;
  const save = async (val: string | null, desc: string | null) => {
    setBusy(true);
    try { await onSave(val, desc); setOk(true); setTimeout(() => setOk(false), 1500); } catch (e) { alert((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className={`flex items-start gap-1.5 ${isBtn ? "" : "w-full"}`}>
      {isBtn && del?.deleted ? (
        <div className="flex flex-1 items-center gap-1 rounded-full border border-dashed px-3 py-1 text-sm text-muted-foreground">
          <span className="flex-1 text-center line-through opacity-60">{core}</span>
          <button disabled={busy} onClick={async () => { setBusy(true); try { await del!.set(false); } catch (e) { alert((e as Error).message); } finally { setBusy(false); } }} className="flex items-center gap-1 text-xs font-semibold text-primary"><RotateCcw className="h-3.5 w-3.5" />استرجاع</button>
        </div>
      ) : isBtn ? (
        <div className="relative flex-1 space-y-1" onPointerDown={() => { timer.current = setTimeout(() => setMenu(true), 700); }} onPointerUp={() => clearTimeout(timer.current)} onPointerLeave={() => clearTimeout(timer.current)} onContextMenu={(e) => e.preventDefault()}>
          {menu && <div className="absolute -top-10 left-1/2 z-10 flex -translate-x-1/2 gap-1 rounded-lg border bg-popover p-1 shadow-lg">
            <button onClick={async () => { setMenu(false); setBusy(true); try { await del?.set(true); } catch (e) { alert((e as Error).message); } finally { setBusy(false); } }} className="flex items-center gap-1 rounded-md bg-destructive px-3 py-1 text-xs font-bold text-destructive-foreground"><Trash2 className="h-3.5 w-3.5" />حذف</button>
            <button onClick={() => setMenu(false)} className="rounded-md px-2 py-1 text-xs text-muted-foreground">إلغاء</button>
          </div>}
          <input value={v} maxLength={20} onChange={(e) => setV(e.target.value)} aria-label="اسم الزر"
            className={`w-full rounded-full border px-3 py-1 text-center text-sm font-semibold text-primary outline-none focus:ring-2 focus:ring-ring ${edited ? "border-primary bg-primary/5" : "border-input bg-background"}`} />
          {row.d != null && <input value={d} maxLength={72} onChange={(e) => setD(e.target.value)} aria-label="وصف الخيار" className="w-full rounded border border-input bg-background px-2 py-0.5 text-xs text-muted-foreground" />}
        </div>
      ) : (
        <textarea value={v} onChange={(e) => setV(e.target.value)} rows={Math.min(8, Math.max(1, v.split("\n").length))} dir="rtl"
          className={`flex-1 resize-y rounded-lg border px-2 py-1.5 text-sm leading-6 outline-none focus:ring-2 focus:ring-ring ${edited ? "border-primary bg-primary/5" : "border-input bg-background"}`} />
      )}
      <div className="flex flex-col gap-1">
        {changed && <button disabled={busy || !v.trim()} onClick={() => save(lead + v + trail, isBtn && row.d != null ? d : null)} aria-label="حفظ" className="rounded-md bg-primary p-1.5 text-primary-foreground disabled:opacity-50"><Save className="h-4 w-4" /></button>}
        {ok && <span className="p-1.5 text-primary"><Check className="h-4 w-4" /></span>}
        {edited && !changed && <button disabled={busy} onClick={async () => { await save(null, null); setV(core); setD(row.d ?? ""); }} aria-label="إرجاع النص الأصلي" title="إرجاع النص الأصلي" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"><RotateCcw className="h-4 w-4" /></button>}
      </div>
    </div>
  );
}

// Residential quote path as the customer sees it: 7 stations, each with its message parts and buttons.
const WELCOME = { title: "الترحيب والقائمة الرئيسية", msg: ["31ba78db5027da72", "08d5f3105337be53", "wel0services0ask"], btns: ["17a354adfca34ed9", "9256f0715d87b034"] };
const RES_TREE: { title: string; msg: string[]; btns: string[]; fixed?: string[]; note?: string }[] = [
  { title: "طلب قيمة الفاتورة الشهرية", msg: ["25241f77f16c8dc4"], btns: ["b475509fe976959b", "49e61614093c2a7f"] },
  { title: "نمط الاستخدام (نهار / ليل)", msg: ["14396d9b58cf5304", "0ded4780a60eaa29"], btns: ["2b18ee871f40b0fd", "ac0b2da7a98be976", "49e61614093c2a7f"] },
  { title: "اختيار نوع البطارية", msg: [], fixed: ["UF5000 5.12kWh", "Fidus Pro 5.12kWh"], btns: ["49e61614093c2a7f"], note: "اسما البطاريتين يأتيان من شاشة الأصناف." },
  { title: "ملخص المنظومة المقترحة", msg: ["c70260d1503cbd9e", "2eaea7b9b7d0c673"], btns: ["9d7fbbbf88df922f", "49e61614093c2a7f"] },
  { title: "خيارات ما بعد عرض السعر", msg: [], btns: ["5132978e125efc09", "60a7550dc681a290", "583ffcb4aa5eb831"] },
];
// Commercial quote path (approved plan): stations with their harvested message parts and buttons.
const COM_TREE: typeof RES_TREE = [
  { title: "طريقة إدخال الاستهلاك", msg: ["f59fc2fbde4d4139"], btns: ["bc6b06e11dd584c3", "da5bde195f4ac7d9", "87da7c0b23278abf", "49e61614093c2a7f"] },
  { title: "إدخال قيمة الاستهلاك", msg: ["2e0057c20a9e6656", "75e9f26980fc0454", "769ebb2a960c6fd9"], btns: ["49e61614093c2a7f"], note: "بعدها يتفرع المسار حسب الاستهلاك: جهد منخفض أو جهد عالي." },
];
const comBranch = (lv: boolean): typeof RES_TREE => [
  { title: "طريقة تحديد الإنفرتر", msg: [], fixed: ["الحمل في الساعة", "اختيار الإنفرتر"], btns: ["49e61614093c2a7f"] },
  { title: lv ? "اختيار قدرة الإنفرتر (6–20 kW)" : "اختيار قدرة الإنفرتر (30–125 kW)", msg: ["0069cb23b5a0ae8a", "a2cf5ae56ed8224f"], btns: ["49e61614093c2a7f"], note: "قائمة القدرات تُبنى تلقائياً من الأصناف." },
  { title: "نمط الاستخدام", msg: ["14396d9b58cf5304", "0ded4780a60eaa29"], btns: ["77d0b52a0182f3a2", "2b18ee871f40b0fd", "ac0b2da7a98be976", "49e61614093c2a7f"] },
  lv
    ? { title: "اختيار نوع البطارية", msg: [], fixed: ["Hithium 16kWh", "Fidus 16kWh"], btns: ["49e61614093c2a7f"], note: "اسما البطاريتين يأتيان من شاشة الأصناف." }
    : { title: "اختيار نظام التخزين والكبائن", msg: ["9928124bfe3ee13a", "5a3974a67b110d70"], btns: ["c857a17672471822", "94c25b4ffc18917d", "d964833169c7a44d", "c9ca38df68ce18bb", "49e61614093c2a7f"], note: "أنواع الكبائن تأتي من شاشة الأصناف." },
  { title: "ملخص المنظومة المقترحة", msg: ["e5e513b9703cd7a9"], btns: ["cca78d5e7f57d233", "2dd4e1a26d82b5c8", "49e61614093c2a7f"] },
  { title: "خيارات ما بعد عرض السعر", msg: [], btns: ["5132978e125efc09", "60a7550dc681a290", "583ffcb4aa5eb831"] },
];
const COM_LV = comBranch(true);
const COM_HV = comBranch(false);
// Industrial quote path (approved plan): 14 stations.
const IND_TREE: typeof RES_TREE = [
  { title: "اسم المشروع أو المصنع", msg: ["04213971b6cd422a", "fe05d8c84f2b5a7a", "08cebc7cf6b7a18c"], btns: ["49e61614093c2a7f"] },
  { title: "موقع المشروع", msg: [], btns: ["49e61614093c2a7f"], note: "قائمة المحافظات ثابتة داخل البوت." },
  { title: "نوع النشاط الصناعي", msg: ["db015be4d9a89414", "90a0001df342e6f5", "a442fa39b3a2da6d"], btns: ["3e809abae64270ea", "be3a2d01c8055d81", "74a57aa64db81928", "855e5bd69a46e5e3", "13d94cd6486d3049", "49b560f99302689e", "66514b1009d0fbb3"] },
  { title: "ساعات التشغيل (الورديات)", msg: ["cc615c5901bac3b8", "7b181c7bce18336d"], btns: ["0ff8032cf0bf1d35", "6588bc30ca4a0e3a", "ff7761b4d35dd1a6"] },
  { title: "أوقات الورديات", msg: ["c83700c0108a6988", "d01165ceebe82f3d", "328fec9ecce17e78", "aa7b0bafe44f7543", "740ae4bb945f99e8", "3ef0cbf115786d58"], btns: ["49e61614093c2a7f"] },
  { title: "طريقة إدخال الأحمال", msg: ["44dd7937961ba528", "abbeddc26bca8293", "5a341aec6063b8ac"], btns: ["e7084929a050ac9e", "9de647e82cdf300e", "c49e601e874712b2", "1067986d27697ced"] },
  { title: "إجمالي الحمل التشغيلي", msg: ["3a29c5b7d97ea4c1"], btns: ["49e61614093c2a7f"] },
  { title: "أكبر ماكينة منفردة", msg: ["6bfc398324c81bfc"], btns: ["49e61614093c2a7f"] },
  { title: "محركات تيار الإقلاع العالي", msg: ["32210fb09bfcf81d", "6e3b5fba89476633"], btns: ["2e25a5a3f3602484", "ee63d54e81144d9a"] },
  { title: "مصدر الكهرباء الحالي", msg: ["829b2889e3217ad7", "33ba1f6b42122436", "031fda8fed57607d", "c7c5f6e0aaba29e6", "e77df798e5671923", "4e7192be8fbf45aa", "eb36483bb29d8d54"], btns: ["3f1175301cc0c4a2", "5ed1ccf3315263c0", "d436992eebb929cc", "cd4dc6272a5153d4", "b622987744f8e476"] },
  { title: "الهدف من المنظومة", msg: ["b23245bfa39d669a", "8a12db610f2dc494"], btns: ["3b8c25a45ea558d4", "c37b24d3a5235f92", "06dc98684a4f0026"] },
  { title: "ملخص المنظومة واختيار الخطوة التالية", msg: ["f2b8e3219c9529c1"], btns: ["8a517ef606b599bf"], note: "أرقام الملخص تُحسب تلقائياً." },
  { title: "خيارات ما بعد عرض السعر", msg: [], btns: ["484bf23e3dd44054", "8a500db8ddc7b809", "8bb17c0836d361db", "49e61614093c2a7f"] },
];
const BY_KEY = new Map(TEXTS.map((r) => [r.k, r]));
// Non-quote tabs: only the steps a customer really goes through (verified by replaying the live State Machine).
const WEL_TREE: typeof RES_TREE = [WELCOME,
  { title: "اختيار نوع المنظومة", msg: ["5f3a5397b45b53d7", "43496107d13ca096"], btns: ["3e8021ccc9fdb708", "be0ff08827145be4", "dff2de3b794789b3"] },
];
const BUY_TREE: typeof RES_TREE = [
  { title: "اسم العميل للفاتورة", msg: ["20ce95407d5f0f88", "765f164192b1dba9"], btns: ["49e61614093c2a7f"] },
  { title: "اختيار طريقة الدفع", msg: ["0fadd3651818e5c7", "cc70f278995c9715"], btns: ["6c50ec49c447b00e", "d196ecc6637e223b", "2a6a4589be9b2412"] },
  { title: "اسم الشبكة (حوالة شبكة محلية)", msg: ["3e52d7d784977df9", "61bac8ac968c9e01"], btns: ["49e61614093c2a7f"] },
  { title: "اسم المحفظة (محفظة إلكترونية)", msg: ["09cc0371bc10c04e", "17e69b8aa842699b"], btns: ["49e61614093c2a7f"] },
  { title: "تأكيد الطلب", msg: ["df3eaab6c2945b0c", "bb0af5d58b9f4613", "25d8390d20990688", "7a2eb355fe92fd9f"], btns: [] },
];
const PVS_TREE: typeof RES_TREE = [
  { title: "مدينة التركيب", msg: ["d06d84f786e5b16a", "e2b88750834d68fa"], btns: ["45a83cc2363c1167", "4e7168f715a2747f", "bb97837975a03ab8"] },
  { title: "موقع التركيب (عند اختيار أخرى)", msg: ["ac1cd8f249a2b960", "d82a9d5bd7b615dc"], btns: [] },
  { title: "اتجاه الألواح", msg: ["1be3275026e48354", "63ffe9a593945ec5"], btns: ["bc642c15a8d5de9b", "864c027b5c0d1b9d", "3241e1afbd5a6069", "b16d315fcb9b35b1", "3bd8ee9a97ed9678", "a49eec3ef6c0a06e"] },
  { title: "زاوية ميلان الألواح", msg: ["fc62f1048a758ce8", "bc125fd631f0756d"], btns: ["44d451122b84fb9d"] },
  { title: "تأكيد تسجيل طلب الدراسة", msg: ["d3cf21167c829da2", "a622b2cdbff19bd3"], btns: ["484bf23e3dd44054", "8bb17c0836d361db"] },
];
const SLD_TREE: typeof RES_TREE = [
  { title: "تأكيد تسجيل طلب المخطط", msg: ["2a95feaa8350bcf4", "bec04ae6b25e4bf5"], btns: ["484bf23e3dd44054", "8a500db8ddc7b809"] },
];

type Saved = Map<string, { value: string | null; desc_value: string | null; updated_at?: string }>;
type SaveFn = (k: string) => (v: string | null, d: string | null) => Promise<void>;
type DelFn = (k: string, st: (typeof RES_TREE)[number], on: boolean) => Promise<void>;
// A button deleted in one step is stored under "<button key>@<step id>", so it disappears only from that step.
const stepId = (st: { msg: string[]; btns: string[]; fixed?: string[]; title: string }) => {
  const src = [st.title, ...st.msg, ...st.btns, ...(st.fixed ?? [])].join("|");
  let h = 5381; for (let i = 0; i < src.length; i++) h = ((h * 33) ^ src.charCodeAt(i)) >>> 0;
  return h.toString(36);
};
export const scopedKey = (k: string, st: Parameters<typeof stepId>[0]) => `${k}@${stepId(st)}`;

function Node({ st, n, saved, onSave, onDel, last }: { st: (typeof RES_TREE)[number]; n: string; saved: Saved; onSave: SaveFn; onDel: DelFn; last: boolean }) {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const keys = [...st.msg, ...st.btns];
  const isDel = (k: string) => st.btns.includes(k) ? saved.has(scopedKey(k, st)) || saved.get(k)?.value === DEL : saved.get(k)?.value === DEL;
  const deleted = keys.length > 0 && keys.every(isDel);
  const setAll = async (v: string | null) => {
    setBusy(true); setMenu(false);
    try { for (const k of st.msg) await onSave(k)(v, null); for (const k of st.btns) await onDel(k, st, v === DEL); } catch (e) { alert((e as Error).message); } finally { setBusy(false); }
  };
  const txt = (k: string) => { const v = saved.get(k)?.value; return (v != null && v !== DEL ? v : BY_KEY.get(k)?.o ?? "").trim(); };
  if (deleted) return (
    <li className="relative pr-10">
      <span className="absolute right-0 top-1 flex h-7 min-w-7 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground bg-card px-1 text-xs font-bold text-muted-foreground">{n}</span>
      <div className="flex items-center gap-2 rounded-lg border border-dashed bg-muted/40 p-3">
        <span className="flex-1 text-sm text-muted-foreground line-through">{st.title}</span>
        <span className="text-[11px] text-muted-foreground">خطوة محذوفة</span>
        <button disabled={busy} onClick={() => setAll(null)} className="flex items-center gap-1 text-xs font-semibold text-primary"><RotateCcw className="h-3.5 w-3.5" />استرجاع</button>
      </div>
    </li>
  );
  const edited = [...st.msg, ...st.btns].filter((k) => saved.has(k)).length;
  const preview = st.msg.map(txt).filter(Boolean).join(" … ");
  return (
    <li className="relative pr-10">
      {!last && <span className="absolute right-[0.9rem] top-8 bottom-[-0.75rem] w-px bg-border" aria-hidden />}
      <span className="absolute right-0 top-1 flex h-7 min-w-7 items-center justify-center rounded-full border-2 border-primary bg-card px-1 text-xs font-bold text-primary">{n}</span>
      <div className={`rounded-lg border bg-card shadow-sm transition ${open ? "border-primary/40" : ""}`}>
        {menu && <div className="flex items-center justify-center gap-2 border-b bg-popover p-2">
          <button disabled={busy} onClick={() => setAll(DEL)} className="flex items-center gap-1 rounded-md bg-destructive px-3 py-1 text-xs font-bold text-destructive-foreground"><Trash2 className="h-3.5 w-3.5" />حذف الخطوة</button>
          <button onClick={() => setMenu(false)} className="rounded-md px-2 py-1 text-xs text-muted-foreground">إلغاء</button>
        </div>}
        <button onClick={() => { if (!menu) setOpen(!open); }} onPointerDown={() => { if (keys.length) timer.current = setTimeout(() => setMenu(true), 700); }} onPointerUp={() => clearTimeout(timer.current)} onPointerLeave={() => clearTimeout(timer.current)} onContextMenu={(e) => e.preventDefault()} className="flex w-full select-none items-start gap-2 p-3 text-right">
          <div className="flex-1 space-y-1">
            <div className="text-sm font-bold text-foreground">{st.title}</div>
            {preview && <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">{preview}</p>}
          </div>
          {edited > 0 && <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-secondary-foreground">{edited} معدّل</span>}
          <ChevronDown className={`mt-0.5 h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <div className="space-y-3 border-t bg-muted/30 p-3">
            {st.msg.length > 0 && <div className="space-y-2">
              <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground"><MessageSquareText className="h-3.5 w-3.5" />الرسالة</div>
              {st.msg.map((k) => { const r = BY_KEY.get(k); return r ? <Field key={k + (saved.get(k)?.updated_at ?? "")} row={r} saved={saved.get(k)} onSave={onSave(k)} /> : null; })}
            </div>}
            {(st.btns.length > 0 || st.fixed) && <div className="space-y-2">
              <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground"><MousePointerClick className="h-3.5 w-3.5" />الأزرار</div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {st.btns.map((k) => { const r = BY_KEY.get(k); return r ? <Field key={k + (saved.get(k)?.updated_at ?? "")} row={r} saved={saved.get(k)} onSave={onSave(k)} del={{ deleted: isDel(k), set: (on) => onDel(k, st, on) }} /> : null; })}
              </div>
              {st.fixed && <div className="flex flex-wrap gap-2">{st.fixed.map((f) => <span key={f} className="rounded-full border bg-background px-3 py-1 text-xs text-foreground">{f}</span>)}</div>}
            </div>}
            {st.note && <p className="rounded-md bg-background px-2 py-1.5 text-xs text-muted-foreground">{st.note}</p>}
          </div>
        )}
      </div>
    </li>
  );
}

function Tree({ tree, start = 0, mark = "", saved, onSave, onDel }: { tree: typeof RES_TREE; start?: number; mark?: string; saved: Saved; onSave: SaveFn; onDel: DelFn }) {
  return (
    <ol className="space-y-3">
      {tree.map((st, i) => <Node key={i} st={st} n={`${i + 1 + start}${mark}`} last={i === tree.length - 1} saved={saved} onSave={onSave} onDel={onDel} />)}
    </ol>
  );
}

export function BotFlow({ pw }: { pw: string }) {
  const list = useServerFn(listBotTexts);
  const saveFn = useServerFn(saveBotText);
  const { data: rows = [], refetch } = useQuery(offlineQuery({ queryKey: ["bot-texts"], queryFn: () => list({ data: { pw } }) }));
  const [sys, setSys] = useState<"wel" | "res" | "com" | "ind" | "buy" | "pvs" | "sld" | "img">("wel");
  const saved = useMemo(() => new Map(rows.map((r) => [r.key, r])), [rows]);
  const onSave: SaveFn = (k) => async (value, desc_value) => {
    await saveFn({ data: { pw, key: k, value, desc_value } });
    await refetch();
  };
  const delFn = useServerFn(saveBotButtonDelete);
  const onDel: DelFn = async (k, st, on) => {
    await delFn({ data: { pw, key: k, scoped: scopedKey(k, st), on, msg: st.msg, sibs: st.btns.filter((b) => b !== k), fixed: st.fixed ?? [] } });
    // Old-style delete (from every step) is cleared when the button is restored.
    if (!on && saved.get(k)?.value === DEL) await saveFn({ data: { pw, key: k, value: null, desc_value: null } });
    await refetch();
  };
  const TABS = [["wel", "الترحيبية", Hand], ["res", "السكني", Home], ["com", "التجاري", Store], ["ind", "الصناعي", Factory], ["buy", "متابعة الشراء", ShoppingCart], ["pvs", "PVsyst", Sun], ["sld", "SLD", Network], ["img", "صورة الترويسة", ImageIcon]] as const;

  return (
    <div dir="rtl" className="mx-auto max-w-4xl space-y-4 p-3">
      <div className="space-y-1">
        <h2 className="text-lg font-bold text-foreground">مسار البوت</h2>
        <p className="text-sm text-muted-foreground">اضغط على أي خطوة لتعديل رسالتها وأسماء أزرارها، ثم اضغط حفظ. اضغط مطولاً على أي زر أو عنوان خطوة لحذفه — يصل التعديل للبوت من الرسالة التالية.</p>
      </div>
      <div className="grid grid-cols-4 gap-1 rounded-xl sm:grid-cols-8 border bg-muted p-1">
        {TABS.map(([id, t, I]) => (
          <button key={id} onClick={() => setSys(id)} className={`flex items-center justify-center gap-1.5 rounded-lg px-1 py-2 text-xs font-bold transition ${sys === id ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}><I className="h-4 w-4" />{t}</button>
        ))}
      </div>
      <div className="rounded-xl border bg-background p-3">
                {sys === "res" && <Tree tree={RES_TREE} saved={saved} onSave={onSave} onDel={onDel} />}
        {sys === "wel" && <Tree tree={WEL_TREE} saved={saved} onSave={onSave} onDel={onDel} />}
        {sys === "buy" && <Tree tree={BUY_TREE} saved={saved} onSave={onSave} onDel={onDel} />}
        {sys === "pvs" && <Tree tree={PVS_TREE} saved={saved} onSave={onSave} onDel={onDel} />}
        {sys === "sld" && <Tree tree={SLD_TREE} saved={saved} onSave={onSave} onDel={onDel} />}
        {sys === "img" && <HeaderImage pw={pw} />}
        {sys === "ind" && <Tree tree={IND_TREE} saved={saved} onSave={onSave} onDel={onDel} />}
        {sys === "com" && <Fragment>
          <Tree tree={COM_TREE} saved={saved} onSave={onSave} onDel={onDel} />
          <div className="my-4 flex items-center gap-2 text-xs font-semibold text-muted-foreground"><span className="h-px flex-1 bg-border" />يتفرع حسب الاستهلاك<span className="h-px flex-1 bg-border" /></div>
          <div className="grid gap-4 md:grid-cols-2">
            {([[COM_LV, "أ", "الجهد المنخفض (LV)", "حتى 20kW"], [COM_HV, "ب", "الجهد العالي (HV)", "أكبر من 20kW"]] as const).map(([tr, m, t, sub]) => (
              <div key={m} className="space-y-3 rounded-lg border bg-muted/20 p-2">
                <div className="flex items-center gap-2 rounded-md bg-secondary px-3 py-2 text-secondary-foreground"><Zap className="h-4 w-4" /><b className="flex-1 text-sm">{t}</b><span className="text-xs text-muted-foreground">{sub}</span></div>
                <Tree tree={tr} start={2} mark={m} saved={saved} onSave={onSave} onDel={onDel} />
              </div>
            ))}
          </div>
        </Fragment>}
      </div>
    </div>
  );
}
