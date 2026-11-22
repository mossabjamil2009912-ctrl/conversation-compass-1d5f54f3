import { createFileRoute } from "@tanstack/react-router";

// Public header image for WhatsApp bot messages (non-private brand image). Falls back to the bundled /quote-header.jpg.
export const Route = createFileRoute("/api/public/header-image")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { supabaseAdmin } = await import("@/lib/db.server");
        const { data: r } = await supabaseAdmin.from("app_settings").select("text_value").eq("key", "header_image").maybeSingle();
        let s: { path?: string; mime?: string } = {};
        try { s = JSON.parse(r?.text_value ?? "{}"); } catch { s = {}; }
        if (s.path?.startsWith("header-image/")) {
          const f = await supabaseAdmin.storage.from("crm-attachments").download(s.path);
          if (f.data) return new Response(f.data, { headers: { "content-type": s.mime || "image/jpeg", "cache-control": "public, max-age=31536000, immutable" } });
        }
        return Response.redirect(new URL("/quote-header.jpg", request.url).toString(), 302);
      },
    },
  },
});
