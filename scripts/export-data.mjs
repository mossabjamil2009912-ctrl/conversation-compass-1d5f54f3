// Exports every app table to data/backup/<table>.json so the GitHub repo holds a full restorable snapshot.
// Run: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... bun scripts/export-data.mjs
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "fs";
const T = ["app_settings","bot_texts","bot_steps","catalog_items","catalog_categories","catalogs","catalog_profiles","preset_reports","customers","messages","quotes","orders","orders_legacy","support_tickets","report_requests","notifications","bot_button_locks","acts_engineers","acts_service_requests","acts_reviews","acts_review_reports"];
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(process.env.SUPABASE_URL, key, { auth: { persistSession: false }, global: { fetch: (i, o = {}) => { const h = new Headers(o.headers); if (key.startsWith("sb_")) h.delete("Authorization"); h.set("apikey", key); return fetch(i, { ...o, headers: h }); } } });
mkdirSync("data/backup", { recursive: true });
const summary = {};
for (const t of T) {
  const rows = [];
  for (let f = 0; ; f += 1000) {
    const { data, error } = await sb.from(t).select("*").range(f, f + 999);
    if (error) { console.error(t, error.message); break; }
    rows.push(...data); if (data.length < 1000) break;
  }
  writeFileSync(`data/backup/${t}.json`, JSON.stringify(rows, null, 1));
  summary[t] = rows.length;
}
writeFileSync("data/backup/_summary.json", JSON.stringify({ exported_at: new Date().toISOString(), rows: summary }, null, 1));
console.log(summary);
