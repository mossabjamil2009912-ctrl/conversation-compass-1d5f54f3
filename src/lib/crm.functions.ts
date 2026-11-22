import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { N8N_URL, DEFAULT_FRONTEND_URL, normalizeServerUrl } from "@/lib/server-url-rules";

const flowCode = () => process.env["FLOW_PIN"] || "2027";
export const verifyFlowPin = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ pw: z.string(), code: z.string().max(40) }).parse(d))
  .handler(async ({ data }) => { check(data.pw); return { ok: data.code === flowCode() }; });

function check(pw: string) {
  const real = process.env["DASHBOARD_PASSWORD"];
  if (!real || pw !== real) throw new Error("كلمة المرور غير صحيحة");
}

export const listCustomers = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ pw: z.string() }).parse(d))
  .handler(async ({ data }) => {
    check(data.pw);
    const { supabaseAdmin } = await import("@/lib/db.server");
    const { data: rows, error } = await supabaseAdmin
      .from("customers").select("*").is("deleted_at", null).eq("blocked", false).order("last_at", { ascending: false }).limit(500);
    if (error) throw new Error(error.message);
    const since = new Date(Date.now() - 2 * 864e5).toISOString();
    const { data: cm } = await supabaseAdmin.from("messages").select("customer_id, created_at")
      .eq("direction", "customer").gte("created_at", since).order("created_at", { ascending: false }).limit(3000);
    const lastIn: Record<string, string> = {};
    for (const m of cm ?? []) if (!lastIn[m.customer_id]) lastIn[m.customer_id] = m.created_at;
    return rows.map((r) => ({ ...r, notes: ((r as Record<string, unknown>)["notes"] as string | null) ?? null, last_customer_at: lastIn[r.id] ?? null }));
  });

// Chat deletion: "delete" hides the chat on every device (it comes back, fresh, when the customer writes again);
// "block" also keeps every future message hidden. Both stay restorable from the hidden archive.
export const deleteChat = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ pw: z.string(), id: z.string().uuid(), block: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    check(data.pw);
    const { supabaseAdmin } = await import("@/lib/db.server");
    const { error } = await supabaseAdmin.from("customers")
      .update({ deleted_at: new Date().toISOString(), blocked: data.block, unread: 0 }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listDeletedChats = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ pw: z.string() }).parse(d))
  .handler(async ({ data }) => {
    check(data.pw);
    const { supabaseAdmin } = await import("@/lib/db.server");
    const { data: rows, error } = await supabaseAdmin.from("customers")
      .select("id, phone, name, city, system, last_message, last_at, deleted_at, blocked")
      .or("deleted_at.not.is.null,blocked.eq.true").order("deleted_at", { ascending: false, nullsFirst: false }).limit(500);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const restoreChat = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ pw: z.string(), id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    check(data.pw);
    const { supabaseAdmin } = await import("@/lib/db.server");
    const { error } = await supabaseAdmin.from("customers")
      .update({ deleted_at: null, blocked: false, hidden_before: null }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Staff opening/creating a chat for a deleted number brings it back as a fresh chat.
async function reviveChat(id: string) {
  const { supabaseAdmin } = await import("@/lib/db.server");
  const { data: c } = await supabaseAdmin.from("customers").select("deleted_at, blocked").eq("id", id).maybeSingle();
  if (!c || (!c.deleted_at && !c.blocked)) return;
  await supabaseAdmin.from("customers").update({ deleted_at: null, blocked: false, hidden_before: c.deleted_at ?? new Date().toISOString() }).eq("id", id);
}

export const setBotPaused = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ pw: z.string(), id: z.string().uuid(), paused: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    check(data.pw);
    const { supabaseAdmin } = await import("@/lib/db.server");
    const { error } = await supabaseAdmin.from("customers").update({ bot_paused: data.paused } as never).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveNote = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ pw: z.string(), id: z.string().uuid(), notes: z.string().max(5000) }).parse(d))
  .handler(async ({ data }) => {
    check(data.pw);
    const { supabaseAdmin } = await import("@/lib/db.server");
    const { error } = await supabaseAdmin.from("customers").update({ notes: data.notes } as never).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMessages = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ pw: z.string(), id: z.string().uuid(), all: z.boolean().optional() }).parse(d))
  .handler(async ({ data }) => {
    check(data.pw);
    const { supabaseAdmin } = await import("@/lib/db.server");
    const [, { data: desc, error }, { data: cust }] = await Promise.all([
      supabaseAdmin.from("customers").update({ unread: 0 }).eq("id", data.id).gt("unread", 0),
      supabaseAdmin.from("messages").select("*").eq("customer_id", data.id)
        .order("created_at", { ascending: false }).limit(1000),
      supabaseAdmin.from("customers").select("hidden_before").eq("id", data.id).maybeSingle(),
    ]);
    if (error) throw new Error(error.message);
    // أحدث 1000 رسالة (كانت تُجلب الأقدم فتختفي الرسائل الجديدة في المحادثات الطويلة)
    // محادثة حُذفت ثم عاد العميل: تظهر الرسائل الجديدة فقط (الأرشيف يعرض الكل)
    const cut = !data.all && cust?.hidden_before ? new Date(cust.hidden_before).getTime() : 0;
    const all = (desc ?? []).reverse().filter((r) => !cut || new Date(r.created_at).getTime() > cut);
    // فقاعة الملف قد تُسجَّل قبل رسالة العميل (سباق توقيت): نحتفظ بالفقاعة التي في مكانها الصحيح ونعطيها الملف
    const isPdf = (r: (typeof all)[number]) => r.direction === "bot" && r.kind === "pdf";
    const near = (a: (typeof all)[number], b: (typeof all)[number]) => Math.abs(new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) < 120000;
    const withMedia = new Map<string, (typeof all)[number]>();
    for (const r of all) if (isPdf(r) && r.media_id) withMedia.set(r.text, r);
    const rows = all.filter((r) => {
      if (!(isPdf(r) && r.media_id)) return true;
      return !all.some((o) => o !== r && isPdf(o) && !o.media_id && o.text === r.text && near(o, r));
    }).map((r) => {
      if (isPdf(r) && !r.media_id && !r.media_url) {
        const o = withMedia.get(r.text);
        if (o) return { ...r, media_id: o.media_id, file_name: o.file_name, mime: o.mime };
      }
      return r;
    });
    // في واتساب تصل الملفات (عرض السعر والكتالوجات) قبل الرسالة النصية والأزرار في نفس الرد
    const isFile = (r: (typeof all)[number]) => r.direction === "bot" && ["pdf", "document", "image", "video"].includes(r.kind);
    const ordered: typeof rows = [];
    for (let i = 0; i < rows.length; ) {
      if (rows[i]!.direction !== "bot") { ordered.push(rows[i++]!); continue; }
      let j = i + 1;
      while (j < rows.length && rows[j]!.direction === "bot" && near(rows[j - 1]!, rows[j]!)) j++;
      const run = rows.slice(i, j);
      ordered.push(...run.filter(isFile), ...run.filter((r) => !isFile(r)));
      i = j;
    }
    const { mediaToken } = await import("./media-token.server");
    return Promise.all(ordered.map(async (r) => ({
      ...r,
      src: r.media_url ? r.media_url
        : r.media_id ? `/api/public/crm-media?id=${encodeURIComponent(r.media_id)}&t=${await mediaToken(r.media_id)}${r.file_name ? `&n=${encodeURIComponent(r.file_name)}` : ""}`
        : null,
    })));
  });

