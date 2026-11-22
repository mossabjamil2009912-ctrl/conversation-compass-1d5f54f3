import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, ExternalLink, FileText, Loader2, Search, Settings, Share2, X } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/actes-logo.png";
import { listCatalogs, getCatalog } from "@/lib/catalogs.functions";
import { offlineQuery } from "@/lib/offline-cache";
import { loadCatalogPdf } from "@/lib/catalog-pdf-cache";
import { PdfView } from "@/components/PdfView";
import { CatalogAssistant } from "@/components/catalogs/CatalogAssistant";
import { CatalogAdmin } from "@/components/catalogs/CatalogAdmin";

export const Route = createFileRoute("/catalogs")({
  validateSearch: (s: Record<string, unknown>) => (typeof s["id"] === "string" ? { id: s["id"] } : {}) as { id?: string },
  head: () => ({
    meta: [
      { title: "مكتبة كتالوجات ACTES — ألواح، انفرترات، بطاريات" },
      { name: "description", content: "ابحث في كتالوجات منتجات ACTES للطاقة الشمسية واسأل المساعد الذكي عن أي مواصفة بإجابة مختصرة." },
      { property: "og:title", content: "مكتبة كتالوجات ACTES" },
      { property: "og:description", content: "كل كتالوجات الألواح والانفرترات والبطاريات في مكان واحد مع مساعد ذكي." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Catalogs,
});

const BRANDS = [
  { name: "Suntech", terms: ["suntech", "سانتك", "سنتك"] },
  { name: "Li Power", terms: ["li power", "لي باور", "ليو باور"] },
  { name: "Deye", terms: ["deye", "داي", "دايا"] },
  { name: "Solis", terms: ["solis", "سوليس"] },
  { name: "Pylontech", terms: ["pylontech", "بايلونتك"] },
  { name: "HeroEE", terms: ["heroee", "hero ee", "هيرو إي", "هيرو اي"] },
];
const MANUAL = "User Manual";
const norm = (s: string) =>
  s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).toLowerCase()
    .replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي")
    .replace(/([\u0600-\u06FF])(\d)/g, "$1 $2").replace(/(\d)([\u0600-\u06FF])/g, "$1 $2");

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return <button onClick={onClick} className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-semibold transition ${on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary"}`}>{children}</button>;
}

function Catalogs() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listCatalogs);
  const { data, isLoading, isError } = useQuery(offlineQuery({ queryKey: ["catalogs-platform"], queryFn: () => fetchList(), staleTime: 5 * 60_000 }));
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [q, setQ] = useState("");
  const [brand, setBrand] = useState<string | null>(null);
  const [pw, setPw] = useState<string | null>(null);
  const [admin, setAdmin] = useState(false);
  useEffect(() => { setPw(localStorage.getItem("actes_pw")); }, []);

  const catName = useMemo(() => new Map((data?.categories ?? []).map((c) => [c.id, c.name])), [data]);
  const results = useMemo(() => {
    let list = data?.catalogs ?? [];
    const b = BRANDS.find((x) => x.name === brand);
    const isManual = (c: { category_id: string | null }) => (c.category_id ? catName.get(c.category_id) ?? "" : "").includes("User Manual");
    if (brand === MANUAL) list = list.filter(isManual);
    else if (b) list = list.filter((c) => !isManual(c) && b.terms.some((t) => c.title.toLowerCase().includes(t)));
    const words = norm(q).split(/\s+/).filter(Boolean);
    if (words.length) list = list.filter((c) => { const hay = norm(`${c.title} ${c.keywords} ${c.description}`); return words.every((w) => hay.includes(w)); });
    return [...list].sort((a, b2) => a.title.localeCompare(b2.title, "ar"));
  }, [data, q, brand, catName]);

  const open = (id: string | null) => navigate({ search: id ? { id } : {}, replace: false });

  return (
    <div dir="rtl" className="min-h-screen bg-background pb-28 text-foreground">
      <header className="relative overflow-hidden bg-ink px-4 pb-6 pt-5 text-center text-ink-foreground">
        <div className="pointer-events-none absolute -top-10 left-[30%] h-48 w-1.5 rotate-[35deg] bg-primary" />
        {pw && (
          <button onClick={() => setAdmin(true)} aria-label="إدارة الكتالوجات" className="absolute left-3 top-3 rounded-lg p-2 opacity-70 hover:opacity-100">
            <Settings className="h-5 w-5" />
          </button>
        )}
        <img src={logo} alt="ACTES" className="relative mx-auto h-12 w-auto rounded-xl bg-card p-1" />
        <h1 className="relative mt-3 text-2xl font-bold">مكتبة الكتالوجات</h1>
        <p className="relative text-xs opacity-70">ابحث عن كتالوج المنتج أو اسأل المساعد الذكي</p>
      </header>

      <main className="mx-auto max-w-6xl px-4">
        <div className="relative mx-auto -mt-5 mb-4 max-w-2xl">
          <Search className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث باسم المنتج أو الموديل أو القدرة..."
            className="w-full rounded-2xl border-2 border-border bg-card py-3.5 pl-4 pr-12 text-base shadow-sm outline-none placeholder:text-sm focus:border-primary" />
        </div>
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2 sm:flex-wrap sm:justify-center">
          <Chip on={!brand} onClick={() => setBrand(null)}>الكل</Chip>
          {BRANDS.map((b) => <Chip key={b.name} on={brand === b.name} onClick={() => setBrand(b.name)}>{b.name}</Chip>)}
          <Chip on={brand === MANUAL} onClick={() => setBrand(MANUAL)}>{MANUAL}</Chip>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : isError ? (
          <p className="py-20 text-center text-muted-foreground">تعذر تحميل الكتالوجات — تحقق من الاتصال.</p>
        ) : results.length === 0 ? (
          <p className="py-20 text-center text-muted-foreground">لا توجد نتائج — جرّب سؤال المساعد الذكي.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {results.map((c) => (
              <button key={c.id} onClick={() => open(c.id)} className="group overflow-hidden rounded-2xl border border-border bg-card text-right transition hover:-translate-y-0.5 hover:border-primary">
                <div className="relative aspect-[3/4] bg-muted">
                  {c.cover_url ? (
                    <img src={c.cover_url} alt={c.title} loading="lazy" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                  ) : (
                    <div className="flex h-full items-center justify-center"><FileText className="h-12 w-12 text-muted-foreground" /></div>
                  )}
                  <span className={`absolute right-2 top-2 rounded-full px-2.5 py-0.5 text-xs font-bold ${c.language === "en" ? "bg-ink text-ink-foreground" : "bg-primary text-primary-foreground"}`}>
                    {c.language === "en" ? "English" : "عربي"}
                  </span>
                </div>
                <div className="p-3">
                  <h2 className="line-clamp-2 text-sm font-bold leading-snug group-hover:text-primary">{c.title}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">{c.category_id ? catName.get(c.category_id) : ""}{c.page_count ? ` · ${c.page_count} صفحة` : ""}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      {search.id && <Viewer id={search.id} onClose={() => open(null)} />}
      {admin && pw && data && (
        <CatalogAdmin pw={pw} data={data} onClose={() => setAdmin(false)} onChanged={() => qc.invalidateQueries({ queryKey: ["catalogs-platform"] })} />
      )}
      <CatalogAssistant />
    </div>
  );
}

function Viewer({ id, onClose }: { id: string; onClose: () => void }) {
  const fetchOne = useServerFn(getCatalog);
  const { data: c, isLoading } = useQuery(offlineQuery({ queryKey: ["catalog-file", id], queryFn: () => fetchOne({ data: { id } }), staleTime: 60 * 60_000 }));
  // The PDF itself is kept on the device after the first open, so it reopens instantly and offline.
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [fileErr, setFileErr] = useState(false);
  useEffect(() => {
    let url: string | null = null, dead = false;
    (async () => {
      const blob = await loadCatalogPdf(id, c?.file_url ?? null);
      if (dead) return;
      if (blob) { url = URL.createObjectURL(blob); setLocalUrl(url); } else if (!isLoading) setFileErr(true);
    })();
    return () => { dead = true; if (url) URL.revokeObjectURL(url); };
  }, [id, c?.file_url, isLoading]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose]);
  const share = async () => {
    const url = `${window.location.origin}/catalogs?id=${id}`;
    try {
      if (navigator.share) await navigator.share({ title: c?.title ?? "كتالوج", url });
      else { await navigator.clipboard.writeText(url); toast.success("نُسخ الرابط"); }
    } catch { /* cancelled */ }
  };
  return (
    <div dir="rtl" className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 p-2 sm:p-6" onClick={onClose}>
      <div className="flex h-full max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-card" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-border p-2">
          {c?.download_url ? (
            <a href={c.download_url} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><Download className="h-4 w-4" /> تحميل</a>
          ) : null}
          <button onClick={() => void share()} aria-label="مشاركة" className="rounded-xl border border-border p-2 hover:text-primary"><Share2 className="h-4 w-4" /></button>
          {c?.file_url && <a href={c.file_url} target="_blank" rel="noreferrer" aria-label="فتح في نافذة جديدة" className="rounded-xl border border-border p-2 hover:text-primary"><ExternalLink className="h-4 w-4" /></a>}
          <p className="min-w-0 flex-1 truncate text-sm font-semibold">{c?.title}</p>
          <button onClick={onClose} aria-label="إغلاق" className="rounded-xl p-2 hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
        <div className="min-h-0 flex-1 bg-muted">
          {localUrl ? <PdfView url={localUrl} />
            : !fileErr ? <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            : <p className="p-6 text-center text-muted-foreground">تعذر فتح الكتالوج.</p>}
        </div>
      </div>
    </div>
  );
}
