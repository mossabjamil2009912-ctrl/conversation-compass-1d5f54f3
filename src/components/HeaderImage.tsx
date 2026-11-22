import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Upload } from "lucide-react";
import { getHeaderImage, saveHeaderImage } from "@/lib/crm.functions";
import { offlineQuery } from "@/lib/offline-cache";

export function HeaderImage({ pw }: { pw: string }) {
  const get = useServerFn(getHeaderImage);
  const save = useServerFn(saveHeaderImage);
  const { data, refetch } = useQuery(offlineQuery({ queryKey: ["header-image"], queryFn: () => get({ data: { pw } }) }));
  const [busy, setBusy] = useState(false);
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (!["image/jpeg", "image/png"].includes(f.type)) return alert("اختر صورة JPG أو PNG");
    if (f.size > 5 * 1024 * 1024) return alert("حجم الصورة أكبر من 5MB");
    setBusy(true);
    try {
      const b64 = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1] ?? ""); r.onerror = rej; r.readAsDataURL(f); });
      await save({ data: { pw, b64, mime: f.type as "image/jpeg" | "image/png" } });
      await refetch();
    } catch (e) { alert((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">هذه الصورة تظهر في رأس رسائل البوت على واتساب. عند رفع صورة جديدة تتغير في البوت من الرسالة التالية.</p>
      {data?.url && <img src={data.url} alt="صورة ترويسة رسائل البوت" className="w-full rounded-lg border" />}
      <label className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground ${busy ? "opacity-50" : ""}`}>
        <Upload className="h-4 w-4" />{busy ? "جاري الرفع..." : "تغيير الصورة"}
        <input type="file" accept="image/jpeg,image/png" className="hidden" disabled={busy} onChange={(e) => onFile(e.target.files?.[0])} />
      </label>
    </div>
  );
}