export const sendMessage = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ pw: z.string(), id: z.string().uuid(), text: z.string().trim().min(1).max(4000) }).parse(d))
  .handler(async ({ data }) => {
    check(data.pw);
    const { supabaseAdmin } = await import("@/lib/db.server");
    const { data: c, error } = await supabaseAdmin.from("customers").select("phone").eq("id", data.id).single();
    if (error || !c) throw new Error("العميل غير موجود");
    const res = await fetch(`${N8N_URL}/webhook/actes-send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-bot-secret": process.env["BOT_INGEST_SECRET"] ?? "" },
      body: JSON.stringify({ phone: c.phone, text: data.text }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`n8n send failed [${res.status}]: ${body}`);
      throw new Error(`تعذّر الإرسال (${res.status})`);
    }
    const now = new Date().toISOString();
    await supabaseAdmin.from("messages").insert({ customer_id: data.id, direction: "agent", kind: "text", text: data.text });
    await supabaseAdmin.from("customers").update({ last_message: data.text, last_at: now }).eq("id", data.id);
    return { ok: true };
  });

export const ensureCustomerByPhone = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ pw: z.string(), phone: z.string().regex(/^\d{9,15}$/), name: z.string().max(200).optional() }).parse(d))
  .handler(async ({ data }) => {
    check(data.pw);
    const { supabaseAdmin } = await import("@/lib/db.server");
    const { data: ex } = await supabaseAdmin.from("customers").select("id").eq("phone", data.phone).maybeSingle();
    if (ex) { await reviveChat(ex.id as string); return { id: ex.id as string }; }
    const { data: c, error } = await supabaseAdmin.from("customers").insert({ phone: data.phone, name: data.name || null }).select("id").single();
    if (error || !c) throw new Error("تعذّر إضافة الرقم");
    return { id: c.id as string };
  });

export const sendAttachment = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    pw: z.string(), id: z.string().uuid(), text: z.string().max(1024).default(""),
    file_name: z.string().min(1).max(200), mime: z.string().max(120), b64: z.string().max(23_000_000).default(""), url: z.string().url().max(2000).optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    check(data.pw);
    const { supabaseAdmin } = await import("@/lib/db.server");
    const { data: c, error } = await supabaseAdmin.from("customers").select("phone").eq("id", data.id).single();
    if (error || !c) throw new Error("العميل غير موجود");
    let bin: Uint8Array;
    if (data.url) {
      if (!/^https:\/\//.test(data.url)) throw new Error("رابط غير مسموح");
      const r = await fetch(data.url);
      if (!r.ok) throw new Error("تعذّر جلب الملف");
      const ct = r.headers.get("content-type") || "";
      if (ct) data.mime = ct.split(";")[0]!.trim();
      bin = new Uint8Array(await r.arrayBuffer());
      if (bin.length > 16 * 1024 * 1024) throw new Error("حجم الملف أكبر من 16MB");
    } else bin = Uint8Array.from(atob(data.b64), (ch) => ch.charCodeAt(0));
    const ext = (data.file_name.split(".").pop() ?? "bin").replace(/[^A-Za-z0-9]/g, "").slice(0, 8) || "bin";
    const path = `${data.id}/${crypto.randomUUID()}.${ext}`;
    const up = await supabaseAdmin.storage.from("crm-attachments").upload(path, bin, { contentType: data.mime || "application/octet-stream" });
    if (up.error) throw new Error("تعذّر رفع الملف");
    const sig = await supabaseAdmin.storage.from("crm-attachments").createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
    if (sig.error || !sig.data) throw new Error("تعذّر إنشاء رابط الملف");
    const url = sig.data.signedUrl;
    const m = data.mime;
    const kind = m.startsWith("image/") ? "image" : m.startsWith("video/") ? "video" : m.startsWith("audio/") ? "audio" : m === "application/pdf" ? "pdf" : "document";
    const res = await fetch(`${N8N_URL}/webhook/actes-send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-bot-secret": process.env["BOT_INGEST_SECRET"] ?? "" },
      body: JSON.stringify({ phone: c.phone, text: data.text, media_url: url, media_type: kind, file_name: data.file_name }),
    });
    if (!res.ok) {
      console.error(`n8n media send failed [${res.status}]: ${await res.text()}`);
      throw new Error(`تعذّر الإرسال (${res.status})`);
    }
    const now = new Date().toISOString();
    const label = data.text || `📎 ${data.file_name}`;
    await supabaseAdmin.from("messages").insert({ customer_id: data.id, direction: "agent", kind, text: label, media_url: url, mime: m, file_name: data.file_name });
    await supabaseAdmin.from("customers").update({ last_message: label, last_at: now }).eq("id", data.id);
    return { ok: true };
  });

