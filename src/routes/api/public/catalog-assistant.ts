import { createFileRoute } from "@tanstack/react-router";

// Public streaming endpoint for the catalog smart assistant: answers only from public catalog content.
export const Route = createFileRoute("/api/public/catalog-assistant")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try { body = await request.json(); } catch { return Response.json({ error: "bad request" }, { status: 400 }); }
        const { cleanMsgs, streamAnswer } = await import("@/lib/catalog-assistant.server");
        const messages = cleanMsgs(body);
        if (!messages.length) return Response.json({ error: "empty" }, { status: 400 });
        const stream = await streamAnswer(messages);
        return new Response(stream, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
      },
    },
  },
});
