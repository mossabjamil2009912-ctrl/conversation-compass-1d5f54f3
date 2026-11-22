// Server-only: the catalog smart assistant. Reads every catalog's short spec sheet plus the
// catalog pages that match the question, and asks the AI for a SHORT, direct answer.
const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

export type Msg = { role: "user" | "assistant"; content: string };
type Prof = { product_type?: string; models?: string[]; summary_en?: string; summary_ar?: string; specs?: { model: string; key_specs: string }[] };
type Hit = { catalog_id: string; title: string; page: number; content: string; score: number };

export function cleanMsgs(d: unknown): Msg[] {
  const list = (d as { messages?: Msg[] } | null)?.messages;
  return (Array.isArray(list) ? list : []).slice(-10).map((m) => ({
    role: m?.role === "assistant" ? ("assistant" as const) : ("user" as const),
    content: String(m?.content ?? "").slice(0, 2000),
  })).filter((m) => m.content.trim());
}

const digits = (s: string) =>
  s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
/** Arabic brand spellings -> catalog brand names, so page search finds them. */
export const brandAlias = (s: string) =>
  digits(s)
    .replace(/دا[يى]|ديي|ديا[يى]/g, " Deye ")
    .replace(/سول[يى][سز]/g, " Solis ")
    .replace(/بايلونتك|بيلونتك|بايلون/g, " Pylontech ")
    .replace(/سانتك|صنتك/g, " Suntech ")
    .replace(/هايث[يى]وم|ه[يى]ث[يى]وم/g, " HiTHIUM ")
    .replace(/ل[يى] ?باور/g, " Li Power ")
    .replace(/ف[يى]دوس/g, " FIDUS ")
    .replace(/\s+/g, " ")
    .trim();

const noisy = (t: string) => (t.match(/[\uFB50-\uFEFF]/g)?.length ?? 0) > 20 || (t.match(/\u202B|\u202C/g)?.length ?? 0) > 20;

let cache: { at: number; cats: { id: string; title: string; keywords: string }[]; profs: Map<string, Prof> } | null = null;

async function sb() {
  const { supabaseAdmin } = await import("@/lib/db.server");
  return supabaseAdmin;
}

async function loadAll() {
  if (cache && Date.now() - cache.at < 5 * 60_000) return cache;
  const db = await sb();
  const [c, p] = await Promise.all([
    db.from("catalogs").select("id,title,keywords"),
    db.from("catalog_profiles").select("catalog_id,specs"),
  ]);
  cache = { at: Date.now(), cats: c.data ?? [], profs: new Map((p.data ?? []).map((x) => [x.catalog_id, x.specs as Prof])) };
  return cache;
}

