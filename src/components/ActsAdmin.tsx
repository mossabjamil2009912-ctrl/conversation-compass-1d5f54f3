import { FloatingAppWindow } from "@/components/FloatingAppWindow";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Phone, MessageCircle, Copy, ExternalLink, Search, Plus, Trash2 } from "lucide-react";
import { actsAdminData, actsSetEngineer, actsUpdateRequest, actsModerate, actsSaveEngineer, actsDeleteEngineer } from "@/lib/acts.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { offlineQuery } from "@/lib/offline-cache";
import { REQ_STATUS, ENG_STATUS, SPECIALTIES, GOVERNORATES, REG_SERVICES } from "@/lib/acts-data";

type Data = Awaited<ReturnType<typeof actsAdminData>>;
type Eng = Data["engineers"][number];
type Sub = "regs" | "engineers" | "survey" | "requests" | "reviews";
const isSurvey = (r: { service: string }) => r.service.includes("قياس");
const card = "rounded-xl border border-border bg-background p-3 text-sm";
const sm = "rounded-full border px-2.5 py-1 text-xs font-semibold";

export function ActsAdmin({ pw, onOpenChat, onOpenApp }: { pw: string; onOpenChat?: ((phone: string, name: string) => void) | undefined; onOpenApp?: () => void }) {
  const load = useServerFn(actsAdminData);
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery(offlineQuery({ queryKey: ["acts-admin"], queryFn: () => load({ data: { pw } }) }));
  const refresh = () => qc.invalidateQueries({ queryKey: ["acts-admin"] });
  const [sub, setSub] = useState<Sub>("regs");
  const [showApp, setShowApp] = useState(false);
  const [edit, setEdit] = useState<Eng | "new" | null>(null);
  const d: Data = data ?? { engineers: [], requests: [], reviews: [], reports: [] };
  const pending = d.engineers.filter((e) => e.status === "pending");
  const openReports = d.reports.filter((r) => !r.resolved);
  const subs: [Sub, string, number][] = [
    ["regs", "طلبات التسجيل", pending.length], ["engineers", "المهندسون", 0], ["survey", "طلبات قياس الأحمال", d.requests.filter((r) => isSurvey(r) && r.status === "new").length], ["requests", "طلبات الخدمة", d.requests.filter((r) => !isSurvey(r) && r.status === "new").length],
    ["reviews", "التقييمات والبلاغات", openReports.length],
  ];
  return (
    <div dir="rtl" className="space-y-3 p-3">
      <div className="flex items-center justify-between"><h2 className="font-bold">منصة ACTES</h2>
        <button type="button" onClick={() => (onOpenApp ? onOpenApp() : setShowApp(true))} className="inline-flex items-center gap-1 text-xs text-primary underline"><ExternalLink className="h-3 w-3" />فتح منصة أكتس</button>{showApp && <FloatingAppWindow title="منصة أكتس" src="https://sunwise-engineer-network.lovable.app" allow="geolocation; clipboard-write" onClose={() => setShowApp(false)} />}</div>
      <div className="flex gap-1.5 overflow-x-auto pb-1">{subs.map(([k, l, n]) => <button key={k} onClick={() => setSub(k)} className={`${sm} shrink-0 ${sub === k ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{l}{n > 0 && <span className="mr-1 rounded-full bg-destructive px-1.5 text-destructive-foreground">{n}</span>}</button>)}</div>
      {isLoading && <p className="text-sm text-muted-foreground">جارٍ التحميل...</p>}
      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
      {sub === "regs" && <EngList onOpenChat={onOpenChat} onEdit={setEdit} pw={pw} rows={pending} refresh={refresh} empty="لا توجد طلبات تسجيل جديدة." />}
      {sub === "engineers" && <div className="flex justify-end"><button className={`${sm} inline-flex items-center gap-1 border-primary text-primary`} onClick={() => setEdit("new")}><Plus className="h-3 w-3" />إضافة مهندس</button></div>}
      {sub === "engineers" && <EngList onEdit={setEdit} pw={pw} rows={d.engineers.filter((e) => e.status !== "pending" && e.kind === "engineer")} refresh={refresh} empty="لا يوجد مهندسون بعد." />}
      {sub === "survey" && <Surveys rows={d.requests.filter(isSurvey)} onOpenChat={onOpenChat} />}
      {sub === "requests" && <Requests pw={pw} d={{ ...d, requests: d.requests.filter((r) => !isSurvey(r)) }} refresh={refresh} />}
      {sub === "reviews" && <Reviews pw={pw} d={d} refresh={refresh} />}
      {edit && <EngForm pw={pw} eng={edit === "new" ? null : edit} onClose={() => setEdit(null)} refresh={refresh} />}
    </div>
  );
}

function EngList({ pw, rows, refresh, empty, onOpenChat }: { pw: string; rows: Data["engineers"]; refresh: () => void; empty: string; onEdit: (e: Eng) => void; onOpenChat?: ((phone: string, name: string) => void) | undefined }) {
  const set = useServerFn(actsSetEngineer);
  const del = useServerFn(actsDeleteEngineer);
  const [open, setOpen] = useState<string | null>(null);
  const act = async (id: string, status: "approved" | "rejected" | "suspended" | "pending") => {
    const reason = status === "rejected" ? window.prompt("سبب الرفض") : null;
    if (status === "rejected" && reason === null) return;
    await set({ data: { pw, id, status, reject_reason: reason } }); refresh();
  };
  if (!rows.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return <div className="space-y-2">{rows.map((e) => {
    const projects = (e.projects ?? []) as { title: string; desc: string; images: string[] }[];
    return <div key={e.id} className={card}>
      <button className="flex w-full items-center gap-3 text-right" onClick={() => setOpen(open === e.id ? null : e.id)}>
        {e.photo_url ? <img src={e.photo_url} alt={e.name} className="h-10 w-10 rounded-full object-cover" /> : <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ink font-bold text-ink-foreground">{e.name.slice(0, 1)}</div>}
        <div className="flex-1"><p className="font-bold">{e.name} <span className="text-xs font-normal text-muted-foreground">({e.kind === "student" ? "طالب" : "مهندس"})</span></p>
          <p className="text-xs text-muted-foreground">{e.specialty} · {[e.governorate, e.city].filter(Boolean).join(" - ")} · {ENG_STATUS[e.status] ?? e.status}</p></div></button>
      {open === e.id && <div className="mt-2 space-y-1 border-t border-border pt-2 text-xs">
        <p className="flex items-center gap-1">{e.phone && <><Phone className="h-3 w-3" /><a href={`https://wa.me/${e.phone}`} target="_blank" rel="noreferrer" dir="ltr">{e.phone}</a></>}{e.email && ` · ${e.email}`}</p>
        <p>الدراسة: {[e.university, e.grad_year, e.qualifications].filter(Boolean).join(" · ") || "—"}</p>
        <p>الخبرة: {e.years_exp} سنوات</p><p>المهارات: {e.skills.join("، ") || "—"}</p><p>البرامج: {e.tools.join("، ") || "—"}</p><p>الخدمات: {e.services.join("، ") || "—"}</p>
        {e.bio && <p>نبذة: {e.bio}</p>}
        {projects.map((p, i) => <div key={i}><b>{p.title}</b> — {p.desc}<div className="flex gap-1">{p.images.map((u) => <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt="" className="h-12 w-12 rounded object-cover" /></a>)}</div></div>)}
        {e.reject_reason && <p className="text-destructive">سبب الرفض: {e.reject_reason}</p>}
      </div>}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {e.status === "pending" ? (e.phone
          ? <button className={`${sm} inline-flex items-center gap-1 border-primary bg-primary text-primary-foreground`} onClick={() => onOpenChat?.(e.phone!, e.name)}><MessageCircle className="h-3 w-3" />فتح محادثة واتساب</button>
          : <span className="text-xs text-muted-foreground">لا يوجد رقم هاتف</span>)
          : e.status !== "approved" && <button className={`${sm} border-primary text-primary`} onClick={() => act(e.id, "approved")}>اعتماد</button>}
        {e.status === "approved" && <button className={`${sm} border-border`} onClick={() => act(e.id, "suspended")}>إيقاف</button>}
        <button className={`${sm} inline-flex items-center gap-1 border-destructive text-destructive`} onClick={async () => { if (!window.confirm(`حذف ${e.name} نهائياً؟`)) return; await del({ data: { pw, id: e.id } }); refresh(); }}><Trash2 className="h-3 w-3" />حذف</button>
      </div>
    </div>;
  })}</div>;
}

