# ACTES CRM — Handoff (read first after importing)

Brand: **ACTES** (never ACTS). Published: https://actes-crm.lovable.app

## What exists
- CRM: chats (WhatsApp via n8n bot "ACTES v35"), catalog/items with categories, quotes (QuoteBuilder), orders, support, PVsyst/SLD reports, bot texts editor ("المسار"), forced update + frontend URL redirect, offline-first PWA.
- ACTES platform: standalone app https://sunwise-engineer-network.lovable.app (GitHub repo `sunwise-engineer-network`). It talks to this CRM only via `https://actes-crm.lovable.app/api/public/acts-bridge` (GET catalog, POST {action,data}). Admin lives in CRM "ACTES" tab. Join requests: WhatsApp-chat button, no approve/reject. Engineers' phones are not shown/stored. 12 approved sample engineers with generated (not real) photos in `public/acts/`.

## Data backup
- Daily job `/api/public/jobs/github-backup` writes every table as JSON to private repo `actes-crm-data-backup` under `data/<table>.json`. To restore in a new backend: create schema, then insert these JSON files.

## After moving workspace / importing
1. Reconnect n8n and GitHub connectors (secrets GITHUB_API_KEY, N8N_API_KEY).
2. Secrets needed (names only): DASHBOARD_PASSWORD, BOT_INGEST_SECRET, ACTES_DB_SECRET_KEY, GITHUB_API_KEY.
3. Restore data from `actes-crm-data-backup`.
4. Publish; keep old hosts in LEGACY_FRONTEND_HOSTS.

Rules and decisions: see `AGENTS.md`.

## Latest state (2026-11-15)
- Manual Android (Capacitor) update: settings gear → "عنوان خدمة الإدارة" + "تحديث التطبيق" (`src/lib/manual-update.ts`, `autoUpdate: false`). Release: build, then `node scripts/package-update.mjs <version>`, then publish.
- ACTES standalone app linked via acts-bridge and tested (service request reached CRM chats + ACTES tab).
- Full history of requests: see `AGENTS.md` rules + `.lovable/plan/` archived plans.

## Latest state (2026-11-18)
- Read `docs/CONVERSATION_HISTORY.md` for the full request history and open items.
- Bot workflow copy: `docs/n8n/actes-bot-workflow.json` (put the real BOT_INGEST_SECRET back before importing into n8n).
- Project memory copy: `docs/project-memory/` — recreate as project memory after import.
