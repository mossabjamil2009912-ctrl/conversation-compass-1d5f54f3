import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sun, Users, GraduationCap, Star, MapPin, X, Check, Upload, Search, Briefcase, ChevronLeft } from "lucide-react";
import logoWhite from "@/assets/actes-logo-white.png";
import { tieredOptions, tiersDayNight, dailyNeed, dailyProduction, type DayNight, type ComMethod } from "@/components/QuoteBuilder";
import { actsKwhPrice, actsQuoteRequest, actsListEngineers, actsGetEngineer, actsServiceRequest, actsRegister, actsUpload, actsReportReview } from "@/lib/acts.functions";
import { offlineQuery } from "@/lib/offline-cache";
import { SPECIALTIES, SERVICES, REG_SERVICES, GOVERNORATES, fileToB64 } from "@/lib/acts-data";

export const Route = createFileRoute("/acts")({
  head: () => ({
    meta: [
      { title: "ACTES — منصة أكتس لأنظمة الطاقة وحلولها" },
      { name: "description", content: "اطلب عرض سعر لمنظومة طاقة، اختر مهندساً معتمداً، أو سجّل ككفاءة هندسية مع أكتس." },
      { property: "og:title", content: "ACTES — منصة أكتس لأنظمة الطاقة وحلولها" },
      { property: "og:description", content: "عروض أسعار منظومات الطاقة، دليل المهندسين المعتمدين، واستقطاب الكفاءات الهندسية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Acts,
});

type Tab = "quote" | "engineers" | "join";
const inp = "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary";
const btn = "rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50";
const chip = (on: boolean) => `rounded-full border px-3 py-1.5 text-xs font-semibold ${on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`;
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "حدث خطأ");

function Field({ l, children }: { l: string; children: ReactNode }) {
  return <label className="block space-y-1"><span className="text-xs font-semibold text-muted-foreground">{l}</span>{children}</label>;
}
function Stars({ v, onChange, size = 4 }: { v: number; onChange?: (n: number) => void; size?: number }) {
  return <span className="inline-flex gap-0.5" dir="ltr">{[1, 2, 3, 4, 5].map((i) => (
    <button key={i} type="button" disabled={!onChange} onClick={() => onChange?.(i)} aria-label={`${i} نجوم`}>
      <Star className={`h-${size} w-${size} ${i <= Math.round(v) ? "fill-primary text-primary" : "text-muted-foreground/40"}`} />
    </button>))}</span>;
}
function Done({ t, onBack }: { t: string; onBack: () => void }) {
  return <div className="space-y-4 rounded-2xl border border-border bg-card p-6 text-center">
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="h-7 w-7" /></div>
    <p className="font-bold">{t}</p><button className={btn} onClick={onBack}>رجوع</button></div>;
}

function Acts() {
  const [tab, setTab] = useState<Tab>("quote");
  const tabs: { k: Tab; l: string; i: typeof Sun }[] = [
    { k: "quote", l: "عرض سعر", i: Sun }, { k: "engineers", l: "المهندسون", i: Users }, { k: "join", l: "انضم إلينا", i: GraduationCap },
  ];
  return (
    <div dir="rtl" className="min-h-screen bg-background pb-24 text-foreground">
      <header className="relative overflow-hidden bg-ink px-4 pb-6 pt-5 text-ink-foreground">
        <div className="pointer-events-none absolute -top-10 left-[30%] h-48 w-1.5 rotate-[35deg] bg-primary" />
        <div className="relative mx-auto max-w-3xl">
          <img src={logoWhite} alt="ACTES لأنظمة الطاقة وحلولها" className="h-12 w-auto" />
          <p className="mt-3 text-lg font-bold">منصة أكتس لأنظمة الطاقة وحلولها</p>
          <p className="text-xs opacity-70">Energy Systems & Solutions</p>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-5">
        {tab === "quote" ? <QuoteFlow /> : tab === "engineers" ? <Engineers /> : <Join />}
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-ink text-ink-foreground">
        <div className="mx-auto grid max-w-3xl grid-cols-3">
          {tabs.map((t) => <button key={t.k} onClick={() => setTab(t.k)} className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold ${tab === t.k ? "text-primary" : "opacity-80"}`}>
            <t.i className="h-5 w-5" />{t.l}</button>)}
        </div>
      </nav>
    </div>
  );
}

// ---------- 1. Quote: same steps as the bot (type → amount → day/night → system → contact) ----------
function QuoteFlow() {
  const getPrice = useServerFn(actsKwhPrice);
  const submit = useServerFn(actsQuoteRequest);
  const { data: pr } = useQuery(offlineQuery({ queryKey: ["acts-kwh"], queryFn: () => getPrice() }));
  const price = pr?.kwh_price ?? 290;
  const [step, setStep] = useState(0);
  const [path, setPath] = useState<"res" | "com">("res");
  const [method, setMethod] = useState<ComMethod>("bill");
  const [amount, setAmount] = useState("");
  const [night, setNight] = useState<DayNight>(50);
  const [pick, setPick] = useState("");
  const [reports, setReports] = useState<("pvsyst" | "sld")[]>([]);
  const [c, setC] = useState({ name: "", phone: "", city: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const v = Number(amount);
  const tiers = useMemo(() => (v > 0 ? tiersDayNight(tieredOptions(path, path === "res" ? "bill" : method, v, price), night, dailyNeed(path, path === "res" ? "bill" : method, v, price)) : null), [path, method, v, price, night]);
  const opts = tiers ? ([["أقل", tiers.low], ["الموصى بها", tiers.rec], ["أكبر", tiers.high]] as const).filter((x) => x[1]) : [];
  const unit = path === "res" || method === "bill" ? "ريال يمني شهرياً" : method === "kwh" ? "كيلو وات شهرياً" : "لتر ديزل شهرياً";
  const reset = () => { setStep(0); setAmount(""); setPick(""); setReports([]); setNight(50); };

  if (step === 5) return <Done t="تم استلام طلب عرض السعر، سيتواصل معك فريق أكتس عبر واتساب قريباً." onBack={reset} />;
  return (
    <div className="space-y-4">
      <div className="flex gap-1">{[0, 1, 2, 3, 4].map((i) => <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`} />)}</div>
      <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
        {step === 0 && <>
          <h2 className="font-bold">نوع المنظومة</h2>
          <div className="grid grid-cols-2 gap-2">
            {([["res", "🏠 سكني"], ["com", "🏢 تجاري / زراعي"]] as const).map(([k, l]) => <button key={k} onClick={() => { setPath(k); setStep(1); }} className={`rounded-xl border p-4 text-sm font-bold ${path === k ? "border-primary" : "border-border"}`}>{l}</button>)}
          </div>
        </>}
        {step === 1 && <>
          <h2 className="font-bold">{path === "res" ? "كم تدفع فاتورة الكهرباء شهرياً؟" : "طريقة حساب الاستهلاك"}</h2>
          {path === "com" && <div className="flex flex-wrap gap-2">{([["bill", "قيمة الفاتورة"], ["kwh", "كيلو وات شهرياً"], ["diesel", "لترات الديزل"]] as const).map(([k, l]) => <button key={k} className={chip(method === k)} onClick={() => setMethod(k)}>{l}</button>)}</div>}
          <Field l={unit}><input className={inp} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} /></Field>
          <div className="flex justify-between"><button className="text-sm" onClick={() => setStep(0)}>رجوع</button><button className={btn} disabled={!(v > 0)} onClick={() => setStep(2)}>التالي</button></div>
        </>}
        {step === 2 && <>
          <h2 className="font-bold">كيف تتوزع ساعات استخدامك للكهرباء؟</h2>
          <div className="grid gap-2">{([[50, "50% نهار / 50% ليل"], [30, "70% نهار / 30% ليل"], [70, "30% نهار / 70% ليل"]] as const).filter(([k]) => !(path === "res" && k === 30)).map(([k, l]) => <button key={k} onClick={() => { setNight(k); setStep(3); }} className={`rounded-xl border p-3 text-sm font-semibold ${night === k ? "border-primary" : "border-border"}`}>{l}</button>)}</div>
          <button className="text-sm" onClick={() => setStep(1)}>رجوع</button>
        </>}
        {step === 3 && <>
          <h2 className="font-bold">المنظومات المناسبة لك</h2>
          {!opts.length && <p className="text-sm text-muted-foreground">لم نجد منظومة مناسبة لهذا الرقم، تحقق من المبلغ.</p>}
          <div className="grid gap-2">{opts.map(([l, p]) => <button key={p!.title} onClick={() => setPick(p!.title)} className={`rounded-xl border p-3 text-right ${pick === p!.title ? "border-primary bg-primary/5" : "border-border"}`}>
            <span className="text-[11px] font-bold text-primary">{l}</span>
            <p className="text-sm font-bold">{p!.title}</p>
            <p className="text-xs text-muted-foreground">{p!.group} · إنتاج يومي تقريبي {dailyProduction(p!).toFixed(1)} كيلو وات</p>
          </button>)}</div>
          <div className="space-y-2"><p className="text-xs font-semibold text-muted-foreground">أطلب أيضاً (اختياري)</p>
            <div className="flex gap-2">{([["pvsyst", "تقرير PVsyst"], ["sld", "مخطط SLD"]] as const).map(([k, l]) => <button key={k} className={chip(reports.includes(k))} onClick={() => setReports((r) => r.includes(k) ? r.filter((x) => x !== k) : [...r, k])}>{l}</button>)}</div></div>
          <div className="flex justify-between"><button className="text-sm" onClick={() => setStep(2)}>رجوع</button><button className={btn} disabled={!pick} onClick={() => setStep(4)}>التالي</button></div>
        </>}
        {step === 4 && <>
          <h2 className="font-bold">بيانات التواصل</h2>
          <Field l="الاسم"><input className={inp} value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} /></Field>
          <Field l="رقم الواتساب *"><input className={inp} dir="ltr" inputMode="tel" value={c.phone} onChange={(e) => setC({ ...c, phone: e.target.value })} placeholder="967..." /></Field>
          <Field l="المدينة"><input className={inp} value={c.city} onChange={(e) => setC({ ...c, city: e.target.value })} /></Field>
          {err && <p className="text-sm text-destructive">{err}</p>}
          <div className="flex justify-between"><button className="text-sm" onClick={() => setStep(3)}>رجوع</button>
            <button className={btn} disabled={busy || c.phone.replace(/\D/g, "").length < 6} onClick={async () => {
              setBusy(true); setErr("");
              try { await submit({ data: { ...c, path, method: path === "res" ? "bill" : method, amount: v, night, system: pick, reports } }); setStep(5); } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
            }}>{busy ? "جارٍ الإرسال..." : "إرسال الطلب"}</button></div>
        </>}
      </div>
    </div>
  );
}