function Surveys({ rows, onOpenChat }: { rows: Data["requests"]; onOpenChat?: ((phone: string, name: string) => void) | undefined }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">لا توجد طلبات قياس أحمال بعد.</p>;
  return <div className="space-y-2">{rows.map((r) => {
    const sys = r.description.replace(/\[طلب قياس أحمال\]/, "").replace(/الموقع:.*$/, "").replace(/[\[\]]/g, "").trim();
    const loc = [r.governorate, r.city, r.location].filter(Boolean).join(" - ");
    const Row = ({ k, v, ltr }: { k: string; v: string; ltr?: boolean }) => <div className="flex justify-between gap-2 border-b border-border py-1.5 last:border-0"><span className="text-muted-foreground">{k}</span><b dir={ltr ? "ltr" : undefined}>{v || "—"}</b></div>;
    return <div key={r.id} className={card}>
      <div className="mb-1 flex justify-between"><b>قياس الأحمال</b><span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("ar", { dateStyle: "short", timeStyle: "short" })}</span></div>
      <div className="text-sm">
        <Row k="الاسم" v={r.name ?? "عميل"} />
        <Row k="الهاتف" v={r.phone} ltr />
        <Row k="الموقع" v={loc} />
        <Row k="النظام" v={sys} />
      </div>
      <button className={`${sm} mt-2 inline-flex w-full items-center justify-center gap-1 border-primary bg-primary text-primary-foreground`} onClick={() => onOpenChat?.(r.phone, r.name ?? "عميل")}><MessageCircle className="h-3 w-3" />فتح المحادثة</button>
    </div>;
  })}</div>;
}

