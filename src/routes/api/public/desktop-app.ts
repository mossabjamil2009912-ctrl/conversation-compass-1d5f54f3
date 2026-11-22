import { createFileRoute } from "@tanstack/react-router";

// Public: permanent direct-download link for the Windows app (ACTES-CRM.exe).
// The file lives in private storage; this hands out a short-lived link so the
// address below never changes and never expires.
export const Route = createFileRoute("/api/public/desktop-app")({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage
          .from("crm-attachments")
          .createSignedUrl("desktop/ACTES-CRM.exe", 300);
        if (error || !data?.signedUrl) {
          console.error("desktop app download failed:", error?.message);
          return new Response("Download unavailable", { status: 500 });
        }
        return Response.redirect(data.signedUrl, 302);
      },
    },
  },
});
