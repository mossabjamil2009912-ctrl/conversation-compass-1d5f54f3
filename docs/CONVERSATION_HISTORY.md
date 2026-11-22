# ACTES CRM — Conversation history (read after importing to continue)

Summary of every request and decision so far, in order. Rules live in `AGENTS.md`; user preferences in `docs/project-memory/` (copy back to project memory after import).

1. Imported project from GitHub `mossabjamil2009912-ctrl/actes-crm-0158698b`: schema created, data imported, PDFs uploaded, old `orders` table renamed `orders_legacy`.
2. Connected GitHub connector; restored newer data from private repo `actes-crm-data-backup` (73 customers, 3876 messages, 111 catalog items...).
3. n8n at https://n8n.srv1994780.hstgr.cloud linked; workflow `ACTES WhatsApp Bot v35` (id `0XTNcO8mFT8cXsEB`). Bot calls only https://actes-crm.lovable.app with header `x-bot-secret` = BOT_INGEST_SECRET. Copy of the workflow: `docs/n8n/actes-bot-workflow.json` (secret replaced by `__BOT_INGEST_SECRET__`).
4. Equation sizing engine for 8/12/16/20 kW (LV) and 50/80/125 kW (HV): `src/lib/sizing.ts`, ported to bot as `ACTES_SIZING` (parity test: 0 mismatches). Editable values: panelW 720, dcRatio 1.3, lvMaxKw 40, maxInverters 5, batKwh 16 (1.3 and 40 provisional).
5. Battery night tolerance: shortfall ≤ 1 kWh does NOT add a battery (`batTol`, app + bot `ACTES_BAT_TOL`).
6. Equations screen (hold gear 3 s, code 2027): tabs residential (1.6/6.2 ranges; 8/12 single-phase = same 7 items as LV) and commercial LV (7 items) / HV (10 items: + BCU, EBC, BDC). Each item shows its own equations, math styling, only normal parentheses ().
7. Diesel conversion explained: monthly kWh = liters ÷ 0.27.
8. Global switch "عبر المعادلات" / "عبر النطاقات الجاهزة" (`formulas.mode` eq|ranges) used by app and bot. In ranges mode all systems listed with editable ranges; commercial ranges stored in `comRanges` (key kW-phase-panels), bot port `ACTES_COM_RANGES`.
9. PVsyst and SLD are generated per request from the chosen system, so they follow either mode.
10. Added 80 kW ready systems to QuoteBuilder (153 panels/12 batteries, 204 panels/18 batteries); bot already had 80 kW rows.
11. Published to https://actes-crm.lovable.app (2026-11-17).

## Open / next
- Confirm DC box and control counts chosen for the 204-panel 80 kW system.
- dcRatio 1.3 and lvMaxKw 40 are provisional.

## Continued (2026-11-17 → 2026-11-18)
12. All 55 HV systems (50/80/125 kW × 1–5 inverters) from bot `BIG_ROWS` added to QuoteBuilder and the ranges screen; shared comKey for two duplicates (same as bot).
13. Ranges screen: each system has "الأصناف" editor (change qty, swap item from same category, add/delete, restore) stored in `formulas.presetItems`.
14. Checkmark ✓ on the active system: "عبر المعادلات" (default, active) or "عبر النطاقات الجاهزة". Range/item edits are saved but applied ONLY when ✓ is on ranges and saved. Bot follows `formulas.mode`; bot does not yet use `presetItems`.
15. Project moved to a new workspace; GitHub and n8n connectors reconnected (GITHUB_API_KEY, N8N_API_KEY).
16. HV storage choice restored in commercial flow (app + bot): Hithium 112S racks (default), Pylontech racks (M1 ≤109.02 kWh, else M5), cabinets Hithium 112C / Pylontech 261 / 313 — now scaled by equations (`src/lib/storage.ts` ↔ bot `ACTES_STORAGE_*`, 468-case parity 0 mismatches). Editable: cabKwh 112, m1Kwh 4.74, m5Kwh 15.68, m1MaxKwh 109.02.
17. Explained how edits flow: CRM saves to database → bot reads `/api/public/bot-catalog` on every message; no publish needed for data changes, only for code changes.
18. Bot text edits ("المسار"): fixed the one saved edit ("كم تدفع الفاتورة الشهرية بالريال اليمني؟") whose original text did not match the bot exactly.

## Open / next
- Bot should use `presetItems` when ✓ is on ranges (app already does).
- Verify BCU/EBC/BDC counts for 3–5 inverter HV systems.
- dcRatio 1.3 and lvMaxKw 40 still provisional.
- Publish after code changes so the bot/app use them.