function Requests({ pw, d, refresh, empty = "لا توجد طلبات خدمة بعد." }: { pw: string; d: Data; refresh: () => void; empty?: string }) {
  const upd = useServerFn(actsUpdateRequest);
  const approved = d.engineers.filter((e) => e.status === "approved");
  const [notes, setNotes] = useState<Record<string, string>>({});
  if (!d.requests.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return <div className="space-y-2">{d.requests.map((r) => {
    const save = async (p: Partial<{ status: string; engineer_id: string | null; admin_notes: string }>) => {
      await upd({ data: { pw, id: r.id, status: (p.status ?? r.status) as "new", engineer_id: p.engineer_id !== undefined ? p.engineer_id : r.engineer_id, admin_notes: p.admin_notes ?? r.admin_notes } }); refresh();
    };
    const link = `https://sunwise-engineer-network.lovable.app/rate/${r.review_token}`;
    const atts = (r.attachments ?? []) as { url: string; name: string }[];
    return <div key={r.id} className={card}>
      <div className="flex justify-between"><b>{r.service}</b><span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("ar", { dateStyle: "short", timeStyle: "short" })}</span></div>
      <p className="text-xs">{r.name ?? "عميل"} · <a href={`https://wa.me/${r.phone}`} target="_blank" rel="noreferrer" dir="ltr">{r.phone}</a> · {[r.governorate, r.city, r.location].filter(Boolean).join(" - ")}</p>
      <p className="my-1 whitespace-pre-wrap">{r.description}</p>
      {atts.length > 0 && <div className="flex flex-wrap gap-2 text-xs">{atts.map((a) => <a key={a.url} href={a.url} target="_blank" rel="noreferrer" className="underline">📎 {a.name}</a>)}</div>}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <select className="rounded-lg border border-border bg-card p-1.5 text-xs" value={r.status} onChange={(e) => save({ status: e.target.value })}>{Object.entries(REQ_STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <select className="rounded-lg border border-border bg-card p-1.5 text-xs" value={r.engineer_id ?? ""} onChange={(e) => save({ engineer_id: e.target.value || null })}><option value="">بدون مهندس</option>{approved.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
      </div>
      <textarea className="mt-2 w-full rounded-lg border border-border bg-card p-2 text-xs" placeholder="ملاحظات الإدارة" value={notes[r.id] ?? r.admin_notes ?? ""} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} onBlur={() => notes[r.id] !== undefined && notes[r.id] !== (r.admin_notes ?? "") && save({ admin_notes: notes[r.id] ?? "" })} />
      {r.status === "done" && r.engineer_id && <div className="mt-2 flex flex-wrap gap-1.5">
        <button className={`${sm} border-border`} onClick={() => navigator.clipboard.writeText(link)}><Copy className="ml-1 inline h-3 w-3" />نسخ رابط التقييم</button>
        <a className={`${sm} border-primary text-primary`} target="_blank" rel="noreferrer" href={`https://wa.me/${r.phone}?text=${encodeURIComponent(`شكراً لتعاملك مع أكتس. نرجو تقييم الخدمة من هنا:\n${link}`)}`}>إرسال رابط التقييم واتساب</a></div>}
    </div>;
  })}</div>;
}

function Reviews({ pw, d, refresh }: { pw: string; d: Data; refresh: () => void }) {
  const mod = useServerFn(actsModerate);
  const name = (id: string) => d.engineers.find((e) => e.id === id)?.name ?? "—";
  const reported = new Set(d.reports.filter((r) => !r.resolved).map((r) => r.review_id));
  const rows = [...d.reviews].sort((a, b) => Number(reported.has(b.id)) - Number(reported.has(a.id)));
  if (!rows.length) return <p className="text-sm text-muted-foreground">لا توجد تقييمات بعد.</p>;
  return <div className="space-y-2">{rows.map((v) => <div key={v.id} className={`${card} ${reported.has(v.id) ? "border-destructive" : ""}`}>
    <div className="flex justify-between"><b>{name(v.engineer_id)}</b><span>{"★".repeat(v.rating)}{"☆".repeat(5 - v.rating)}</span></div>
    <p className="text-xs text-muted-foreground">جودة {v.quality} · مواعيد {v.punctuality} · احترافية {v.professionalism} · استجابة {v.responsiveness} — {v.reviewer_name ?? "عميل"}</p>
    {v.comment && <p className="mt-1">{v.comment}</p>}
    {d.reports.filter((r) => r.review_id === v.id && !r.resolved).map((r) => <p key={r.id} className="mt-1 text-xs text-destructive">بلاغ: {r.reason}</p>)}
    <div className="mt-2 flex gap-1.5">
      <button className={`${sm} border-border`} onClick={async () => { await mod({ data: { pw, review_id: v.id, hidden: !v.hidden } }); refresh(); }}>{v.hidden ? "إظهار التقييم" : "إخفاء التقييم"}</button>
      {reported.has(v.id) && !v.hidden && <button className={`${sm} border-primary text-primary`} onClick={async () => { await mod({ data: { pw, review_id: v.id, hidden: false } }); refresh(); }}>إبقاء وإغلاق البلاغ</button>}
    </div>
  </div>)}</div>;
}

const inp = "w-full rounded-lg border border-border bg-card p-2 text-sm";
const list = (v: string) => v.split(/[،,]/).map((x) => x.trim()).filter(Boolean);

function L({ t, children }: { t: string; children: React.ReactNode }) { return <label className="block space-y-1 text-xs font-semibold"><span>{t}</span>{children}</label>; }

function EngForm({ pw, eng, onClose, refresh }: { pw: string; eng: Eng | null; onClose: () => void; refresh: () => void }) {
  const save = useServerFn(actsSaveEngineer);
  const [f, setF] = useState({
    name: eng?.name ?? "", phone: eng?.phone ?? "", email: eng?.email ?? "", photo_url: eng?.photo_url ?? "",
    kind: (eng?.kind ?? "engineer") as "engineer" | "student", status: (eng?.status ?? "approved") as "approved",
    specialty: eng?.specialty ?? SPECIALTIES[0], university: eng?.university ?? "", grad_year: eng?.grad_year ? String(eng.grad_year) : "",
    qualifications: eng?.qualifications ?? "", years_exp: String(eng?.years_exp ?? 0), governorate: eng?.governorate ?? "", city: eng?.city ?? "",
    skills: (eng?.skills ?? []).join("، "), tools: (eng?.tools ?? []).join("، "), services: eng?.services ?? [], bio: eng?.bio ?? "",
  });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const u = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const submit = async () => {
    setBusy(true); setErr("");
    try {
      await save({ data: { pw, id: eng?.id ?? null, ...f, grad_year: f.grad_year ? Number(f.grad_year) : null, years_exp: Number(f.years_exp) || 0, skills: list(f.skills), tools: list(f.tools) } });
      refresh(); onClose();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return <Dialog open onOpenChange={(o) => !o && onClose()}>
    <DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{eng ? "تعديل مهندس" : "إضافة مهندس"}</DialogTitle></DialogHeader>
      <div className="grid gap-2">
        <L t="الاسم"><input className={inp} value={f.name} onChange={u("name")} /></L>
        <div className="grid grid-cols-2 gap-2">
          <L t="الهاتف"><input className={inp} dir="ltr" value={f.phone} onChange={u("phone")} /></L>
          <L t="البريد"><input className={inp} dir="ltr" value={f.email} onChange={u("email")} /></L>
          <L t="النوع"><select className={inp} value={f.kind} onChange={u("kind")}><option value="engineer">مهندس</option><option value="student">طالب</option></select></L>
          <L t="الحالة"><select className={inp} value={f.status} onChange={u("status")}>{Object.entries(ENG_STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></L>
        </div>
        <L t="التخصص"><select className={inp} value={f.specialty} onChange={u("specialty")}>{[...new Set([...SPECIALTIES, f.specialty])].map((x) => <option key={x}>{x}</option>)}</select></L>
        <div className="grid grid-cols-2 gap-2">
          <L t="الجامعة"><input className={inp} value={f.university} onChange={u("university")} /></L>
          <L t="سنة التخرج"><input className={inp} inputMode="numeric" value={f.grad_year} onChange={u("grad_year")} /></L>
          <L t="المؤهل"><input className={inp} value={f.qualifications} onChange={u("qualifications")} /></L>
          <L t="سنوات الخبرة"><input className={inp} inputMode="numeric" value={f.years_exp} onChange={u("years_exp")} /></L>
          <L t="المحافظة"><select className={inp} value={f.governorate} onChange={u("governorate")}><option value="">—</option>{GOVERNORATES.map((x) => <option key={x}>{x}</option>)}</select></L>
          <L t="المدينة"><input className={inp} value={f.city} onChange={u("city")} /></L>
        </div>
        <L t="المهارات (افصل بفاصلة)"><input className={inp} value={f.skills} onChange={u("skills")} /></L>
        <L t="البرامج والأدوات (افصل بفاصلة)"><input className={inp} value={f.tools} onChange={u("tools")} /></L>
        <div className="space-y-1 text-xs font-semibold"><span>الخدمات</span><div className="flex flex-wrap gap-1.5">{REG_SERVICES.map((x) => {
          const on = f.services.includes(x);
          return <button key={x} type="button" className={`${sm} ${on ? "border-primary bg-primary text-primary-foreground" : "border-border"}`} onClick={() => setF({ ...f, services: on ? f.services.filter((y) => y !== x) : [...f.services, x] })}>{x}</button>;
        })}</div></div>
        <L t="رابط الصورة"><input className={inp} dir="ltr" value={f.photo_url} onChange={u("photo_url")} /></L>
        <L t="نبذة"><textarea className={inp} rows={3} value={f.bio} onChange={u("bio")} /></L>
        {err && <p className="text-xs text-destructive">{err}</p>}
        <button disabled={busy || f.name.trim().length < 2} onClick={submit} className="rounded-lg bg-primary p-2 text-sm font-bold text-primary-foreground disabled:opacity-50">{busy ? "جارٍ الحفظ..." : "حفظ"}</button>
      </div>
    </DialogContent>
  </Dialog>;
}
