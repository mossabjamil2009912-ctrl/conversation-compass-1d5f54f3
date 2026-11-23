// Restores data/backup/<table>.json into a fresh backend (parents first). Upserts, so re-running is safe.
// Run: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... bun scripts/import-data.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
const T = [["app_settings","key"],["bot_texts","key"],["bot_steps","id"],["catalog_categories","id"],["catalog_items","key"],["catalogs","id"],["catalog_profiles","catalog_id"],["preset_reports","preset_title"],["customers","id"],["messages","id"],["quotes","id"],["orders","id"],["orders_legacy","id"],["support_tickets","id"],["report_requests","id"],["notifications","id"],["bot_button_locks","context_id"],["acts_engineers","id"],["acts_service_requests","id"],["acts_reviews","id"],["acts_review_reports","id"]];
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(process.env.SUPABASE_URL, key, { auth: { persistSession: false }, global: { fetch: (i, o = {}) => { const h = new Headers(o.headers); if (key.startsWith("sb_")) h.delete("Authorization"); h.set("apikey", key); return fetch(i, { ...o, headers: h }); } } });
for (const [t, pk] of T) {
  const f = `data/backup/${t}.json`; if (!existsSync(f)) continue;
  const rows = JSON.parse(readFileSync(f, "utf8"));
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await sb.from(t).upsert(rows.slice(i, i + 500), { onConflict: pk });
    if (error) { console.error(t, error.message); break; }
  }
  console.log(t, rows.length);
}
