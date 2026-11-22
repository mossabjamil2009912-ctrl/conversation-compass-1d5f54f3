<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->


- Bot items, prices and datasheet PDFs live only in `public.catalog_items`, edited from the dashboard and served to n8n via `/api/public/bot-catalog` — one source of truth so quotes and catalogs never diverge.
- PVsyst/SLD files are uploaded once per ready-made system (`preset_reports`, keyed by preset title) and sent by staff from `report_requests`; the bot only files a request, so customers never get an unreviewed report.
- The kWh price lives in `public.app_settings` (key `kwh_price`), edited from the quote screen and sent to n8n inside `/api/public/bot-catalog` — one value for bot and app.
- Quote system picks in `QuoteBuilder` are a literal port of the bot's resNearest/comInvOptions rules; change both together so they never disagree.
- MC4 sets in 8–20 kW systems come from the `mc4_connector` auto rule (per_panels = panels per string); the bot reads the same `per` in its `ACTES_MC4_PER_STRING` block — presets hold no fixed MC4 line.
- Auto-add item rules live in `catalog_items.auto_rules` and are evaluated by `src/lib/auto-rules.ts` in QuoteBuilder and by its port `ACTES_AUTO_ADD` in the n8n State Machine (fed via `AUTO_RULES` in bot-catalog) — change both together so app and bot quotes match.
- Offline-first: every screen's data query must be wrapped in `offlineQuery` from `src/lib/offline-cache.ts` (it copies each result to the device and reads it back when the internet is missing), and the start page must stay in the service worker's `pages` cache via `saveShell()` in `src/lib/offline-shell.ts` — new screens have to follow the same pattern so the installed desktop app still opens and shows data with no internet.
- PVsyst reports are generated per request by `src/lib/pvsyst-pdf.ts` from numbers in `src/lib/pvsyst-calc.ts` (site weather from PVGIS for the customer's city, tilt and direction; Sanaa reference as fallback) and cached on the request's `file_path`.
- SLD diagrams are generated per request by `src/lib/sld-pdf.ts` from sizing in `src/lib/sld-calc.ts` and cached on the request's `file_path` — no uploaded per-system files needed.
- Bot text editing ("المسار" screen): the list of editable texts/buttons is harvested from the n8n State Machine into `src/lib/bot-texts.json`; `public.bot_texts` stores only edits, sent as `BOT_TEXTS` in bot-catalog and applied by the "ACTES المسار" layer just before State Machine's final return — re-harvest the JSON when bot texts change in n8n, so edits keep matching.
- n8n base URL is the fixed constant `N8N_URL` in `src/lib/server-url-rules.ts` (not editable). The frontend URL lives in app_settings key `frontend_url` (`text_value`); `FrontendRedirect` sends installed PWAs on the default published host there — keep the old host published so old installs follow a move.
- Forced update: each build gets `__APP_VERSION__` (vite define), served by `/api/public/app-version`; `UpdateGate` in __root blocks the app until the service worker pulls the new build (skipped offline, one attempt per version per session).
- The app is hosted only on its Lovable published URL (no Vercel); old hosts are listed in `LEGACY_FRONTEND_HOSTS` so `FrontendRedirect` moves installed copies opened there to the current frontend URL.
- Day/night usage choice (bot step `day_night`, stored as `|N30/N50/N70` suffix on session `night_hours`) shifts the recommended system by battery; `tiersDayNight` in QuoteBuilder is its port — change both together.
- ACTS platform lives at `/acts` in this project (public, phone-only, no customer accounts); its `acts_*` tables are server-only and touched only via `src/lib/acts.functions.ts`, and it is administered from the CRM "ACTS" tab — one database, staff mediate all customer↔engineer contact.
- ACTS ratings use a per-request `review_token` link sent by staff once the request is "done"; a DB trigger + unique request_id enforce "only after completion, one per request".
- The ACTS quote flow reuses QuoteBuilder's `tieredOptions`/`tiersDayNight`, so app, CRM and bot recommend the same systems.
- ACTS standalone app (separate Lovable project) talks to the CRM only through `/api/public/acts-bridge` (GET catalog/presets/kWh, POST {action,data} wrapping the public functions in `src/lib/acts.functions.ts`) — so both apps share one logic and database.
- Android (Capacitor) app updates are manual only: `src/lib/manual-update.ts` reads `{service-url}/app-updates/latest.json` (built by `scripts/package-update.mjs`) with `autoUpdate: false`, so the installed local bundle keeps working offline.
- Daily GitHub backup = two managed schedules on `/api/public/jobs/github-backup` (body `group: chat|other`), each writing its tables as one Git-data commit — the scheduler cancels requests after a few seconds, so per-file commits got cut off.
- The n8n bot must call only the current CRM host (no fallback to old project hosts): an old host still answers with its own stale data, so the bot silently used old items/prices/texts.
- Sizing equations (days, sun hours, battery DoD, night %, residential ranges, DC box/AC/cable/MC4 values) live in app_settings key `formulas` via `src/lib/formulas.ts`, edited in the hidden "المعادلات" screen (hold the gear 3 s + code), sent to n8n as `FORMULAS` in bot-catalog and read by the State Machine's `ACTES_FORMULAS` block — one set of values for app and bot.
- Equation-driven items (strings by Voc, DC boxes, AC/combiner panel, cable, MC4) are computed by `applyEquations` in `src/lib/formulas.ts` and its port `ACTES_EQUATIONS` in the n8n State Machine (runs after ACTES_AUTO_ADD) — change both together so app and bot quotes match.
- 8–125 kW quotes are sized by `src/lib/sizing.ts` (presets = accessory templates; HV uses `vmaxHV` + `hvAccessories`); bot ports `ACTES_SIZING`/`ACTES_EQUATIONS` — change together.
- `formulas.mode` (eq|ranges) switches 8–125 kW sizing (QuoteBuilder + bot `szStart`); ranges-mode `comRanges` (kW-phase-panels) override `dailyProduction`, bot port `ACTES_COM_RANGES` — change together.
- `orders_legacy`: unused old orders table, kept for its rows.
- `formulas.presetItems` (title → [key, qty]) overrides preset items in `loadPreset` — one stored edit, originals in code.
- HV storage choice: `src/lib/storage.ts` ↔ bot `ACTES_STORAGE_*` — change together.
