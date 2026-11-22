import { createFileRoute } from "@tanstack/react-router";

// Public: streams a catalog cover image (marketing artwork only, never the PDF) with a long cache,
// so browsers and the CDN keep covers and the list page skips per-request link signing.
export const Route = createFileRoute("/api/public/catalog-cover")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const id = new URL(request.url).searchParams.get("id") ?? "";
        if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("bad id", { status: 400 });
        const { supabaseAdmin: sb } = await import("@/lib/db.server");
        const { data: row } = await sb.from("catalogs").select("cover_path").eq("id", id).maybeSingle();
        if (!row?.cover_path) return new Response("not found", { status: 404 });
        const { data: blob } = await sb.storage.from("catalogs").download(row.cover_path);
        if (!blob) return new Response("not found", { status: 404 });
        return new Response(blob, {
          headers: {
            "Content-Type": blob.type || "image/jpeg",
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
