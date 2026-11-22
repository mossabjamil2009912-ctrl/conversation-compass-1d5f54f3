import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// ACTS platform: public customer/engineer actions (phone only, no accounts) + CRM admin actions (dashboard password).
// All tables are server-only (RLS with no policies); only these handlers touch them.

function check(pw: string) {
  const real = process.env["DASHBOARD_PASSWORD"];
  if (!real || pw !== real) throw new Error("كلمة المرور غير صحيحة");
}
const db = async () => (await import("@/lib/db.server")).supabaseAdmin;
const digits = (p: string) => p.replace(/\D/g, "");
const s = (n: number) => z.string().trim().max(n).optional().nullable().transform((v) => v || null);
const Phone = z.string().trim().min(6).max(20).regex(/^[+\d\s-]+$/, "رقم الهاتف غير صحيح");

async function customerFor(phone: string, name: string | null, city: string | null, msg: string, stage: string) {
  const sb = await db();
  const p = digits(phone);
  const { data: c } = await sb.from("customers").select("id").like("phone", `%${p.slice(-9)}`).limit(1).maybeSingle();
  const now = new Date().toISOString();
  let id = c?.id;
  if (!id) {
    const { data: n, error } = await sb.from("customers").insert({ phone: p, name, city, stage, last_message: msg, last_at: now, unread: 1 }).select("id").single();
    if (error) throw new Error(error.message);
    id = n.id;
  } else {
    // Public callers can't prove they own this phone: never overwrite an existing customer's name/city/stage.
    await sb.from("customers").update({ last_message: msg, last_at: now }).eq("id", id);
  }
  await sb.from("messages").insert({ customer_id: id, direction: "customer", kind: "text", text: msg });
  return id;
}

const LOAD_SURVEY = "قياس الأحمال";
// ---------- Public ----------
export const actsQuoteRequest = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    phone: Phone, name: s(120), city: s(80), path: z.string().trim().max(10), method: z.enum(["bill", "kwh", "diesel"]),
    amount: z.number().positive().max(1e9), night: z.number().int().min(0).max(100),
    system: z.string().trim().min(1).max(300), reports: z.array(z.enum(["pvsyst", "sld"])).max(2),
  }).parse(d))
  .handler(async ({ data }) => {
    const unit = data.method === "bill" ? "ريال/شهر" : data.method === "kwh" ? "كيلو وات/شهر" : "لتر ديزل/شهر";
    const msg = `📱 طلب عرض سعر من تطبيق ACTS\nالنوع: ${({ res: "سكني", com: "تجاري", ind: "صناعي", agr: "زراعي" } as Record<string, string>)[data.path] ?? data.path}\nالمبلغ: ${data.amount} ${unit}\nالاستخدام: ليل ${data.night}% / نهار ${100 - data.night}%\nالمنظومة المختارة: ${data.system}${data.reports.length ? `\nطلب أيضاً: ${data.reports.join(" + ")}` : ""}`;
    const id = await customerFor(data.phone, data.name, data.city, msg, "quote");
    const sb = await db();
    for (const kind of data.reports) {
      const { data: rq } = await sb.from("report_requests").insert({ phone: digits(data.phone), customer_id: id, name: data.name, system_label: data.system, kind, city: null }).select("*").single();
      const { prewarmReport } = await import("@/lib/crm.functions");
      void prewarmReport(sb, rq);
    }
    if (data.system.includes("قياس أحمال")) {
      const loc = data.system.split("الموقع:")[1]?.trim() || data.city;
      await sb.from("acts_service_requests").insert({ phone: digits(data.phone), customer_id: id, name: data.name, service: LOAD_SURVEY, location: loc, description: data.system });
    }
    return { ok: true };
  });