// Uploads a quote PDF and returns a long-lived link, so it can be sent to any number via wa.me.
export const uploadQuotePdf = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ pw: z.string(), file_name: z.string().min(1).max(200), b64: z.string().max(23_000_000) }).parse(d))
  .handler(async ({ data }) => {
    check(data.pw);
    const { supabaseAdmin } = await import("@/lib/db.server");
    const bin = Uint8Array.from(atob(data.b64), (ch) => ch.charCodeAt(0));
    const path = `quotes/${crypto.randomUUID()}.pdf`;
    const up = await supabaseAdmin.storage.from("crm-attachments").upload(path, bin, { contentType: "application/pdf" });
    if (up.error) throw new Error("تعذّر رفع الملف");
    const sig = await supabaseAdmin.storage.from("crm-attachments").createSignedUrl(path, 60 * 60 * 24 * 365, { download: data.file_name });
    if (sig.error || !sig.data) throw new Error("تعذّر إنشاء رابط الملف");
    return { url: sig.data.signedUrl };
  });

const CONFIRM_TEXT = "أكتس لاستيراد أنظمة الطاقة\nشكراً لك، لقد تم تأكيد فاتورتك.\nستتواصل معك إدارة المبيعات في شركة أكتس خلال لحظات.";
const CANCEL_TEXT = "أكتس لاستيراد أنظمة الطاقة\nلم يتم العثور على إشعار التحويل حتى الآن.\nيرجى التأكد من التحويل أو إعادة إرسال الإشعار.";

export const listOrders = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ pw: z.string() }).parse(d))
  .handler(async ({ data }) => {
    check(data.pw);
    const { supabaseAdmin } = await import("@/lib/db.server");
    const { data: rows, error } = await supabaseAdmin
      .from("orders").select("*").order("created_at", { ascending: false }).limit(500);
    if (error) throw new Error(error.message);
    return rows;
  });

export const decideOrder = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ pw: z.string(), id: z.string().uuid(), status: z.enum(["confirmed", "cancelled"]) }).parse(d))
  .handler(async ({ data }) => {
    check(data.pw);
    const { supabaseAdmin } = await import("@/lib/db.server");
    const { data: o, error } = await supabaseAdmin.from("orders").select("*").eq("id", data.id).single();
    if (error || !o) throw new Error("الطلب غير موجود");
    if (o.status !== "pending") throw new Error("تم البت في هذا الطلب مسبقاً");
    const text = data.status === "confirmed" ? CONFIRM_TEXT : CANCEL_TEXT;
    const res = await fetch(`${N8N_URL}/webhook/actes-send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-bot-secret": process.env["BOT_INGEST_SECRET"] ?? "" },
      body: JSON.stringify({ phone: o.phone, text }),
    });
    if (!res.ok) {
      console.error(`n8n send failed [${res.status}]: ${await res.text()}`);
      throw new Error(`تعذّر إرسال الإشعار للعميل (${res.status})`);
    }
    const now = new Date().toISOString();
    await supabaseAdmin.from("orders").update({ status: data.status, decided_at: now }).eq("id", data.id);
    if (o.customer_id) {
      await supabaseAdmin.from("messages").insert({ customer_id: o.customer_id, direction: "agent", kind: "text", text });
      await supabaseAdmin.from("customers").update({ last_message: text, last_at: now }).eq("id", o.customer_id);
    }
    return { ok: true };
  });

export const listTickets = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ pw: z.string() }).parse(d))
  .handler(async ({ data }) => {
    check(data.pw);
    const { supabaseAdmin } = await import("@/lib/db.server");
    const { data: rows, error } = await supabaseAdmin
      .from("support_tickets").select("*").order("created_at", { ascending: false }).limit(500);
    if (error) throw new Error(error.message);
    return rows;
  });

const TICKET_TEXT: Record<string, string> = {
  in_progress: "أكتس لاستيراد أنظمة الطاقة\nتذكرة الدعم {no}: استلم مهندس الصيانة بلاغك وجاري المتابعة.",
  resolved: "أكتس لاستيراد أنظمة الطاقة\nتذكرة الدعم {no}: تم حل المشكلة وإغلاق التذكرة. شكراً لثقتك.",
};

export const updateTicket = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    pw: z.string(), id: z.string().uuid(),
    status: z.enum(["open", "in_progress", "resolved"]),
    assigned_to: z.string().max(120).optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    check(data.pw);
    const { supabaseAdmin } = await import("@/lib/db.server");
    const { data: t, error } = await supabaseAdmin.from("support_tickets").select("*").eq("id", data.id).single();
    if (error || !t) throw new Error("التذكرة غير موجودة");
    const tpl = TICKET_TEXT[data.status];
    if (tpl && t.status !== data.status) {
      const text = tpl.replace("{no}", t.ticket_no);
      const res = await fetch(`${N8N_URL}/webhook/actes-send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-bot-secret": process.env["BOT_INGEST_SECRET"] ?? "" },
        body: JSON.stringify({ phone: t.phone, text }),
      });
      if (!res.ok) {
        console.error(`n8n send failed [${res.status}]: ${await res.text()}`);
        throw new Error(`تعذّر إرسال الإشعار للعميل (${res.status})`);
      }
      if (t.customer_id) {
        await supabaseAdmin.from("messages").insert({ customer_id: t.customer_id, direction: "agent", kind: "text", text });
      }
    }
    await supabaseAdmin.from("support_tickets").update({
      status: data.status,
      assigned_to: data.assigned_to ?? t.assigned_to,
      resolved_at: data.status === "resolved" ? new Date().toISOString() : null,
    }).eq("id", data.id);
    return { ok: true };
  });

