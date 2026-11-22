import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  addCatalogCategory, buildCatalogProfile, catalogUploadUrls, deleteCatalog, deleteCatalogCategory, saveCatalog,
  type CatalogItem,
} from "@/lib/catalogs.functions";

type Data = { categories: { id: string; name: string }[]; catalogs: CatalogItem[] };
const inp = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";
const err = (e: unknown) => (e instanceof Error ? e.message : "حدث خطأ");

/** Reads every page's text and draws page 1 as the cover (in the browser). */
async function readPdf(file: File) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: { page: number; content: string }[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const p = await pdf.getPage(i);
    const tc = await p.getTextContent();
    pages.push({ page: i, content: tc.items.map((it) => ("str" in it ? it.str : "")).join(" ") });
  }
  const first = await pdf.getPage(1);
  const vp = first.getViewport({ scale: 600 / first.getViewport({ scale: 1 }).width });
  const canvas = document.createElement("canvas");
  canvas.width = vp.width; canvas.height = vp.height;
  await first.render({ canvasContext: canvas.getContext("2d")!, viewport: vp }).promise;
  const cover = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.82));
  return { pages, cover, count: pdf.numPages };
}

/** Staff-only panel (CRM password): add/remove catalogs and categories. */
export function CatalogAdmin({ pw, data, onChanged, onClose }: { pw: string; data: Data; onChanged: () => void; onClose: () => void }) {
  const getUrls = useServerFn(catalogUploadUrls);
  const save = useServerFn(saveCatalog);
  const profile = useServerFn(buildCatalogProfile);
  const del = useServerFn(deleteCatalog);
  const addCat = useServerFn(addCatalogCategory);
  const delCat = useServerFn(deleteCatalogCategory);
  const [f, setF] = useState({ title: "", description: "", keywords: "", category_id: "", language: "ar" as "ar" | "en" });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState("");
  const [cat, setCat] = useState("");

  async function upload() {
    if (!file || !f.title.trim()) { toast.error("اختر ملف PDF واكتب العنوان"); return; }
    try {
      setBusy("قراءة الملف…");
      const { pages, cover, count } = await readPdf(file);
      setBusy("رفع الملف…");
      const u = await getUrls({ data: { pw } });
      const up = await supabase.storage.from("catalogs").uploadToSignedUrl(u.filePath, u.fileToken, file, { contentType: "application/pdf" });
      if (up.error) throw new Error(up.error.message);
      let coverPath: string | null = null;
      if (cover) {
        const c = await supabase.storage.from("catalogs").uploadToSignedUrl(u.coverPath, u.coverToken, cover, { contentType: "image/jpeg" });
        if (!c.error) coverPath = u.coverPath;
      }
      setBusy("حفظ…");
      await save({ data: { pw, id: u.id, ...f, category_id: f.category_id || null, file_path: u.filePath, cover_path: coverPath, page_count: count, pages } });
      setBusy("تجهيز المواصفات للمساعد…");
      await profile({ data: { pw, id: u.id } }).catch(() => toast.warning("أُضيف الكتالوج، لكن تعذر تجهيز مواصفاته للمساعد الآن"));
      toast.success("أُضيف الكتالوج");
      setF({ title: "", description: "", keywords: "", category_id: "", language: "ar" });
      setFile(null);
      onChanged();
    } catch (e) {
      toast.error(err(e));
    } finally {
      setBusy("");
    }
  }

  return (
    <div dir="rtl" className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 p-3" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-2xl space-y-5 overflow-y-auto rounded-2xl border border-border bg-card p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">إدارة الكتالوجات</h2>
          <button onClick={onClose} aria-label="إغلاق" className="rounded-lg p-1 hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>

        <section className="space-y-2 rounded-xl border border-border p-3">
          <p className="text-sm font-bold">إضافة كتالوج</p>
          <input className={inp} placeholder="العنوان" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <textarea className={inp} rows={2} placeholder="وصف قصير" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
          <input className={inp} placeholder="كلمات البحث (الماركة، الموديل، بالعربي والإنجليزي)" value={f.keywords} onChange={(e) => setF({ ...f, keywords: e.target.value })} />
          <div className="flex gap-2">
            <select className={inp} value={f.category_id} onChange={(e) => setF({ ...f, category_id: e.target.value })}>
              <option value="">بدون قسم</option>
              {data.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className={inp} value={f.language} onChange={(e) => setF({ ...f, language: e.target.value as "ar" | "en" })}>
              <option value="ar">عربي</option><option value="en">English</option>
            </select>
          </div>
          <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
          <button disabled={!!busy} onClick={() => void upload()} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {busy || "رفع"}
          </button>
        </section>

        <section className="space-y-2 rounded-xl border border-border p-3">
          <p className="text-sm font-bold">الأقسام</p>
          <div className="flex flex-wrap gap-2">
            {data.categories.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs">
                {c.name}
                <button aria-label="حذف القسم" onClick={() => confirm(`حذف قسم ${c.name}؟`) && delCat({ data: { pw, id: c.id } }).then(onChanged).catch((e) => toast.error(err(e)))}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input className={inp} placeholder="قسم جديد" value={cat} onChange={(e) => setCat(e.target.value)} />
            <button onClick={() => cat.trim() && addCat({ data: { pw, name: cat } }).then(() => { setCat(""); onChanged(); }).catch((e) => toast.error(err(e)))}
              className="rounded-xl border border-border px-3" aria-label="إضافة قسم"><Plus className="h-4 w-4" /></button>
          </div>
        </section>

        <section className="space-y-1 rounded-xl border border-border p-3">
          <p className="text-sm font-bold">الكتالوجات ({data.catalogs.length})</p>
          {data.catalogs.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-2 border-b border-border py-1.5 text-sm last:border-0">
              <span className="truncate">{c.title}</span>
              <button aria-label="حذف" onClick={() => confirm(`حذف «${c.title}»؟`) && del({ data: { pw, id: c.id } }).then(() => { toast.success("حُذف"); onChanged(); }).catch((e) => toast.error(err(e)))}
                className="rounded-lg p-1 text-destructive hover:bg-muted"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