const pub = "id,kind,name,photo_url,specialty,university,grad_year,qualifications,skills,tools,services,years_exp,projects,governorate,city,bio";
export const actsListEngineers = createServerFn({ method: "POST" })
  .handler(async () => {
    const sb = await db();
    const [{ data: e, error }, { data: r }] = await Promise.all([
      sb.from("acts_engineers").select(pub).eq("status", "approved").order("created_at", { ascending: false }),
      sb.from("acts_reviews").select("engineer_id,rating").eq("hidden", false),
    ]);
    if (error) throw new Error(error.message);
    return (e ?? []).map((x) => {
      const mine = (r ?? []).filter((v) => v.engineer_id === x.id);
      return { ...x, avg: mine.length ? mine.reduce((a, v) => a + v.rating, 0) / mine.length : 0, count: mine.length };
    });
  });

export const actsGetEngineer = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const sb = await db();
    const { data: e } = await sb.from("acts_engineers").select(pub).eq("id", data.id).eq("status", "approved").maybeSingle();
    if (!e) throw new Error("المهندس غير موجود");
    const { data: r } = await sb.from("acts_reviews").select("id,rating,quality,punctuality,professionalism,responsiveness,comment,reviewer_name,created_at").eq("engineer_id", data.id).eq("hidden", false).order("created_at", { ascending: false });
    return { engineer: e, reviews: r ?? [] };
  });

export const actsUpload = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ file_name: z.string().min(1).max(200), mime: z.string().max(100), b64: z.string().max(14_000_000) }).parse(d))
  .handler(async ({ data }) => {
    if (!/^(image\/|application\/pdf)/.test(data.mime)) throw new Error("نوع الملف غير مسموح");
    const sb = await db();
    const bin = Uint8Array.from(atob(data.b64), (ch) => ch.charCodeAt(0));
    const ext = (data.file_name.split(".").pop() ?? "bin").replace(/[^a-z0-9]/gi, "").slice(0, 8);
    const path = `acts/${crypto.randomUUID()}.${ext}`;
    const up = await sb.storage.from("crm-attachments").upload(path, bin, { contentType: data.mime });
    if (up.error) throw new Error("تعذّر رفع الملف");
    const sig = await sb.storage.from("crm-attachments").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    if (sig.error || !sig.data) throw new Error("تعذّر إنشاء رابط الملف");
    return { url: sig.data.signedUrl, name: data.file_name };
  });

const Url = z.string().url().max(2000);
export const actsRegister = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    kind: z.enum(["student", "engineer"]), name: z.string().trim().min(2).max(120), phone: Phone,
    email: z.string().trim().email().max(200).optional().or(z.literal("")).transform((v) => v || null),
    photo_url: Url.nullable(), specialty: z.string().trim().min(2).max(80), university: s(160),
    grad_year: z.number().int().min(1970).max(2040).nullable(), qualifications: s(1000),
    skills: z.array(z.string().trim().min(1).max(80)).max(40), tools: z.array(z.string().trim().min(1).max(80)).max(40),
    services: z.array(z.string().max(40)).max(10), years_exp: z.number().int().min(0).max(60),
    projects: z.array(z.object({ title: z.string().trim().min(1).max(160), desc: z.string().max(1000), images: z.array(Url).max(6) })).max(10),
    governorate: s(80), city: s(80), bio: s(1500),
  }).parse(d))
  .handler(async ({ data }) => {
    const sb = await db();
    const { error } = await sb.from("acts_engineers").insert({ ...data, phone: digits(data.phone) });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const actsServiceRequest = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    engineer_id: z.string().uuid().nullable(), name: s(120), phone: Phone, service: z.string().trim().min(2).max(80),
    governorate: s(80), city: s(80), location: s(300), description: z.string().trim().min(5).max(3000),
    attachments: z.array(z.object({ url: Url, name: z.string().max(200) })).max(8),
  }).parse(d))
  .handler(async ({ data }) => {
    const sb = await db();
    let engName = "";
    if (data.engineer_id) {
      const { data: e } = await sb.from("acts_engineers").select("name").eq("id", data.engineer_id).eq("status", "approved").maybeSingle();
      if (!e) throw new Error("المهندس غير متاح");
      engName = e.name;
    }
    const msg = `🛠 طلب خدمة هندسية من تطبيق ACTS\nالخدمة: ${data.service}${engName ? `\nالمهندس: ${engName}` : ""}\nالموقع: ${[data.governorate, data.city, data.location].filter(Boolean).join(" - ")}\n${data.description}`;
    const cid = await customerFor(data.phone, data.name, data.city, msg, "human");
    const { error } = await sb.from("acts_service_requests").insert({ ...data, phone: digits(data.phone), customer_id: cid });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const actsReviewInfo = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string().min(10).max(64) }).parse(d))
  .handler(async ({ data }) => {
    const sb = await db();
    const { data: r } = await sb.from("acts_service_requests").select("id,service,status,engineer_id,name,acts_engineers(name)").eq("review_token", data.token).maybeSingle();
    if (!r) throw new Error("الرابط غير صحيح");
    const { data: done } = await sb.from("acts_reviews").select("id").eq("request_id", r.id).maybeSingle();
    return { service: r.service, status: r.status, engineer: (r.acts_engineers as { name: string } | null)?.name ?? null, name: r.name, reviewed: !!done };
  });

