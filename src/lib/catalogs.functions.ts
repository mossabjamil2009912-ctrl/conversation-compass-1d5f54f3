// Catalog platform (moved here from the separate catalog app): public browsing + staff management.
// Tables catalog_* are server-only; files live in the private "catalogs" storage bucket.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const BUCKET = "catalogs";

function check(pw: string) {
  const real = process.env["DASHBOARD_PASSWORD"];
  if (!real || pw !== real) throw new Error("كلمة المرور غير صحيحة");
}

export type CatalogItem = {
  id: string;
  title: string;
  description: string;
  keywords: string;
  category_id: string | null;
  language: string;
  page_count: number;
  created_at: string;
  cover_url: string | null;
};


export const listCatalogs = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin: sb } = await import("@/lib/db.server");
  const [{ data: cats }, { data: rows, error }] = await Promise.all([
    sb.from("catalog_categories").select("id,name").order("name"),
    sb.from("catalogs").select("*").order("created_at", { ascending: false }),
  ]);
  if (error) throw new Error(error.message);
  const list = rows ?? [];
  const catalogs: CatalogItem[] = list.map((r) => ({
    id: r.id, title: r.title, description: r.description, keywords: r.keywords,
    category_id: r.category_id, language: r.language, page_count: r.page_count, created_at: r.created_at,
    cover_url: r.cover_path ? `/api/public/catalog-cover?id=${r.id}` : null,
  }));
  return { categories: cats ?? [], catalogs };
});

export const getCatalog = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin: sb } = await import("@/lib/db.server");
    const { data: row } = await sb.from("catalogs").select("id,title,file_path").eq("id", data.id).maybeSingle();
    if (!row) return null;
    const [{ data: file }, { data: dl }] = await Promise.all([
      sb.storage.from(BUCKET).createSignedUrl(row.file_path, 60 * 60 * 6),
      sb.storage.from(BUCKET).createSignedUrl(row.file_path, 60 * 60 * 6, { download: `${row.title}.pdf` }),
    ]);
    return { id: row.id, title: row.title, file_url: file?.signedUrl ?? null, download_url: dl?.signedUrl ?? null };
  });

/* ---------- Staff management (CRM dashboard password) ---------- */

export const catalogUploadUrls = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ pw: z.string() }).parse(d))
  .handler(async ({ data }) => {
    check(data.pw);
    const { supabaseAdmin: sb } = await import("@/lib/db.server");
    const id = crypto.randomUUID();
    const filePath = `files/${id}.pdf`, coverPath = `covers/${id}.jpg`;
    const [f, c] = await Promise.all([
      sb.storage.from(BUCKET).createSignedUploadUrl(filePath),
      sb.storage.from(BUCKET).createSignedUploadUrl(coverPath),
    ]);
    if (f.error || c.error) throw new Error("تعذر تجهيز الرفع");
    return { id, filePath, coverPath, fileToken: f.data.token, coverToken: c.data.token };
  });

export const saveCatalog = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    pw: z.string(), id: z.string().uuid(), title: z.string().min(1).max(300), description: z.string().max(3000),
    keywords: z.string().max(3000), category_id: z.string().uuid().nullable(), language: z.enum(["ar", "en"]),
    file_path: z.string(), cover_path: z.string().nullable(), page_count: z.number().int().min(0),
    pages: z.array(z.object({ page: z.number().int(), content: z.string() })).max(2000),
  }).parse(d))
  .handler(async ({ data }) => {
    check(data.pw);
    const { supabaseAdmin: sb } = await import("@/lib/db.server");
    const { error } = await sb.from("catalogs").insert({
      id: data.id, title: data.title.trim(), description: data.description.trim(), keywords: data.keywords.trim(),
      category_id: data.category_id, language: data.language, file_path: data.file_path,
      cover_path: data.cover_path, page_count: data.page_count,
    });
    if (error) throw new Error(error.message);
    const rows: { catalog_id: string; page: number; content: string }[] = [];
    for (const p of data.pages) {
      const text = p.content.replace(/\s+/g, " ").replace(/\u0000/g, "").trim();
      for (let i = 0; i < text.length; i += 1200) rows.push({ catalog_id: data.id, page: p.page, content: text.slice(Math.max(0, i - 150), i + 1200) });
    }
    for (let i = 0; i < rows.length; i += 300) await sb.from("catalog_chunks").insert(rows.slice(i, i + 300));
    return { id: data.id, chunks: rows.length };
  });

/** Builds the short spec sheet the assistant reads for one catalog (one AI call). */
export const buildCatalogProfile = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ pw: z.string(), id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    check(data.pw);
    const { buildProfile } = await import("@/lib/catalog-assistant.server");
    await buildProfile(data.id);
    return { ok: true };
  });

export const deleteCatalog = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ pw: z.string(), id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    check(data.pw);
    const { supabaseAdmin: sb } = await import("@/lib/db.server");
    const { data: row } = await sb.from("catalogs").select("file_path,cover_path").eq("id", data.id).maybeSingle();
    if (row) await sb.storage.from(BUCKET).remove([row.file_path, ...(row.cover_path ? [row.cover_path] : [])]);
    await sb.from("catalogs").delete().eq("id", data.id);
    return { ok: true };
  });

export const addCatalogCategory = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ pw: z.string(), name: z.string().min(1).max(100) }).parse(d))
  .handler(async ({ data }) => {
    check(data.pw);
    const { supabaseAdmin: sb } = await import("@/lib/db.server");
    await sb.from("catalog_categories").insert({ name: data.name.trim() });
    return { ok: true };
  });

export const deleteCatalogCategory = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ pw: z.string(), id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    check(data.pw);
    const { supabaseAdmin: sb } = await import("@/lib/db.server");
    await sb.from("catalog_categories").delete().eq("id", data.id);
    return { ok: true };
  });