export const SYSTEM_RULES = `أنت مساعد منتجات شركة ACTES للطاقة الشمسية. مهمتك إجابة قصيرة جداً ومباشرة.
قواعد الطول (الأهم):
- أعطِ الإجابة فقط: القيمة أو المعلومة المطلوبة بالضبط ولا شيء غيرها. بدون شرح أو جمل ربط أو مواصفات إضافية لم تُطلب.
- سؤال عن رقم أو مواصفة واحدة ← اذكر القيمة فقط. مثال: "كم قدرة سوليس 50؟" ← "**50kW**". "سعة فيدوس 16؟" ← "**16kWh**".
- إذا كانت العائلة تضم عدة موديلات ولم يحدد المستخدم الموديل: اذكر النطاق في سطر واحد (مثل: من **29.9** إلى **50kW**) ثم اسأله عن الموديل بسؤال قصير.
- ممنوع الجداول والقوائم الطويلة وعناوين ### إلا إذا طلب المستخدم صراحة "تفاصيل" أو "كل المواصفات" أو "مقارنة". عند المقارنة: جدول صغير (حتى 5 صفوف) ثم سطر "**الخلاصة:**".
- لا تذكر تحذيرات السلامة أو ملاحظات إضافية أو نصائح ما لم يُسأل عنها.
- ممنوع أي تحية أو مقدمة أو خاتمة أو إعادة صياغة للسؤال.
- ممنوع تكرار السؤال أو اسم المنتج أو المواصفة المسؤول عنها في بداية الإجابة. لا تكتب "قدرة لوح سنتك هي..." أو "بخصوص سؤالك" أو "بالنسبة لـ". اكتب القيمة مباشرة. مثال: "سعة بطارية فيدوس 16؟" ← "**16kWh**"
قواعد الدقة:
- اعتمد فقط على ملفات المنتجات والمقتطفات المرفقة؛ لا تخترع موديلات أو أرقاماً.
- افهم اللهجة العامية والأخطاء الإملائية ووصف الوظيفة (مثل "جهاز يحول كهرباء الألواح للبيت" = انفرتر، "بطارية 10 كيلو" ≈ 10kWh).
- إذا ذكر السؤال قدرة أو رقماً محدداً (مثل "سوليس 50") أجب عن ذلك الموديل فقط، وتجاهل أي موديل أو سلسلة أخرى حتى لو ذُكرت سابقاً في المحادثة. لا تذكر موديلات أخرى إلا إذا طلب المستخدم مقارنة صراحة.
- لأسئلة المتابعة (بدون ذكر منتج أو رقم جديد) اعتمد على المنتج المذكور سابقاً في المحادثة.
- احتفظ بأسماء الموديلات كما هي. أبرز الأرقام والموديل بالخط العريض.
- لا تستخدم كلمة "بطاقة" للطاقة أو السعة؛ استخدم "بقدرة".
- لا تذكر اسم الكتالوج أو رقم الصفحة أو المصدر.
- إذا لم تجد المعلومة فقل باختصار إنها غير موجودة في الكتالوجات المتاحة، واذكر أقرب منتج إن وُجد.`;

export async function buildMessages(messages: Msg[]) {
  const db = await sb();
  const { cats, profs } = await loadAll();
  const userMsgs = messages.filter((m) => m.role === "user");
  const last = brandAlias(userMsgs[userMsgs.length - 1]?.content ?? "");
  const prev = brandAlias(userMsgs[userMsgs.length - 2]?.content ?? "");
  const parts = last
    .split(/\s+(?:و|مع|vs\.?|or|أو|او|and)\s+|،|,|\s+بين\s+/i)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2)
    .slice(0, 4);

  // Numbers in the question (e.g. "سوليس 50") lock the answer to series whose range covers them.
  const nums = (last.match(/\d+(?:\.\d+)?/g) ?? []).map(Number).filter((n) => n > 0);
  const fits = (title: string) => {
    const m = title.match(/\((\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\)/);
    if (!m || !nums.length) return true;
    const lo = Number(m[1]), hi = Number(m[2]);
    return nums.some((n) => n >= lo && n <= hi);
  };
  const searches = [
    db.rpc("search_catalog_chunks", { q: last, lim: 8 }),
    ...(prev && !nums.length ? [db.rpc("search_catalog_chunks", { q: `${prev} ${last}`, lim: 4 })] : []),
    ...(parts.length > 1 ? parts.map((p) => db.rpc("search_catalog_chunks", { q: p, lim: 4 })) : []),
  ];
  const results = await Promise.all(searches);
  const seen = new Set<string>();
  const hits = results.flatMap((r) => (r.data ?? []) as Hit[]).filter((h) => {
    const k = `${h.catalog_id}-${h.page}-${h.content.slice(0, 40)}`;
    if (seen.has(k) || noisy(h.content) || !fits(h.title)) return false;
    seen.add(k);
    return true;
  }).slice(0, 14);

  const profileText = cats
    .filter((c) => fits(c.title))
    .map((c) => {
      const p = profs.get(c.id);
      if (!p) return `[${c.title}] ${c.keywords}`;
      return `[${c.title}] ${p.product_type ?? ""}\n${(p.specs ?? []).map((s) => `${s.model}: ${s.key_specs}`).join("\n")}`;
    })
    .join("\n\n");
  const pages = hits.map((h) => `[${h.title}]\n${h.content}`).join("\n---\n");
  const lang = /[\u0600-\u06FF]/.test(userMsgs[userMsgs.length - 1]?.content ?? "") ? "ar" : "en";

  const system = `${SYSTEM_RULES}
${lang === "en" ? "Answer in ENGLISH (the user wrote in English), same short style." : "أجب بالعربية."}

ملفات المنتجات (مواصفات كل الموديلات):
${profileText || "(لا توجد كتالوجات بعد)"}

مقتطفات من صفحات الكتالوجات تطابق السؤال:
${pages || "(لا توجد مقتطفات مطابقة)"}`;

  return [{ role: "system" as const, content: system }, ...messages];
}

