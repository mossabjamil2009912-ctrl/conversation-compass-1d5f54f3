import { createFileRoute } from "@tanstack/react-router";

// Public: rewrites a spoken (dialect, misspelled) question into clean Arabic for display only.
export const Route = createFileRoute("/api/public/catalog-fix-question")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let q = "";
        try { q = String(((await request.json()) as { q?: unknown }).q ?? "").slice(0, 300).trim(); } catch { /* empty */ }
        if (!q) return Response.json({ q: "" }, { status: 400 });
        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return Response.json({ q });
        try {
          const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [
                { role: "system", content: "صحّح إملاء سؤال عن منتجات طاقة شمسية نُسخ من الصوت باللهجة اليمنية. اكتبه بالعربية الفصحى المختصرة، الأرقام بالأرقام (16 لا ستة عشر)، والماركات: فيدوس، سوليس، دِيِه، لونجي، سانتك، بايلونتك، هايثيوم. لا تغيّر المعنى ولا تجب عن السؤال. أعد السؤال المصحح فقط بلا علامات تنصيص." },
                { role: "user", content: q },
              ],
            }),
          });
          const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
          const out = j.choices?.[0]?.message?.content?.trim().replace(/^["«]|["»]$/g, "");
          return Response.json({ q: out && out.length < 400 ? out : q });
        } catch { return Response.json({ q }); }
      },
    },
  },
});