// Stage 3: draft a technical inquiry for the manufacturer (staff only, never sent to the customer).
export const draftVendorQuery = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ pw: z.string(), id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    check(data.pw);
    const { supabaseAdmin } = await import("@/lib/db.server");
    const { data: t } = await supabaseAdmin.from("support_tickets").select("*").eq("id", data.id).single();
    if (!t) throw new Error("التذكرة غير موجودة");
    const { askAI } = await import("@/lib/ai.server");
    const text = await askAI({
      instructions: "You are a solar service engineer at ACTES (Yemen distributor). Write a concise, professional technical support inquiry email in English to the manufacturer's after-sales team about this field case. Include: subject line, product/model, fault code or symptom, steps already tried, and specific questions. Do not include customer name or phone. Plain text, under 1200 characters.",
      input: `Ticket ${t.ticket_no}\nDevice: ${t.device ?? ""}\nIssue type: ${t.issue_type ?? ""}\nDescription (Arabic): ${t.description ?? ""}`,
    });
    return { text };
  });

// Stage 3: send the final solution to the customer in ACTES' name.
export const replyTicket = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ pw: z.string(), id: z.string().uuid(), text: z.string().min(2).max(3000) }).parse(d))
  .handler(async ({ data }) => {
    check(data.pw);
    const { supabaseAdmin } = await import("@/lib/db.server");
    const { data: t } = await supabaseAdmin.from("support_tickets").select("*").eq("id", data.id).single();
    if (!t) throw new Error("التذكرة غير موجودة");
    const text = `أكتس لاستيراد أنظمة الطاقة\nبخصوص تذكرة الدعم ${t.ticket_no}:\n\n${data.text}`;
    const res = await fetch(`${N8N_URL}/webhook/actes-send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-bot-secret": process.env["BOT_INGEST_SECRET"] ?? "" },
      body: JSON.stringify({ phone: t.phone, text }),
    });
    if (!res.ok) throw new Error(`تعذّر الإرسال للعميل (${res.status})`);
    if (t.customer_id) {
      await supabaseAdmin.from("messages").insert({ customer_id: t.customer_id, direction: "agent", kind: "text", text });
    }
    if (t.status === "open") await supabaseAdmin.from("support_tickets").update({ status: "in_progress" }).eq("id", data.id);
    return { ok: true };
  });

export const listCatalog = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ pw: z.string() }).parse(d))
  .handler(async ({ data }) => {
    check(data.pw);
    const { supabaseAdmin } = await import("@/lib/db.server");
    const { data: rows, error } = await supabaseAdmin.from("catalog_items").select("*").order("sort");
    if (error) throw new Error(error.message);
    return rows;
  });

export const saveCatalogItem = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    pw: z.string(),
    key: z.string().trim().min(1).max(100),
    name: z.string().trim().min(1).max(500),
    price: z.number().nonnegative().nullable(),
    unit: z.string().max(50).nullable(),
    pdf_url: z.string().url().max(1000).or(z.string().regex(/^\/[^\s]*$/).max(1000)).nullable().or(z.literal("").transform(() => null)),
    active: z.boolean(),
    specs: z.array(z.string().max(1000)).max(200).optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    check(data.pw);
    const { supabaseAdmin } = await import("@/lib/db.server");
    const { pw: _pw, key, specs, ...rest } = data;
    const { error } = await supabaseAdmin.from("catalog_items")
      .update({ ...rest, ...(specs ? { specs } : {}), updated_at: new Date().toISOString() }).eq("key", key);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createCatalogItem = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    pw: z.string(),
    name: z.string().trim().min(1).max(500),
    price: z.number().nonnegative(),
    unit: z.string().trim().max(50).nullable(),
    category: z.string().trim().min(1).max(50),
    category_title: z.string().max(100).nullable(),
    specs: z.array(z.string().max(1000)).max(200),
  }).parse(d))
  .handler(async ({ data }) => {
    check(data.pw);
    const { supabaseAdmin } = await import("@/lib/db.server");
    const { data: last } = await supabaseAdmin.from("catalog_items").select("sort").order("sort", { ascending: false }).limit(1).maybeSingle();
    const key = "ITEM_" + Date.now().toString(36).toUpperCase();
    const { pw: _pw, ...rest } = data;
    const { error } = await supabaseAdmin.from("catalog_items").insert({ ...rest, key, kind: "item", active: true, sort: (last?.sort ?? 0) + 1 });
    if (error) throw new Error(error.message);
    return { key };
  });

export const deleteCatalogItem = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ pw: z.string(), key: z.string().min(1).max(100) }).parse(d))
  .handler(async ({ data }) => {
    check(data.pw);
    const { supabaseAdmin } = await import("@/lib/db.server");
    const { error } = await supabaseAdmin.from("catalog_items").delete().eq("key", data.key);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const ruleSchema = z.object({
  scope: z.enum(["all", "res", "com", "custom"]),
  type: z.enum(["all", "res", "com"]),
  match: z.enum(["all", "any"]),
  inv_kw: z.array(z.number()).max(50),
  bat_kwh: z.array(z.number()).max(50),
  panel_keys: z.array(z.string().max(100)).max(20),
  panels_min: z.number().int().nonnegative().nullable(),
  panels_max: z.number().int().nonnegative().nullable(),
  qty_mode: z.enum(["fixed", "per_panels"]),
  qty: z.number().int().min(1).max(10000),
  per: z.number().int().min(1).max(10000),
});

export const saveAutoRules = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ pw: z.string(), key: z.string().min(1).max(100), rules: z.array(ruleSchema).max(20) }).parse(d))
  .handler(async ({ data }) => {
    check(data.pw);
    const { supabaseAdmin } = await import("@/lib/db.server");
    const { error } = await supabaseAdmin.from("catalog_items").update({ auto_rules: data.rules, updated_at: new Date().toISOString() }).eq("key", data.key);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveQuote = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    pw: z.string(),
    customer_id: z.string().uuid().nullable(),
    customer_name: z.string().max(200).nullable(),
    phone: z.string().max(40).nullable(),
    city: z.string().max(100).nullable(),
    notes: z.string().max(2000).nullable(),
    items: z.array(z.object({ key: z.string().max(100), name: z.string().max(500), unit: z.string().max(50).nullable(), price: z.number().nonnegative(), qty: z.number().positive().max(100000), specs: z.array(z.string().max(1000)).max(200) })).min(1).max(200),
  }).parse(d))
  .handler(async ({ data }) => {
    check(data.pw);
    const { supabaseAdmin } = await import("@/lib/db.server");
    const { pw: _pw, ...rest } = data;
    const total = rest.items.reduce((s, i) => s + i.price * i.qty, 0);
    const { data: row, error } = await supabaseAdmin.from("quotes").insert({ ...rest, total }).select("id, quote_no").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listQuotes = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ pw: z.string() }).parse(d))
  .handler(async ({ data }) => {
    check(data.pw);
    const { supabaseAdmin } = await import("@/lib/db.server");
    const { data: rows, error } = await supabaseAdmin.from("quotes").select("*").order("created_at", { ascending: false }).limit(100);
    if (error) throw new Error(error.message);
    return rows;
  });

// ---------- PVsyst / SLD report requests ----------
import { sendBlocker, matchPreset, REPORT_LABEL, type ReportKind } from "@/lib/report-rules";
const Kind = z.enum(["pvsyst", "sld"]);

export const listReportRequests = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ pw: z.string() }).parse(d))
  .handler(async ({ data }) => {
    check(data.pw);
    const { supabaseAdmin } = await import("@/lib/db.server");
    const [r, f] = await Promise.all([
      supabaseAdmin.from("report_requests").select("*").order("created_at", { ascending: false }).limit(500),
      supabaseAdmin.from("preset_reports").select("preset_title,kind,file_name"),
    ]);
    if (r.error) throw new Error(r.error.message);
    if (f.error) throw new Error(f.error.message);
    return { requests: r.data, files: f.data };
  });

export const uploadPresetReport = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ pw: z.string(), preset_title: z.string().min(1).max(300), kind: Kind, file_name: z.string().min(1).max(200), b64: z.string().max(23_000_000) }).parse(d))
  .handler(async ({ data }) => {
    check(data.pw);
    const { supabaseAdmin } = await import("@/lib/db.server");
    const bin = Uint8Array.from(atob(data.b64), (ch) => ch.charCodeAt(0));
    const path = `reports/${data.kind}/${crypto.randomUUID()}.pdf`;
    const up = await supabaseAdmin.storage.from("crm-attachments").upload(path, bin, { contentType: "application/pdf" });
    if (up.error) throw new Error("تعذّر رفع الملف");
    const { error } = await supabaseAdmin.from("preset_reports").upsert({ preset_title: data.preset_title, kind: data.kind, path, file_name: data.file_name, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const openPresetReport = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ pw: z.string(), preset_title: z.string().min(1).max(300), kind: Kind }).parse(d))
  .handler(async ({ data }) => {
    check(data.pw);
    const { supabaseAdmin } = await import("@/lib/db.server");
    const { data: f } = await supabaseAdmin.from("preset_reports").select("path").eq("preset_title", data.preset_title).eq("kind", data.kind).maybeSingle();
    if (!f) throw new Error("لا يوجد ملف مرفوع لهذه المنظومة");
    const sig = await supabaseAdmin.storage.from("crm-attachments").createSignedUrl(f.path, 60 * 30);
    if (sig.error || !sig.data) throw new Error("تعذّر فتح الملف");
    return { url: sig.data.signedUrl };
  });

export async function requestFile(supabaseAdmin: any, rq: { id: string; name: string | null; city?: string | null; lat?: number | null; lon?: number | null; tilt?: number | null; azimuth?: string | null; file_path: string | null; file_name: string | null; kind: string; system_label: string | null }) {
  // Generated reports made before fonts were embedded (no "/v9-" in path) are rebuilt once.
  const stale = !!rq.file_path && rq.file_path.startsWith("reports/requests/") && !rq.file_path.includes("/v9-") && (rq.kind === "sld" || rq.kind === "pvsyst");
  if (rq.file_path && !stale) return { path: rq.file_path, file_name: rq.file_name ?? "report.pdf" };
  if (rq.kind === "sld") {
    // Draw the single-line diagram for this customer's own system and keep it with the request.
    const { parseSystem } = await import("@/lib/pvsyst-calc");
    const spec = parseSystem(rq.system_label);
    if (spec) {
      const { buildSld } = await import("@/lib/sld-pdf");
      const name = (rq.name ?? "").trim() || "Customer";
      const { reportItems } = await import("@/lib/report-items");
      const bin = await buildSld(name, spec, new Date(), reportItems(rq.system_label));
      const path = `reports/requests/${rq.id}/v9-${crypto.randomUUID()}.pdf`;
      const file_name = `${name.replace(/[\\/:*?"<>|]/g, "")}_SLD.pdf`;
      const up = await supabaseAdmin.storage.from("crm-attachments").upload(path, bin, { contentType: "application/pdf" });
      if (up.error) throw new Error("تعذّر حفظ المخطط");
      await supabaseAdmin.from("report_requests").update({ file_path: path, file_name }).eq("id", rq.id);
      return { path, file_name };
    }
  }
  if (rq.kind === "pvsyst") {
    // Build the simulation report for this customer's own system and keep it with the request.
    const { parseSystem } = await import("@/lib/pvsyst-calc");
    const spec = parseSystem(rq.system_label);
    if (spec) {
      const { buildReport } = await import("@/lib/pvsyst-pdf");
      const { CITIES, SANAA_SITE, parseOrientation } = await import("@/lib/pvsyst-calc");
      const name = (rq.name ?? "").trim() || "Customer";
      const fromText = parseOrientation(rq.system_label);
      const dir = (["s", "n", "e", "w", "ns", "ew"].includes(rq.azimuth ?? "") ? rq.azimuth : fromText.dir ?? "s") as "s";
      const tilt = rq.tilt ?? fromText.tilt;
      const city = CITIES[rq.city ?? ""];
      const loc = rq.lat != null && rq.lon != null ? { name: city?.name ?? "Site", lat: rq.lat, lon: rq.lon } : city ?? CITIES["sanaa"]!;
      let site = SANAA_SITE;
      try {
        const { fetchSite } = await import("@/lib/pvgis.server");
        site = await fetchSite({ ...loc, tilt: tilt ?? null, dir });
      } catch (e) { console.error("PVGIS failed, using Sanaa reference data", e); }
      const { reportItems } = await import("@/lib/report-items");
      const loads = Array.isArray((rq as { loads?: unknown }).loads) ? ((rq as unknown as { loads: number[] }).loads) : null;
      const bin = await buildReport(name, { ...spec, loads }, site, new Date(), reportItems(rq.system_label));
      const path = `reports/requests/${rq.id}/v9-${crypto.randomUUID()}.pdf`;
      const file_name = `${name.replace(/[\\/:*?"<>|]/g, "")}_PVsyst.pdf`;
      const up = await supabaseAdmin.storage.from("crm-attachments").upload(path, bin, { contentType: "application/pdf" });
      if (up.error) throw new Error("تعذّر حفظ التقرير");
      await supabaseAdmin.from("report_requests").update({ file_path: path, file_name }).eq("id", rq.id);
      return { path, file_name };
    }
  }
  const { data: all } = await supabaseAdmin.from("preset_reports").select("preset_title,path,file_name").eq("kind", rq.kind);
  const rows = (all ?? []) as { preset_title: string; path: string; file_name: string }[];
  const t = matchPreset(rq.system_label, rows.map((r) => r.preset_title));
  const f = rows.find((r) => r.preset_title === t);
  return f ? { path: f.path, file_name: f.file_name } : null;
}

/** Builds a new request's report right away so staff open it instantly; failures fall back to building on open. */
export async function prewarmReport(supabaseAdmin: any, rq: any) {
  try { if (rq) await requestFile(supabaseAdmin, rq); } catch (e) { console.error("report prewarm failed", e); }
}

export const uploadRequestReport = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ pw: z.string(), id: z.string().uuid(), file_name: z.string().min(1).max(200), b64: z.string().max(23_000_000) }).parse(d))
  .handler(async ({ data }) => {
    check(data.pw);
    const { supabaseAdmin } = await import("@/lib/db.server");
    const bin = Uint8Array.from(atob(data.b64), (ch) => ch.charCodeAt(0));
    const path = `reports/requests/${data.id}/${crypto.randomUUID()}.pdf`;
    const up = await supabaseAdmin.storage.from("crm-attachments").upload(path, bin, { contentType: "application/pdf" });
    if (up.error) throw new Error("تعذّر رفع الملف");
    const { error } = await supabaseAdmin.from("report_requests").update({ file_path: path, file_name: data.file_name }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const openRequestReport = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ pw: z.string(), id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    check(data.pw);
    const { supabaseAdmin } = await import("@/lib/db.server");
    const { data: rq } = await supabaseAdmin.from("report_requests").select("*").eq("id", data.id).single();
    if (!rq) throw new Error("الطلب غير موجود");
    const f = await requestFile(supabaseAdmin, rq);
    if (!f) throw new Error("لا يوجد تقرير لهذا الطلب");
    const sig = await supabaseAdmin.storage.from("crm-attachments").createSignedUrl(f.path, 60 * 30);
    if (sig.error || !sig.data) throw new Error("تعذّر فتح الملف");
    return { url: sig.data.signedUrl };
  });

export const sendReportRequest = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ pw: z.string(), id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    check(data.pw);
    const { supabaseAdmin } = await import("@/lib/db.server");
    const { data: rq } = await supabaseAdmin.from("report_requests").select("*").eq("id", data.id).single();
    if (!rq) throw new Error("الطلب غير موجود");
    const kind = rq.kind as ReportKind;
    const f = await requestFile(supabaseAdmin, rq);
    const block = sendBlocker(rq, f);
    if (block || !f) throw new Error(block ?? "");
    const sig = await supabaseAdmin.storage.from("crm-attachments").createSignedUrl(f.path, 60 * 60 * 24 * 365);
    if (sig.error || !sig.data) throw new Error("تعذّر إنشاء رابط الملف");
    const url = sig.data.signedUrl;
    const text = `أكتس لاستيراد أنظمة الطاقة\n${REPORT_LABEL[kind]} لمنظومتك`;
    const res = await fetch(`${N8N_URL}/webhook/actes-send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-bot-secret": process.env["BOT_INGEST_SECRET"] ?? "" },
      body: JSON.stringify({ phone: rq.phone, text, media_url: url, media_type: "pdf", file_name: f.file_name }),
    });
    if (!res.ok) {
      console.error(`n8n report send failed [${res.status}]: ${await res.text()}`);
      throw new Error(`تعذّر الإرسال (${res.status})`);
    }
    const now = new Date().toISOString();
    await supabaseAdmin.from("report_requests").update({ status: "sent", sent_at: now }).eq("id", data.id);
    if (rq.customer_id) {
      await supabaseAdmin.from("messages").insert({ customer_id: rq.customer_id, direction: "agent", kind: "pdf", text, media_url: url, mime: "application/pdf", file_name: f.file_name });
      await supabaseAdmin.from("customers").update({ last_message: text, last_at: now }).eq("id", rq.customer_id);
    }
    return { ok: true };
  });

export const deleteReportRequest = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ pw: z.string(), id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    check(data.pw);
    const { supabaseAdmin } = await import("@/lib/db.server");
    const { data: rq } = await supabaseAdmin.from("report_requests").select("file_path").eq("id", data.id).maybeSingle();
    if (rq?.file_path) await supabaseAdmin.storage.from("crm-attachments").remove([rq.file_path]);
    const { error } = await supabaseAdmin.from("report_requests").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// kWh price (YER) shared by the app quotes and the WhatsApp bot (served via /api/public/bot-catalog).
export const getKwhPrice = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ pw: z.string() }).parse(d))
  .handler(async ({ data }) => {
    check(data.pw);
    const { supabaseAdmin } = await import("@/lib/db.server");
    const { data: r } = await supabaseAdmin.from("app_settings").select("value").eq("key", "kwh_price").maybeSingle();
    return { kwh_price: r ? Number(r.value) : 290 };
  });

export const setKwhPrice = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ pw: z.string(), price: z.number().positive().max(100000) }).parse(d))
  .handler(async ({ data }) => {
    check(data.pw);
    const { supabaseAdmin } = await import("@/lib/db.server");
    const { error } = await supabaseAdmin.from("app_settings").upsert({ key: "kwh_price", value: data.price, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { kwh_price: data.price };
  });

// Bot texts editor ("المسار"): the list of texts comes from src/lib/bot-texts.json; the DB only stores edits.
export const listBotTexts = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ pw: z.string() }).parse(d))
  .handler(async ({ data }) => {
    check(data.pw);
    const { supabaseAdmin } = await import("@/lib/db.server");
    const { data: rows, error } = await supabaseAdmin.from("bot_texts").select("key,value,desc_value,updated_at");
    if (error) throw new Error(error.message);
    return rows;
  });

export const saveBotText = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    pw: z.string(), key: z.string().max(40),
    value: z.string().max(1000).nullable(), desc_value: z.string().max(72).nullable(),
  }).parse(d))
  .handler(async ({ data }) => {
    check(data.pw);
    const all = (await import("@/lib/bot-texts.json")).default as { k: string; m: string; t: string; s: string; o: string; b?: string; d?: string }[];
    const row = all.find((r) => r.k === data.key);
    if (!row) throw new Error("نص غير معروف");
    if (row.t === "b" && data.value && data.value.length > 20) throw new Error("اسم الزر لازم 20 حرف أو أقل");
    const { supabaseAdmin } = await import("@/lib/db.server");
    if (data.value == null && data.desc_value == null) {
      const { error } = await supabaseAdmin.from("bot_texts").delete().eq("key", data.key);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const { error } = await supabaseAdmin.from("bot_texts").upsert({
      key: row.k, msg_key: row.m, kind: row.t === "b" ? "button" : "text", section: row.s, original: row.o,
      btn_id: row.b ?? null, btn_desc: row.d ?? null, value: data.value, desc_value: data.desc_value, updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Per-step button delete: row key "<button key>@<step id>", place = JSON scope the bot matches
// (original message fragments of that step + its other buttons), so the button disappears only there.
export const saveBotButtonDelete = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    pw: z.string(), key: z.string().max(40), scoped: z.string().max(60), on: z.boolean(),
    msg: z.array(z.string().max(40)).max(20), sibs: z.array(z.string().max(40)).max(20), fixed: z.array(z.string().max(60)).max(10),
  }).parse(d))
  .handler(async ({ data }) => {
    check(data.pw);
    const all = (await import("@/lib/bot-texts.json")).default as { k: string; m: string; t: string; s: string; o: string; b?: string }[];
    const by = new Map(all.map((r) => [r.k, r]));
    const row = by.get(data.key);
    if (!row || row.t !== "b" || !data.scoped.startsWith(data.key + "@")) throw new Error("زر غير معروف");
    const { supabaseAdmin } = await import("@/lib/db.server");
    if (!data.on) {
      const { error } = await supabaseAdmin.from("bot_texts").delete().eq("key", data.scoped);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const scope = {
      msg: data.msg.map((k) => by.get(k)?.o.trim()).filter((x): x is string => !!x),
      sibs: [...data.sibs.map((k) => by.get(k)).filter((r) => r?.t === "b").map((r) => r!.b ?? r!.o), ...data.fixed],
    };
    const { error } = await supabaseAdmin.from("bot_texts").upsert({
      key: data.scoped, msg_key: row.m, kind: "button", section: row.s, original: row.o,
      btn_id: row.b ?? null, value: "__DEL__", place: JSON.stringify(scope), updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Added steps ("المسار" phase 2): a custom message with buttons/list shown after a bot button is pressed.
const stepOption = z.object({
  title: z.string().trim().min(1).max(24), desc: z.string().max(72).optional(),
  goto: z.object({ type: z.enum(["continue", "step", "button"]), value: z.string().max(100).default("") }),
});
const stepInput = z.object({
  pw: z.string(), id: z.string().max(20).optional(),
  trigger_key: z.string().max(40).nullable(), section: z.string().max(100).nullable(),
  body: z.string().trim().min(1).max(1000), kind: z.enum(["buttons", "list"]),
  list_button: z.string().max(20).nullable(), options: z.array(stepOption).min(1).max(10), active: z.boolean(),
}).refine((s) => s.kind === "list" || s.options.length <= 3, "الأزرار حتى 3 فقط — استخدم قائمة لأكثر")
  .refine((s) => s.kind === "list" || s.options.every((o) => o.title.length <= 20), "اسم الزر لازم 20 حرف أو أقل");

export const listBotSteps = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ pw: z.string() }).parse(d))
  .handler(async ({ data }) => {
    check(data.pw);
    const { supabaseAdmin } = await import("@/lib/db.server");
    const { data: rows, error } = await supabaseAdmin.from("bot_steps").select("*").order("created_at");
    if (error) throw new Error(error.message);
    return rows;
  });

export const saveBotStep = createServerFn({ method: "POST" })
  .inputValidator((d) => stepInput.parse(d))
  .handler(async ({ data }) => {
    check(data.pw);
    const { pw: _pw, id, ...rest } = data;
    let trigger_id: string | null = null, trigger_title: string | null = null;
    if (rest.trigger_key) {
      const all = (await import("@/lib/bot-texts.json")).default as { k: string; t: string; o: string; b?: string }[];
      const b = all.find((r) => r.k === rest.trigger_key && r.t === "b");
      if (!b) throw new Error("الزر غير موجود");
      trigger_id = b.b ?? null; trigger_title = b.o;
    }
    const { supabaseAdmin } = await import("@/lib/db.server");
    const row = { ...rest, trigger_id, trigger_title, updated_at: new Date().toISOString() };
    const { error } = id
      ? await supabaseAdmin.from("bot_steps").update(row).eq("id", id)
      : await supabaseAdmin.from("bot_steps").insert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteBotStep = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ pw: z.string(), id: z.string().max(20) }).parse(d))
  .handler(async ({ data }) => {
    check(data.pw);
    const { supabaseAdmin } = await import("@/lib/db.server");
    const { error } = await supabaseAdmin.from("bot_steps").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Connection settings: frontend (app) URL. Installed PWAs on the old host redirect to it on start.
async function readFrontendUrl() {
  const { supabaseAdmin } = await import("@/lib/db.server");
  const { data } = await supabaseAdmin.from("app_settings").select("text_value").eq("key", "frontend_url").maybeSingle();
  const n = data?.text_value ? normalizeServerUrl(data.text_value) : null;
  return n?.ok ? n.url : DEFAULT_FRONTEND_URL;
}

async function probe(url: string) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    return r.ok ? { ok: true, message: "الاتصال ناجح" } : { ok: false, message: `الرابط رد بخطأ (${r.status})` };
  } catch { return { ok: false, message: "تعذّر الوصول إلى الرابط" }; }
}

// Public: returns only the frontend URL so installed apps can follow a move.
export const getFrontendUrl = createServerFn({ method: "GET" }).handler(async () => ({ url: await readFrontendUrl(), defaultUrl: DEFAULT_FRONTEND_URL }));

export const testFrontendUrl = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ pw: z.string(), url: z.string().max(300) }).parse(d))
  .handler(async ({ data }) => {
    check(data.pw);
    const n = normalizeServerUrl(data.url);
    return n.ok ? probe(n.url) : { ok: false, message: n.error };
  });

export const saveFrontendUrl = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ pw: z.string(), url: z.string().max(300), reset: z.boolean().optional() }).parse(d))
  .handler(async ({ data }) => {
    check(data.pw);
    const n = normalizeServerUrl(data.reset ? DEFAULT_FRONTEND_URL : data.url);
    if (!n.ok) return { ok: false, message: n.error };
    const t = await probe(n.url);
    if (!t.ok) return { ok: false, message: `${t.message} — بقي الرابط السابق كما هو`, url: await readFrontendUrl() };
    const { supabaseAdmin } = await import("@/lib/db.server");
    const { error } = await supabaseAdmin.from("app_settings").upsert({ key: "frontend_url", value: 0, text_value: n.url, updated_at: new Date().toISOString() });
    if (error) return { ok: false, message: "تعذّر الحفظ — بقي الرابط السابق", url: await readFrontendUrl() };
    return { ok: true, message: "تم الحفظ — كل الأجهزة المفتوحة تتحول خلال دقيقة", url: n.url };
  });

export const openCustomerChat = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ pw: z.string(), phone: z.string().min(3).max(32), name: z.string().max(120).nullable() }).parse(d))
  .handler(async ({ data }) => {
    check(data.pw);
    let phone = data.phone.replace(/\D/g, "").replace(/^00/, "");
    if (/^0?7\d{8}$/.test(phone)) phone = "967" + phone.replace(/^0/, "");
    const { supabaseAdmin } = await import("@/lib/db.server");
    const tail = phone.slice(-9);
    const { data: found } = await supabaseAdmin.from("customers").select("id").like("phone", `%${tail}`).limit(1);
    if (found?.[0]) { await reviveChat(found[0].id as string); return { id: found[0].id as string }; }
    const { data: row, error } = await supabaseAdmin.from("customers").insert({ phone, name: data.name } as never).select("id").single();
    if (error) throw new Error(error.message);
    return { id: (row as { id: string }).id };
  });

// Editable sizing equations ("المعادلات"), shared with the bot through bot-catalog (FORMULAS).
export const getFormulas = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ pw: z.string() }).parse(d))
  .handler(async ({ data }) => {
    check(data.pw);
    const { mergeFormulas } = await import("@/lib/formulas");
    const { supabaseAdmin } = await import("@/lib/db.server");
    const { data: r } = await supabaseAdmin.from("app_settings").select("text_value").eq("key", "formulas").maybeSingle();
    let v: unknown = null;
    try { v = r?.text_value ? JSON.parse(r.text_value) : null; } catch { v = null; }
    return { formulas: mergeFormulas(v) };
  });

export const saveFormulas = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ pw: z.string(), code: z.string(), formulas: z.record(z.string(), z.unknown()) }).parse(d))
  .handler(async ({ data }) => {
    check(data.pw);
    if (data.code !== flowCode()) throw new Error("رمز غير صحيح");
    const { mergeFormulas } = await import("@/lib/formulas");
    const f = mergeFormulas(data.formulas);
    const { supabaseAdmin } = await import("@/lib/db.server");
    const { error } = await supabaseAdmin.from("app_settings").upsert({ key: "formulas", value: 0, text_value: JSON.stringify(f), updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { formulas: f };
  });

// Bot message header image: stored in crm-attachments, path + version in app_settings key `header_image`.
export const getHeaderImage = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ pw: z.string() }).parse(d))
  .handler(async ({ data }) => {
    check(data.pw);
    const { supabaseAdmin } = await import("@/lib/db.server");
    const { data: r } = await supabaseAdmin.from("app_settings").select("text_value").eq("key", "header_image").maybeSingle();
    let v = "2";
    try { v = String(JSON.parse(r?.text_value ?? "{}").v ?? "2"); } catch { /* default */ }
    return { url: `/api/public/header-image?v=${v}` };
  });

export const saveHeaderImage = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ pw: z.string(), b64: z.string().max(12_000_000), mime: z.enum(["image/jpeg", "image/png"]) }).parse(d))
  .handler(async ({ data }) => {
    check(data.pw);
    const { supabaseAdmin } = await import("@/lib/db.server");
    const bin = Uint8Array.from(atob(data.b64), (ch) => ch.charCodeAt(0));
    const v = String(Date.now());
    const path = `header-image/${v}.${data.mime === "image/png" ? "png" : "jpg"}`;
    const up = await supabaseAdmin.storage.from("crm-attachments").upload(path, bin, { contentType: data.mime });
    if (up.error) throw new Error("تعذّر رفع الصورة");
    const { error } = await supabaseAdmin.from("app_settings").upsert({ key: "header_image", value: 0, text_value: JSON.stringify({ path, v, mime: data.mime }), updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { url: `/api/public/header-image?v=${v}` };
  });
