import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";

// Short in-memory cache: the bot asks often, data changes rarely (edits reach the bot within ~1 min).
let CACHE: { at: number; origin: string; body: string } | null = null;
const CACHE_MS = 60_000;

// Single source of truth for the WhatsApp bot: items, prices and datasheet PDF links managed in the dashboard.
export const Route = createFileRoute("/api/public/bot-catalog")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const got = Buffer.from(request.headers.get("x-bot-secret") ?? "");
        const exp = Buffer.from(process.env["BOT_INGEST_SECRET"] ?? "");
        if (!exp.length || got.length !== exp.length || !timingSafeEqual(got, exp)) {
          return new Response("Unauthorized", { status: 401 });
        }
        const origin0 = new URL(request.url).origin;
        if (CACHE && CACHE.origin === origin0 && Date.now() - CACHE.at < CACHE_MS) {
          return new Response(CACHE.body, { headers: { "content-type": "application/json" } });
        }
        const { supabaseAdmin } = await import("@/lib/db.server");
        // All six reads run in parallel so the bot waits for the slowest one, not their sum.
        const [cat, stR, frR, btR, stepsR, hiR] = await Promise.all([
          supabaseAdmin.from("catalog_items").select("*").eq("active", true).order("sort"),
          supabaseAdmin.from("app_settings").select("value").eq("key", "kwh_price").maybeSingle(),
          supabaseAdmin.from("app_settings").select("text_value").eq("key", "formulas").maybeSingle(),
          supabaseAdmin.from("bot_texts").select("key,kind,original,value,btn_id,desc_value,place"),
          supabaseAdmin.from("bot_steps").select("id,trigger_id,trigger_title,body,kind,list_button,options").eq("active", true),
          supabaseAdmin.from("app_settings").select("text_value").eq("key", "header_image").maybeSingle(),
        ]);
        const { data, error } = cat;
        if (error) return new Response(error.message, { status: 500 });
        const prices: Record<string, number> = {};
        const items: Record<string, unknown> = {};
        const autoRules: Record<string, unknown> = {};
        const files: Record<string, { filename: string | null; caption: string; link: string }> = {};
        // Datasheets live in the repo under /datasheets; give the bot an absolute link on whatever domain serves this app.
        const origin = new URL(request.url).origin;
        for (const r of data) {
          if (r.kind === "datasheet") {
            const link = r.pdf_url?.startsWith("/") ? origin + r.pdf_url : r.pdf_url;
            if (link) files[r.key.replace(/^pdf:/, "")] = { filename: r.label, caption: "📄 المواصفات الفنية: " + r.name, link };
          } else {
            if (r.price != null) prices[r.key] = Number(r.price);
            if (Array.isArray(r.auto_rules) && r.auto_rules.length) autoRules[r.key] = r.auto_rules;
            items[r.key] = { name: r.name, unit: r.unit, price: r.price == null ? null : Number(r.price), category: r.category, label: r.label, specs: r.specs };
          }
        }
        const st = stR.data;
        const kwh_price = st ? Number(st.value) : 290;
        const { mergeFormulas } = await import("@/lib/formulas");
        const fr = frR.data;
        let fv: unknown = null;
        try { fv = fr?.text_value ? JSON.parse(fr.text_value) : null; } catch { fv = null; }
        const FORMULAS = mergeFormulas(fv);
        // Edited bot texts from the "المسار" screen: TEXT = [original fragment, new], BTN = [button id, original title, new title, new desc].
        const bt = btR.data;
        const BOT_TEXTS = { TEXT: [] as [string, string][], BTN: [] as [string, string, string | null, string | null][], DEL: [] as [string, string, { msg: string[]; sibs: string[] }][] };
        for (const r of bt ?? []) {
          // Per-step deletes: [button id, original title, scope] — the bot drops the button only in matching messages.
          if (r.kind === "button" && r.key.includes("@")) { try { BOT_TEXTS.DEL.push([r.btn_id ?? "", r.original, JSON.parse(r.place ?? "{}")]); } catch { /* skip bad scope */ } continue; }
          if (r.kind === "button") BOT_TEXTS.BTN.push([r.btn_id ?? "", r.original, r.value, r.desc_value]);
          else if (r.value != null) BOT_TEXTS.TEXT.push([r.original, r.value === "__DEL__" ? "" : r.value]); // deleted step text is dropped
        }
        BOT_TEXTS.TEXT.sort((a, b) => b[0].length - a[0].length);
        // Added steps: shown when the customer presses trigger_id (title matched against original or edited title).
        const steps = stepsR.data;
        const BOT_STEPS = (steps ?? []).map((s) => {
          const edited = BOT_TEXTS.BTN.find((b) => b[0] === s.trigger_id && b[1] === s.trigger_title)?.[2];
          return { ...s, trigger_titles: [s.trigger_title, edited].filter(Boolean) };
        });
        const hi = hiR.data;
        let hv = "2";
        try { hv = String(JSON.parse(hi?.text_value ?? "{}").v ?? "2"); } catch { hv = "2"; }
        const HEADER_IMAGE_URL = `${origin}/api/public/header-image?v=${hv}`;
        const body = JSON.stringify({ HEADER_IMAGE_URL, settings: { kwh_price }, KWH_PRICE: kwh_price, updated_at: new Date().toISOString(), ITEM_PRICES: prices, ITEMS: items, CATALOG_FILES: files, AUTO_RULES: autoRules, BOT_TEXTS, BOT_STEPS, FORMULAS });
        CACHE = { at: Date.now(), origin, body };
        return new Response(body, { headers: { "content-type": "application/json" } });
      },
    },
  },
});
