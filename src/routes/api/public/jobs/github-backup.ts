import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

// Daily backup: copies every app table as JSON into the private GitHub repo below.
// The scheduler cancels a request after a few seconds, so each run writes its tables
// as ONE commit (blobs in parallel, then tree → commit → ref) and the tables are split
// into groups that run as separate schedules.
const REPO = "mossabjamil2009912-ctrl/actes-crm-data-backup";
const GATEWAY = "https://connector-gateway.lovable.dev/github";
const GROUPS = {
  chat: ["customers", "messages"],
  other: [
    "catalog_items",
    "quotes",
    "orders",
    "support_tickets",
    "report_requests",
    "preset_reports",
    "app_settings",
    "bot_texts",
    "bot_steps",
    "acts_engineers",
    "acts_service_requests",
    "acts_reviews",
    "acts_review_reports",
  ],
} as const;
type Group = keyof typeof GROUPS;
// Stable row order for paged reads; tables not listed are keyed by "id".
const ORDER_BY: Record<string, string> = {
  catalog_items: "key",
  app_settings: "key",
  bot_texts: "key",
  preset_reports: "preset_title",
};

export const Route = createFileRoute("/api/public/jobs/github-backup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;

        const lovableKey = process.env["LOVABLE_API_KEY"];
        const ghKey = process.env["GITHUB_API_KEY"];
        if (!lovableKey || !ghKey) return new Response("GitHub not configured", { status: 500 });
        const headers = {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": ghKey,
          "Content-Type": "application/json",
        };
        type GitObj = { sha: string; object: { sha: string }; tree: { sha: string } };
        const gh = async (path: string, init?: RequestInit): Promise<GitObj> => {
          const res = await fetch(`${GATEWAY}/repos/${REPO}/${path}`, { ...init, headers });
          if (!res.ok) {
            const body = await res.text();
            console.error(`GitHub backup failed [${res.status}] ${path}: ${body}`);
            throw new Error(`GitHub [${res.status}] ${path}: ${body}`);
          }
          return (await res.json()) as GitObj;
        };

        let group: Group | undefined;
        try {
          const body = (await request.json()) as { group?: string };
          if (body?.group === "chat" || body?.group === "other") group = body.group;
        } catch {
          /* empty body → all tables */
        }
        const tables: readonly string[] = group ? GROUPS[group] : [...GROUPS.chat, ...GROUPS.other];

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const date = new Date().toISOString().slice(0, 10);

        // Count first, then read every 1000-row page in parallel (keeps the run short).
        const readTable = async (table: string) => {
          const t = table as "customers";
          const { count, error } = await supabaseAdmin.from(t).select("*", { count: "exact", head: true });
          if (error) throw new Error(`${table}: ${error.message}`);
          const pages = Math.max(1, Math.ceil((count ?? 0) / 1000));
          const parts = await Promise.all(
            Array.from({ length: pages }, async (_, i) => {
              const { data, error: e } = await supabaseAdmin
                .from(t)
                .select("*")
                .order((ORDER_BY[table] ?? "id") as "id")
                .range(i * 1000, i * 1000 + 999);
              if (e) throw new Error(`${table}: ${e.message}`);
              return data ?? [];
            }),
          );
          return parts.flat();
        };

        const [{ parent, baseTree }, files] = await Promise.all([
          gh("git/ref/heads/main").then(async (ref) => ({
            parent: ref.object.sha,
            baseTree: (await gh(`git/commits/${ref.object.sha}`)).tree.sha,
          })),
          Promise.all(
            tables.map(async (table) => {
              const rows = await readTable(table);
              const blob = await gh("git/blobs", {
                method: "POST",
                body: JSON.stringify({ content: JSON.stringify(rows), encoding: "utf-8" }),
              });
              return { table, count: rows.length, sha: blob.sha };
            }),
          ),
        ]);

        const tree = await gh("git/trees", {
          method: "POST",
          body: JSON.stringify({
            base_tree: baseTree,
            tree: files.map((f) => ({ path: `data/${f.table}.json`, mode: "100644", type: "blob", sha: f.sha })),
          }),
        });
        const summary = files.map((f) => `${f.table} (${f.count})`).join("، ");
        const commit = await gh("git/commits", {
          method: "POST",
          body: JSON.stringify({ message: `نسخة ${date}: ${summary}`, tree: tree.sha, parents: [parent] }),
        });
        await gh("git/refs/heads/main", { method: "PATCH", body: JSON.stringify({ sha: commit.sha }) });

        return Response.json({
          success: true,
          date,
          results: Object.fromEntries(files.map((f) => [f.table, f.count])),
        });
      },
    },
  },
});