const Star = z.number().int().min(1).max(5);
export const actsSubmitReview = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string().min(10).max(64), rating: Star, quality: Star, punctuality: Star, professionalism: Star, responsiveness: Star, comment: s(1500) }).parse(d))
  .handler(async ({ data }) => {
    const sb = await db();
    const { data: r } = await sb.from("acts_service_requests").select("id,engineer_id,status,name").eq("review_token", data.token).maybeSingle();
    if (!r) throw new Error("الرابط غير صحيح");
    if (r.status !== "done" || !r.engineer_id) throw new Error("لا يمكن التقييم قبل اكتمال الطلب");
    const { token: _t, ...v } = data;
    const { error } = await sb.from("acts_reviews").insert({ ...v, request_id: r.id, engineer_id: r.engineer_id, reviewer_name: r.name });
    if (error) throw new Error(error.code === "23505" ? "تم تقييم هذا الطلب مسبقاً" : error.message);
    return { ok: true };
  });

export const actsReportReview = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ review_id: z.string().uuid(), reason: z.string().trim().min(3).max(500) }).parse(d))
  .handler(async ({ data }) => {
    const sb = await db();
    const { error } = await sb.from("acts_review_reports").insert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- CRM admin ----------
export const actsAdminData = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ pw: z.string() }).parse(d))
  .handler(async ({ data }) => {
    check(data.pw);
    const sb = await db();
    const [e, r, v, rep] = await Promise.all([
      sb.from("acts_engineers").select("*").order("created_at", { ascending: false }),
      sb.from("acts_service_requests").select("*").order("created_at", { ascending: false }).limit(500),
      sb.from("acts_reviews").select("*").order("created_at", { ascending: false }).limit(500),
      sb.from("acts_review_reports").select("*").order("created_at", { ascending: false }).limit(500),
    ]);
    for (const x of [e, r, v, rep]) if (x.error) throw new Error(x.error.message);
    return { engineers: e.data!, requests: r.data!, reviews: v.data!, reports: rep.data! };
  });

export const actsSetEngineer = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ pw: z.string(), id: z.string().uuid(), status: z.enum(["pending", "approved", "rejected", "suspended"]), reject_reason: s(500) }).parse(d))
  .handler(async ({ data }) => {
    check(data.pw);
    const sb = await db();
    const { error } = await sb.from("acts_engineers").update({ status: data.status, reject_reason: data.reject_reason, updated_at: new Date().toISOString() }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const actsUpdateRequest = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ pw: z.string(), id: z.string().uuid(), status: z.enum(["new", "accepted", "in_progress", "done", "cancelled"]), engineer_id: z.string().uuid().nullable(), admin_notes: s(3000) }).parse(d))
  .handler(async ({ data }) => {
    check(data.pw);
    const sb = await db();
    const { pw: _p, id, ...rest } = data;
    const { error } = await sb.from("acts_service_requests").update({ ...rest, completed_at: data.status === "done" ? new Date().toISOString() : null }).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const actsModerate = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ pw: z.string(), review_id: z.string().uuid(), hidden: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    check(data.pw);
    const sb = await db();
    await sb.from("acts_reviews").update({ hidden: data.hidden }).eq("id", data.review_id);
    await sb.from("acts_review_reports").update({ resolved: true }).eq("review_id", data.review_id);
    return { ok: true };
  });

