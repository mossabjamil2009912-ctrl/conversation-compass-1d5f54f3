import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Star, Check } from "lucide-react";
import { actsReviewInfo, actsSubmitReview } from "@/lib/acts.functions";

export const Route = createFileRoute("/acts/rate/$token")({
  head: () => ({
    meta: [
      { title: "تقييم المهندس — ACTES" },
      { name: "description", content: "قيّم تجربتك مع مهندس أكتس بعد اكتمال طلب الخدمة." },
      { property: "og:title", content: "تقييم المهندس — ACTES" },
      { property: "og:description", content: "شاركنا رأيك في جودة العمل والالتزام والاحترافية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Rate,
});

const CRIT = [["rating", "التقييم العام"], ["quality", "جودة العمل"], ["punctuality", "الالتزام بالمواعيد"], ["professionalism", "الاحترافية"], ["responsiveness", "سرعة الاستجابة"]] as const;
type K = (typeof CRIT)[number][0];

function Rate() {
  const { token } = Route.useParams();
  const info = useServerFn(actsReviewInfo);
  const submit = useServerFn(actsSubmitReview);
  const { data, error, isLoading } = useQuery({ queryKey: ["acts-rate", token], queryFn: () => info({ data: { token } }) });
  const [v, setV] = useState<Record<K, number>>({ rating: 0, quality: 0, punctuality: 0, professionalism: 0, responsiveness: 0 });
  const [comment, setComment] = useState(""); const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [done, setDone] = useState(false);
  const all = Object.values(v).every((x) => x > 0);
  return (
    <div dir="rtl" className="min-h-screen bg-background p-4 text-foreground">
      <div className="mx-auto max-w-md space-y-4 rounded-2xl border border-border bg-card p-5">
        <h1 className="text-lg font-bold">تقييم الخدمة</h1>
        {isLoading ? <p className="text-sm">جارٍ التحميل...</p>
          : error ? <p className="text-sm text-destructive">{(error as Error).message}</p>
          : done || data?.reviewed ? <p className="flex items-center gap-2 font-bold"><Check className="h-5 w-5 text-primary" />شكراً لك، تم تسجيل تقييمك.</p>
          : data?.status !== "done" ? <p className="text-sm text-muted-foreground">يمكنك التقييم بعد اكتمال الطلب.</p>
          : <>
            <p className="text-sm text-muted-foreground">{data.service}{data.engineer ? ` — المهندس ${data.engineer}` : ""}</p>
            {CRIT.map(([k, l]) => <div key={k} className="flex items-center justify-between"><span className="text-sm">{l}</span>
              <span className="flex gap-0.5" dir="ltr">{[1, 2, 3, 4, 5].map((i) => <button key={i} onClick={() => setV({ ...v, [k]: i })} aria-label={`${l} ${i}`}><Star className={`h-6 w-6 ${i <= v[k] ? "fill-primary text-primary" : "text-muted-foreground/40"}`} /></button>)}</span></div>)}
            <textarea className="w-full rounded-xl border border-border bg-background p-3 text-sm" placeholder="اكتب تعليقاً عن تجربتك (اختياري)" value={comment} onChange={(e) => setComment(e.target.value)} />
            {err && <p className="text-sm text-destructive">{err}</p>}
            <button className="w-full rounded-xl bg-primary py-2.5 font-bold text-primary-foreground disabled:opacity-50" disabled={!all || busy} onClick={async () => {
              setBusy(true); setErr(""); try { await submit({ data: { token, ...v, comment } }); setDone(true); } catch (e) { setErr(e instanceof Error ? e.message : "حدث خطأ"); } finally { setBusy(false); }
            }}>إرسال التقييم</button>
          </>}
      </div>
    </div>
  );
}