/** Streams the answer as plain text chunks. */
export async function streamAnswer(messages: Msg[]): Promise<ReadableStream<Uint8Array>> {
  const key = process.env["LOVABLE_API_KEY"];
  const full = await buildMessages(messages);
  const enc = new TextEncoder();
  return new ReadableStream({
    async start(ctrl) {
      try {
        if (!key) throw new Error("LOVABLE_API_KEY missing");
        const res = await fetch(GATEWAY, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
          body: JSON.stringify({ model: MODEL, reasoning_effort: "minimal", stream: true, messages: full }),
        });
        if (!res.ok || !res.body) {
          console.error("catalog assistant", res.status, await res.text().catch(() => ""));
          ctrl.enqueue(enc.encode(res.status === 402 ? "رصيد الذكاء الاصطناعي انتهى مؤقتاً." : "عذراً، حدث خطأ مؤقت. حاول مرة أخرى."));
          ctrl.close();
          return;
        }
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i: number;
          while ((i = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, i).trim();
            buf = buf.slice(i + 1);
            if (!line.startsWith("data:")) continue;
            const d = line.slice(5).trim();
            if (!d || d === "[DONE]") continue;
            try {
              const t = JSON.parse(d)?.choices?.[0]?.delta?.content;
              if (t) ctrl.enqueue(enc.encode(t));
            } catch { /* partial line */ }
          }
        }
      } catch (e) {
        console.error(e);
        ctrl.enqueue(enc.encode("عذراً، حدث خطأ مؤقت. حاول مرة أخرى."));
      }
      ctrl.close();
    },
  });
}

/** Builds (or rebuilds) one catalog's short spec sheet from its page text. */
export async function buildProfile(catalogId: string) {
  const db = await sb();
  const { askAI } = await import("@/lib/ai.server");
  const { data: c } = await db.from("catalogs").select("id,title,keywords,description").eq("id", catalogId).single();
  if (!c) throw new Error("not found");
  const { data: rows } = await db.from("catalog_chunks").select("page,content").eq("catalog_id", catalogId).order("page").limit(400);
  const txt = (rows ?? []).filter((r) => !noisy(r.content)).map((r) => `[p${r.page}] ${r.content}`).join("\n").slice(0, 40000);
  const schema = {
    type: "object", additionalProperties: false, required: ["product_type", "summary_en", "summary_ar", "models", "specs"],
    properties: {
      product_type: { type: "string" }, summary_en: { type: "string" }, summary_ar: { type: "string" },
      models: { type: "array", items: { type: "string" } },
      specs: { type: "array", items: { type: "object", additionalProperties: false, required: ["model", "key_specs"], properties: { model: { type: "string" }, key_specs: { type: "string" } } } },
    },
  };
  const out = await askAI({
    instructions: "Build a product profile ONLY from the given catalog text (never invent). specs: per model one compact line with the key numbers present (power kW, voltage, Ah, nominal/usable kWh, MPPT, max PV input, efficiency, dimensions, weight, IP, cycles, warranty).",
    input: `Catalog title: ${c.title}\nKeywords: ${c.keywords}\nDescription: ${c.description}\n\nCatalog text:\n${txt || "(no text)"}`,
    schema: { name: "profile", schema },
  });
  const p = JSON.parse(out) as Prof;
  await db.from("catalog_profiles").upsert({ catalog_id: catalogId, summary_ar: p.summary_ar ?? "", summary_en: p.summary_en ?? "", specs: p as never, updated_at: new Date().toISOString() });
  cache = null;
}