// ---------- 2. Engineers directory ----------
type Eng = Awaited<ReturnType<typeof actsListEngineers>>[number];
function Engineers() {
  const list = useServerFn(actsListEngineers);
  const { data = [], isLoading } = useQuery(offlineQuery({ queryKey: ["acts-engineers"], queryFn: () => list() }));
  const [q, setQ] = useState(""); const [sp, setSp] = useState(""); const [gov, setGov] = useState(""); const [svc, setSvc] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [reqFor, setReqFor] = useState<Eng | null | undefined>(undefined);
  const shown = data.filter((e) => (!sp || e.specialty === sp) && (!gov || e.governorate === gov) && (!svc || e.services.includes(svc)) && (!q || `${e.name} ${e.skills.join(" ")} ${e.city ?? ""}`.includes(q)))
    .sort((a, b) => b.avg - a.avg);
  if (reqFor !== undefined) return <ServiceRequest eng={reqFor} onClose={() => setReqFor(undefined)} />;
  return (
    <div className="space-y-3">
      <div className="relative"><Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" /><input className={`${inp} pr-9`} placeholder="ابحث باسم أو مهارة" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="grid grid-cols-3 gap-2">
        <select className={inp} value={sp} onChange={(e) => setSp(e.target.value)}><option value="">كل التخصصات</option>{SPECIALTIES.map((x) => <option key={x}>{x}</option>)}</select>
        <select className={inp} value={gov} onChange={(e) => setGov(e.target.value)}><option value="">كل المحافظات</option>{GOVERNORATES.map((x) => <option key={x}>{x}</option>)}</select>
        <select className={inp} value={svc} onChange={(e) => setSvc(e.target.value)}><option value="">كل الخدمات</option>{REG_SERVICES.map((x) => <option key={x}>{x}</option>)}</select>
      </div>
      <button className="w-full rounded-xl border border-dashed border-primary p-3 text-sm font-bold text-primary" onClick={() => setReqFor(null)}>اطلب خدمة هندسية ودع الإدارة تختار المهندس</button>
      {isLoading && <p className="text-center text-sm text-muted-foreground">جارٍ التحميل...</p>}
      {!isLoading && !shown.length && <p className="rounded-xl bg-card p-6 text-center text-sm text-muted-foreground">لا يوجد مهندسون معتمدون مطابقون بعد.</p>}
      {shown.map((e) => <button key={e.id} onClick={() => setOpen(e.id)} className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-right">
        <Avatar url={e.photo_url} name={e.name} />
        <div className="min-w-0 flex-1"><p className="truncate font-bold">{e.name}</p><p className="text-xs text-muted-foreground">{e.specialty} · {e.years_exp} سنوات خبرة</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{[e.governorate, e.city].filter(Boolean).join(" - ")}</p>
          <p className="flex items-center gap-1 text-xs"><Stars v={e.avg} size={3} /> <span className="text-muted-foreground">({e.count})</span></p></div>
        <ChevronLeft className="h-4 w-4 text-muted-foreground" /></button>)}
      {open && <Profile id={open} onClose={() => setOpen(null)} onRequest={(e) => { setOpen(null); setReqFor(e); }} />}
    </div>
  );
}
function Avatar({ url, name }: { url: string | null; name: string }) {
  return url ? <img src={url} alt={name} className="h-14 w-14 shrink-0 rounded-full object-cover" /> : <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-ink text-lg font-bold text-ink-foreground">{name.slice(0, 1)}</div>;
}
function Tags({ t, xs }: { t: string; xs: string[] }) {
  if (!xs.length) return null;
  return <div className="space-y-1"><p className="text-xs font-bold text-muted-foreground">{t}</p><div className="flex flex-wrap gap-1">{xs.map((x) => <span key={x} className="rounded-full bg-muted px-2 py-0.5 text-xs">{x}</span>)}</div></div>;
}
function Profile({ id, onClose, onRequest }: { id: string; onClose: () => void; onRequest: (e: Eng) => void }) {
  const get = useServerFn(actsGetEngineer);
  const report = useServerFn(actsReportReview);
  const { data } = useQuery(offlineQuery({ queryKey: ["acts-engineer", id], queryFn: () => get({ data: { id } }) }));
  const e = data?.engineer; const rv = data?.reviews ?? [];
  const avg = rv.length ? rv.reduce((a, r) => a + r.rating, 0) / rv.length : 0;
  const sub = (k: "quality" | "punctuality" | "professionalism" | "responsiveness") => rv.length ? rv.reduce((a, r) => a + r[k], 0) / rv.length : 0;
  const projects = (e?.projects ?? []) as { title: string; desc: string; images: string[] }[];
  return (
    <div className="fixed inset-0 z-30 overflow-y-auto bg-background" dir="rtl">
      <div className="sticky top-0 flex items-center justify-between bg-ink px-4 py-3 text-ink-foreground"><span className="font-bold">ملف المهندس</span><button onClick={onClose} aria-label="إغلاق"><X className="h-5 w-5" /></button></div>
      {!e ? <p className="p-6 text-center text-sm">جارٍ التحميل...</p> : <div className="mx-auto max-w-3xl space-y-4 p-4 pb-28">
        <div className="flex items-center gap-3"><Avatar url={e.photo_url} name={e.name} /><div><p className="text-lg font-bold">{e.name}</p><p className="text-sm text-muted-foreground">{e.specialty}</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{[e.governorate, e.city].filter(Boolean).join(" - ")} · {e.years_exp} سنوات خبرة</p></div></div>
        <div className="rounded-2xl border border-border bg-card p-3"><div className="flex items-center gap-2"><Stars v={avg} /><b>{avg.toFixed(1)}</b><span className="text-xs text-muted-foreground">({rv.length} تقييم)</span></div>
          {rv.length > 0 && <div className="mt-2 grid grid-cols-2 gap-1 text-xs">{([["quality", "جودة العمل"], ["punctuality", "الالتزام بالمواعيد"], ["professionalism", "الاحترافية"], ["responsiveness", "سرعة الاستجابة"]] as const).map(([k, l]) => <span key={k}>{l}: <b>{sub(k).toFixed(1)}</b></span>)}</div>}</div>
        {e.bio && <p className="text-sm">{e.bio}</p>}
        {(e.university || e.qualifications) && <div className="text-sm"><p className="text-xs font-bold text-muted-foreground">المؤهلات</p><p>{[e.university, e.grad_year && `تخرج ${e.grad_year}`, e.qualifications].filter(Boolean).join(" · ")}</p></div>}
        <Tags t="المهارات" xs={e.skills} /><Tags t="البرامج والأدوات" xs={e.tools} /><Tags t="الخدمات" xs={e.services} />
        {projects.length > 0 && <div className="space-y-2"><p className="text-xs font-bold text-muted-foreground">المشاريع والأعمال</p>
          {projects.map((p, i) => <div key={i} className="rounded-xl border border-border bg-card p-3"><p className="font-bold">{p.title}</p><p className="text-xs text-muted-foreground">{p.desc}</p>
            {p.images.length > 0 && <div className="mt-2 flex gap-2 overflow-x-auto">{p.images.map((u) => <img key={u} src={u} alt={p.title} className="h-24 w-32 shrink-0 rounded-lg object-cover" />)}</div>}</div>)}</div>}
        {rv.length > 0 && <div className="space-y-2"><p className="text-xs font-bold text-muted-foreground">آراء العملاء</p>
          {rv.map((r) => <div key={r.id} className="rounded-xl border border-border bg-card p-3 text-sm"><div className="flex items-center justify-between"><Stars v={r.rating} size={3} />
            <button className="text-[11px] text-muted-foreground underline" onClick={async () => { const reason = window.prompt("سبب الإبلاغ عن هذا التقييم"); if (reason && reason.trim().length >= 3) { await report({ data: { review_id: r.id, reason } }); alert("تم إرسال البلاغ للإدارة"); } }}>إبلاغ</button></div>
            {r.comment && <p className="mt-1">{r.comment}</p>}<p className="text-[11px] text-muted-foreground">{r.reviewer_name ?? "عميل"} · {new Date(r.created_at).toLocaleDateString("ar")}</p></div>)}</div>}
        <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background p-3"><button className={`${btn} mx-auto block w-full max-w-3xl`} onClick={() => onRequest({ ...e, avg, count: rv.length })}><Briefcase className="ml-1 inline h-4 w-4" />اطلب خدمة من هذا المهندس</button></div>
      </div>}
    </div>
  );
}