export const actsKwhPrice = createServerFn({ method: "POST" })
  .handler(async () => {
    const sb = await db();
    const { data: r } = await sb.from("app_settings").select("value").eq("key", "kwh_price").maybeSingle();
    return { kwh_price: r ? Number(r.value) : 290 };
  });

export const actsReportRequest = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ kind: z.enum(["pvsyst", "sld"]), name: s(120), phone: Phone, city: s(80), system: z.string().trim().min(1).max(300), price: z.number().optional(), tilt: z.union([z.string(), z.number()]).optional().nullable(), direction: z.string().max(4).optional().nullable(), loads: z.array(z.coerce.number().min(0).max(100000)).length(24).optional().nullable() }).parse(d))
  .handler(async ({ data }) => {
    const msg = `📱 طلب ${data.kind === "pvsyst" ? "تقرير PVsyst" : "مخطط SLD"} من تطبيق ACTS\nالمنظومة: ${data.system}`;
    const id = await customerFor(data.phone, data.name, data.city, msg, "quote");
    const sb = await db();
    const { data: rq } = await sb.from("report_requests").insert({ phone: digits(data.phone), customer_id: id, name: data.name, system_label: data.system, kind: data.kind, city: data.city, tilt: data.tilt != null && data.tilt !== "" && isFinite(+data.tilt) ? +data.tilt : null, azimuth: ["s", "n", "e", "w", "ns", "ew"].includes(data.direction ?? "") ? (data.direction ?? null) : null, loads: data.loads?.some((v) => v > 0) ? data.loads : null }).select("*").single();
    const { prewarmReport } = await import("@/lib/crm.functions");
    void prewarmReport(sb, rq);
    return { ok: true };
  });

const EngInput = z.object({
  pw: z.string(), id: z.string().uuid().optional().nullable(),
  kind: z.enum(["engineer", "student"]), status: z.enum(["pending", "approved", "rejected", "suspended"]),
  name: z.string().trim().min(2).max(120), phone: z.string().trim().max(20), email: s(200), photo_url: s(1000),
  specialty: z.string().trim().min(2).max(120), university: s(200), grad_year: z.number().int().min(1950).max(2100).nullable(),
  qualifications: s(300), years_exp: z.number().int().min(0).max(70),
  skills: z.array(z.string().trim().min(1).max(120)).max(50), tools: z.array(z.string().trim().min(1).max(120)).max(50), services: z.array(z.string().trim().min(1).max(120)).max(20),
  governorate: s(100), city: s(100), bio: s(2000),
});

export const actsSaveEngineer = createServerFn({ method: "POST" })
  .inputValidator((d) => EngInput.parse(d))
  .handler(async ({ data }) => {
    check(data.pw);
    const sb = await db();
    const { pw: _p, id, ...row } = data;
    const v = { ...row, phone: digits(row.phone), updated_at: new Date().toISOString() };
    const { error } = id ? await sb.from("acts_engineers").update(v).eq("id", id) : await sb.from("acts_engineers").insert(v);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const actsDeleteEngineer = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ pw: z.string(), id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    check(data.pw);
    const sb = await db();
    const { data: revs } = await sb.from("acts_reviews").select("id").eq("engineer_id", data.id);
    const ids = (revs ?? []).map((r) => r.id);
    if (ids.length) { await sb.from("acts_review_reports").delete().in("review_id", ids); await sb.from("acts_reviews").delete().in("id", ids); }
    await sb.from("acts_service_requests").update({ engineer_id: null }).eq("engineer_id", data.id);
    const { error } = await sb.from("acts_engineers").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
