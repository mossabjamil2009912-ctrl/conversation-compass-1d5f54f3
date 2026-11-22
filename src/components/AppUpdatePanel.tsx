import { useEffect, useState } from "react";
import { getServiceUrl, runManualUpdate, setServiceUrl, type Status } from "@/lib/manual-update";

const LABEL: Record<Status, string> = {
  checking: "جارٍ البحث عن تحديث...",
  downloading: "جارٍ التنزيل...",
  applying: "جارٍ تطبيق التحديث...",
  latest: "تطبيقك على أحدث إصدار",
  error: "حدث خطأ",
};

export function AppUpdatePanel() {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  useEffect(() => { setUrl(getServiceUrl()); }, []);

  const check = async () => {
    setBusy(true);
    try {
      await runManualUpdate((s, info) => setMsg({ ok: s !== "error", t: info ? `${LABEL[s]} (${info})` : LABEL[s] }));
    } catch (e) { setMsg({ ok: false, t: `${LABEL.error}: ${(e as Error).message}` }); }
    setBusy(false);
  };
  const save = async () => {
    try { setUrl(setServiceUrl(url)); await check(); }
    catch (e) { setMsg({ ok: false, t: (e as Error).message }); }
  };

  return (
    <div className="space-y-2 border-t border-border pt-3">
      <label className="text-sm font-semibold">عنوان خدمة الإدارة</label>
      <input dir="ltr" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..."
        className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm" />
      {msg && <p className={`text-sm ${msg.ok ? "text-primary" : "text-destructive"}`}>{msg.t}</p>}
      <div className="flex gap-2">
        <button disabled={busy} onClick={save} className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-semibold disabled:opacity-50">حفظ العنوان</button>
        <button disabled={busy} onClick={check} className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">تحديث التطبيق</button>
      </div>
    </div>
  );
}
