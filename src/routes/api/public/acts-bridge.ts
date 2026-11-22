import { createFileRoute } from "@tanstack/react-router";
import * as A from "@/lib/acts.functions";

// Bridge for the standalone ACTS app (separate Lovable project): same public actions as /acts, over CORS.
// Only public (no-password) ACTS actions are exposed; admin stays inside the CRM.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Origin",
  "Access-Control-Max-Age": "86400",
};
const json = (b: unknown, status = 200) => Response.json(b, { status, headers: CORS });

const ACTIONS: Record<string, (data: any) => Promise<unknown>> = {
  quoteRequest: (data) => A.actsQuoteRequest({ data }),
  listEngineers: () => A.actsListEngineers(),
  getEngineer: (data) => A.actsGetEngineer({ data }),
  upload: (data) => A.actsUpload({ data }),
  register: (data) => A.actsRegister({ data }),
  serviceRequest: (data) => A.actsServiceRequest({ data }),
  reviewInfo: (data) => A.actsReviewInfo({ data }),
  submitReview: (data) => A.actsSubmitReview({ data }),
  reportReview: (data) => A.actsReportReview({ data }),
  reportRequest: (data) => A.actsReportRequest({ data }),
};

export const Route = createFileRoute("/api/public/acts-bridge")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      // Catalog for the quote flow: kWh price, priced items and ready-made systems (no customer data).
      GET: async () => {
        try {
          const { supabaseAdmin } = await import("@/lib/db.server");
          const { BOT_PRESETS } = await import("@/lib/bot-presets");
          const [{ data: items }, { data: st }] = await Promise.all([
            supabaseAdmin.from("catalog_items").select("key,name,unit,price,category,label,specs,sort,kind").eq("active", true).neq("kind", "datasheet").order("sort"),
            supabaseAdmin.from("app_settings").select("value").eq("key", "kwh_price").maybeSingle(),
          ]);
          return json({ kwh_price: st ? Number(st.value) : 290, items: items ?? [], presets: BOT_PRESETS, updated_at: new Date().toISOString() });
        } catch (e) {
          return json({ error: (e as Error).message }, 500);
        }
      },
      POST: async ({ request }) => {
        let body: { action?: string; data?: unknown };
        try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
        const fn = body.action && ACTIONS[body.action];
        if (!fn) return json({ error: "Unknown action" }, 400);
        try {
          return json({ ok: true, result: await fn(body.data ?? {}) });
        } catch (e) {
          return json({ ok: false, error: (e as Error).message }, 400);
        }
      },
    },
  },
});
