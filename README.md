# ACTES CRM — النسخة الكاملة

لوحة CRM لبوت واتساب ACTES للطاقة الشمسية (TanStack Start + Supabase + n8n).

## محتوى المستودع
- `src/` الكود كاملاً: المحادثات، عروض الأسعار، «المسار»، «المعادلات»، الكتالوجات، منصة ACTS.
- `data/backup/*.json` نسخة كاملة من بيانات كل الجداول (المعادلات في `app_settings` مفتاح `formulas`، تعديلات المسار في `bot_texts`/`bot_steps`، الأصناف والأسعار في `catalog_items`، المحادثات...). `_summary.json` = عدد الصفوف وتاريخ التصدير، `_schema.json` = أعمدة الجداول.
- `AGENTS.md` و `src/lib/AGENTS.md` قواعد المشروع لمن يكمل العمل.

## تحديث النسخة
`bun scripts/export-data.mjs` (يحتاج `SUPABASE_URL` و `SUPABASE_SERVICE_ROLE_KEY`) ثم commit.

## الاستعادة في مشروع جديد
1. استورد المستودع، فعّل Lovable Cloud وأنشئ الجداول حسب `_schema.json`.
2. أدخل ملفات `data/backup/*.json` في الجداول المطابقة.
3. أضف السرّيات: `DASHBOARD_PASSWORD` (دخول اللوحة)، `BOT_INGEST_SECRET` (نفس مفتاح n8n)، `LOVABLE_API_KEY`، `GITHUB_API_KEY` (النسخ اليومي).
4. انشر، ثم حدّث رابط الـ CRM في بوت n8n (`https://n8n.srv1994780.hstgr.cloud`) إلى الرابط المنشور.

## مفاتيح التشغيل
- رمز فتح «المسار» و«المعادلات»: `2027` (المعادلات: ضغط مطوّل 3 ثوانٍ على الترس).
- البوت يقرأ كل شيء من `/api/public/bot-catalog`: `FORMULAS`، `BOT_TEXTS`، `BOT_STEPS`، الأسعار، القواعد التلقائية.