function useUploader() {
  const up = useServerFn(actsUpload);
  return async (f: File) => {
    if (f.size > 9_000_000) throw new Error("حجم الملف كبير (الحد 9 ميجا)");
    return up({ data: { file_name: f.name, mime: f.type || "application/octet-stream", b64: await fileToB64(f) } });
  };
}

function ServiceRequest({ eng, onClose }: { eng: Eng | null; onClose: () => void }) {
  const send = useServerFn(actsServiceRequest);
  const upload = useUploader();
  const [f, setF] = useState({ name: "", phone: "", service: SERVICES[0]!, governorate: "", city: "", location: "", description: "" });
  const [files, setFiles] = useState<{ url: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [done, setDone] = useState(false);
  if (done) return <Done t="تم إرسال طلب الخدمة، ستتواصل معك إدارة أكتس لتأكيد التفاصيل." onBack={onClose} />;
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between"><h2 className="font-bold">طلب خدمة هندسية{eng ? ` — ${eng.name}` : ""}</h2><button onClick={onClose} aria-label="إغلاق"><X className="h-5 w-5" /></button></div>
      <Field l="نوع الخدمة"><select className={inp} value={f.service} onChange={(e) => setF({ ...f, service: e.target.value })}>{SERVICES.map((x) => <option key={x}>{x}</option>)}</select></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field l="المحافظة"><select className={inp} value={f.governorate} onChange={(e) => setF({ ...f, governorate: e.target.value })}><option value="">اختر</option>{GOVERNORATES.map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field l="المدينة"><input className={inp} value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></Field></div>
      <Field l="موقع المشروع (عنوان أو رابط خريطة)"><input className={inp} value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></Field>
      <Field l="وصف العمل *"><textarea className={`${inp} min-h-24`} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      <div className="space-y-1"><label className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-semibold"><Upload className="h-3.5 w-3.5" />إرفاق صور أو ملفات
        <input type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={async (e) => { setErr(""); for (const x of Array.from(e.target.files ?? [])) { try { const r = await upload(x); setFiles((p) => [...p, r]); } catch (er) { setErr(errMsg(er)); } } }} /></label>
        {files.map((x) => <p key={x.url} className="text-xs text-muted-foreground">📎 {x.name}</p>)}</div>
      <div className="grid grid-cols-2 gap-2">
        <Field l="الاسم"><input className={inp} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field l="رقم الواتساب *"><input className={inp} dir="ltr" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field></div>
      {err && <p className="text-sm text-destructive">{err}</p>}
      <button className={`${btn} w-full`} disabled={busy || f.description.trim().length < 5 || f.phone.replace(/\D/g, "").length < 6} onClick={async () => {
        setBusy(true); setErr(""); try { await send({ data: { ...f, engineer_id: eng?.id ?? null, attachments: files } }); setDone(true); } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
      }}>{busy ? "جارٍ الإرسال..." : "إرسال الطلب"}</button>
    </div>
  );
}

// ---------- 3. Talent registration (8 steps) ----------
function ListInput({ xs, set, ph }: { xs: string[]; set: (v: string[]) => void; ph: string }) {
  const [t, setT] = useState("");
  const add = () => { const v = t.trim(); if (v && !xs.includes(v)) set([...xs, v]); setT(""); };
  return <div className="space-y-2"><div className="flex gap-2"><input className={inp} value={t} placeholder={ph} onChange={(e) => setT(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} /><button type="button" className="rounded-xl border border-border px-3 text-sm" onClick={add}>إضافة</button></div>
    <div className="flex flex-wrap gap-1">{xs.map((x) => <button type="button" key={x} onClick={() => set(xs.filter((y) => y !== x))} className="rounded-full bg-muted px-2 py-0.5 text-xs">{x} ✕</button>)}</div></div>;
}
const STEPS = ["الحساب", "التخصص", "الدراسة", "المهارات", "الخدمات", "الخبرات", "الموقع", "المراجعة"];
function Join() {
  const reg = useServerFn(actsRegister);
  const upload = useUploader();
  const [s, setS] = useState(0);
  const [kind, setKind] = useState<"student" | "engineer">("engineer");
  const [a, setA] = useState({ name: "", phone: "", email: "", specialty: "", university: "", grad_year: "", qualifications: "", years_exp: "0", governorate: "", city: "", bio: "" });
  const [photo, setPhoto] = useState<string | null>(null);
  const [skills, setSkills] = useState<string[]>([]); const [tools, setTools] = useState<string[]>([]); const [services, setServices] = useState<string[]>([]);
  const [projects, setProjects] = useState<{ title: string; desc: string; images: string[] }[]>([]);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [done, setDone] = useState(false);
  const ok = [a.name.trim().length >= 2 && a.phone.replace(/\D/g, "").length >= 6, !!a.specialty, true, true, true, true, true, true][s];
  if (done) return <Done t="تم إرسال طلب التسجيل للإدارة للمراجعة والاعتماد، وسنبلغك عبر واتساب." onBack={() => { setDone(false); setS(0); }} />;
  const set = (k: keyof typeof a) => (e: { target: { value: string } }) => setA({ ...a, [k]: e.target.value });
  return (
    <div className="space-y-4">
      <div><p className="text-xs text-muted-foreground">الخطوة {s + 1} من 8 — {STEPS[s]}</p><div className="mt-1 flex gap-1">{STEPS.map((_, i) => <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= s ? "bg-primary" : "bg-muted"}`} />)}</div></div>
      <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
        {s === 0 && <>
          <div className="flex gap-2">{([["engineer", "مهندس"], ["student", "طالب هندسة"]] as const).map(([k, l]) => <button key={k} className={chip(kind === k)} onClick={() => setKind(k)}>{l}</button>)}</div>
          <Field l="الاسم الكامل *"><input className={inp} value={a.name} onChange={set("name")} /></Field>
          <Field l="رقم الهاتف (واتساب) *"><input className={inp} dir="ltr" inputMode="tel" value={a.phone} onChange={set("phone")} /></Field>
          <Field l="البريد الإلكتروني"><input className={inp} dir="ltr" type="email" value={a.email} onChange={set("email")} /></Field>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm">{photo ? <img src={photo} alt="الصورة الشخصية" className="h-12 w-12 rounded-full object-cover" /> : <Upload className="h-4 w-4" />}الصورة الشخصية
            <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const x = e.target.files?.[0]; if (x) try { setPhoto((await upload(x)).url); } catch (er) { setErr(errMsg(er)); } }} /></label>
        </>}
        {s === 1 && <div className="grid gap-2">{SPECIALTIES.map((x) => <button key={x} onClick={() => setA({ ...a, specialty: x })} className={`rounded-xl border p-3 text-right text-sm ${a.specialty === x ? "border-primary bg-primary/5 font-bold" : "border-border"}`}>{x}</button>)}</div>}
        {s === 2 && <>
          <Field l="الجامعة"><input className={inp} value={a.university} onChange={set("university")} /></Field>
          <Field l={kind === "student" ? "سنة التخرج المتوقعة" : "سنة التخرج"}><input className={inp} inputMode="numeric" value={a.grad_year} onChange={set("grad_year")} /></Field>
          <Field l="المؤهلات الأكاديمية والشهادات"><textarea className={inp} value={a.qualifications} onChange={set("qualifications")} /></Field>
        </>}
        {s === 3 && <><Field l="المهارات والقدرات الهندسية"><ListInput xs={skills} set={setSkills} ph="مثال: تصميم منظومات هجينة" /></Field>
          <Field l="البرامج والأدوات"><ListInput xs={tools} set={setTools} ph="مثال: PVsyst، AutoCAD" /></Field></>}
        {s === 4 && <><p className="text-sm font-bold">الخدمات التي تقدمها</p><div className="flex flex-wrap gap-2">{REG_SERVICES.map((x) => <button key={x} className={chip(services.includes(x))} onClick={() => setServices(services.includes(x) ? services.filter((y) => y !== x) : [...services, x])}>{x}</button>)}</div></>}
        {s === 5 && <>
          <Field l="سنوات الخبرة"><input className={inp} inputMode="numeric" value={a.years_exp} onChange={set("years_exp")} /></Field>
          <Field l="نبذة عنك"><textarea className={inp} value={a.bio} onChange={set("bio")} /></Field>
          {projects.map((p, i) => <div key={i} className="space-y-2 rounded-xl border border-border p-3">
            <div className="flex justify-between"><b className="text-sm">مشروع {i + 1}</b><button className="text-xs text-destructive" onClick={() => setProjects(projects.filter((_, j) => j !== i))}>حذف</button></div>
            <input className={inp} placeholder="اسم المشروع" value={p.title} onChange={(e) => setProjects(projects.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} />
            <textarea className={inp} placeholder="وصف مختصر" value={p.desc} onChange={(e) => setProjects(projects.map((x, j) => j === i ? { ...x, desc: e.target.value } : x))} />
            <div className="flex flex-wrap gap-2">{p.images.map((u) => <img key={u} src={u} alt="" className="h-16 w-16 rounded-lg object-cover" />)}
              {p.images.length < 6 && <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-lg border border-dashed border-border"><Upload className="h-4 w-4" />
                <input type="file" accept="image/*" multiple className="hidden" onChange={async (e) => { for (const x of Array.from(e.target.files ?? [])) { try { const r = await upload(x); setProjects((ps) => ps.map((y, j) => j === i ? { ...y, images: [...y.images, r.url].slice(0, 6) } : y)); } catch (er) { setErr(errMsg(er)); } } }} /></label>}</div>
          </div>)}
          {projects.length < 10 && <button className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold" onClick={() => setProjects([...projects, { title: "", desc: "", images: [] }])}>+ إضافة مشروع سابق</button>}
        </>}
        {s === 6 && <div className="grid grid-cols-2 gap-2">
          <Field l="المحافظة"><select className={inp} value={a.governorate} onChange={set("governorate")}><option value="">اختر</option>{GOVERNORATES.map((x) => <option key={x}>{x}</option>)}</select></Field>
          <Field l="المدينة"><input className={inp} value={a.city} onChange={set("city")} /></Field></div>}
        {s === 7 && <div className="space-y-1 text-sm">
          <p><b>{a.name}</b> — {kind === "student" ? "طالب" : "مهندس"} · {a.phone}</p><p>{a.specialty}</p>
          <p>{[a.university, a.grad_year].filter(Boolean).join(" · ")}</p><p>الخبرة: {a.years_exp} سنوات · المشاريع: {projects.filter((p) => p.title.trim()).length}</p>
          <p>المهارات: {skills.join("، ") || "—"}</p><p>البرامج: {tools.join("، ") || "—"}</p><p>الخدمات: {services.join("، ") || "—"}</p>
          <p>الموقع: {[a.governorate, a.city].filter(Boolean).join(" - ") || "—"}</p></div>}
        {err && <p className="text-sm text-destructive">{err}</p>}
        <div className="flex justify-between">{s > 0 ? <button className="text-sm" onClick={() => setS(s - 1)}>رجوع</button> : <span />}
          {s < 7 ? <button className={btn} disabled={!ok} onClick={() => setS(s + 1)}>التالي</button>
            : <button className={btn} disabled={busy} onClick={async () => {
              setBusy(true); setErr("");
              try {
                const gy = Number(a.grad_year);
                await reg({ data: { kind, name: a.name, phone: a.phone, email: a.email, photo_url: photo, specialty: a.specialty, university: a.university, grad_year: gy >= 1970 && gy <= 2040 ? gy : null, qualifications: a.qualifications, skills, tools, services, years_exp: Math.max(0, Math.min(60, Number(a.years_exp) || 0)), projects: projects.filter((p) => p.title.trim()), governorate: a.governorate, city: a.city, bio: a.bio } });
                setDone(true);
              } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
            }}>{busy ? "جارٍ الإرسال..." : "إرسال طلب التسجيل"}</button>}</div>
      </div>
      <p className="text-center text-xs text-muted-foreground"><Link to="/acts" className="underline">ACTES</Link> — بياناتك تراجعها إدارة أكتس فقط</p>
    </div>
  );
}
