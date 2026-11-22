import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Ban, RotateCcw, Trash2, X } from "lucide-react";
import { deleteChat, getMessages, listDeletedChats, restoreChat } from "@/lib/crm.functions";
import { offlineQuery } from "@/lib/offline-cache";

/** Press-and-hold handlers. `fired()` is true right after a long press, so the click that follows can be ignored. */
export function useLongPress(ms: number, onLong: () => void) {
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const done = useRef(false);
  const cancel = () => { if (t.current) clearTimeout(t.current); t.current = null; };
  return {
    fired: () => { const f = done.current; done.current = false; return f; },
    handlers: {
      onPointerDown: () => { done.current = false; cancel(); t.current = setTimeout(() => { done.current = true; onLong(); }, ms); },
      onPointerUp: cancel, onPointerLeave: cancel, onPointerCancel: cancel,
      onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); if (ms < 2000) { cancel(); done.current = true; onLong(); } },
    },
  };
}

type Target = { id: string; name: string | null; phone: string };

/** Long-press menu on a chat: delete (hidden on every device) or delete permanently (number blocked). */
export function ChatActions({ pw, c, onClose, onDone }: { pw: string; c: Target; onClose: () => void; onDone: () => void }) {
  const del = useServerFn(deleteChat);
  const qc = useQueryClient();
  const [ask, setAsk] = useState<null | boolean>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const run = async (block: boolean) => {
    setBusy(true); setErr("");
    try {
      await del({ data: { pw, id: c.id, block } });
      qc.setQueryData<Target[]>(["customers"], (old) => old?.filter((x) => x.id !== c.id));
      void qc.invalidateQueries({ queryKey: ["customers"] });
      void qc.invalidateQueries({ queryKey: ["deleted-chats"] });
      onDone();
    } catch (e) { setErr(e instanceof Error ? e.message : "تعذّر الحذف"); setBusy(false); }
  };
  const label = c.name || `+${c.phone.replace(/^\+/, "")}`;
  return (
    <div dir="rtl" className="fixed inset-0 z-[70] flex items-end justify-center bg-foreground/40 p-4 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-sm space-y-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="truncate font-bold">{label}</h2>
          <button onClick={onClose} aria-label="إغلاق"><X className="h-4 w-4" /></button>
        </div>
        {ask === null ? (
          <>
            <button disabled={busy} onClick={() => setAsk(false)} className="flex w-full items-start gap-3 rounded-lg border border-border p-3 text-right hover:bg-muted disabled:opacity-50">
              <Trash2 className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <span><span className="block text-sm font-bold">حذف</span><span className="block text-xs text-muted-foreground">تختفي من كل الأجهزة، وتعود كمحادثة جديدة إذا راسل العميل مرة أخرى</span></span>
            </button>
            <button disabled={busy} onClick={() => setAsk(true)} className="flex w-full items-start gap-3 rounded-lg bg-destructive p-3 text-right text-destructive-foreground disabled:opacity-50">
              <Ban className="mt-0.5 h-5 w-5 shrink-0" />
              <span><span className="block text-sm font-bold">حذف نهائياً</span><span className="block text-xs opacity-90">تختفي من كل الأجهزة ولا تظهر رسائل هذا الرقم مرة أخرى</span></span>
            </button>
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-sm">{ask ? "حذف المحادثة نهائياً وإخفاء أي رسالة قادمة من هذا الرقم؟" : "حذف المحادثة من كل الأجهزة؟"}</p>
            <p className="text-xs text-muted-foreground">يمكنك استعادتها لاحقاً بالضغط 5 ثوانٍ على «المحادثات».</p>
            <div className="flex gap-2">
              <button disabled={busy} onClick={() => setAsk(null)} className="flex-1 rounded-lg border border-border px-3 py-2 text-sm">رجوع</button>
              <button disabled={busy} onClick={() => run(ask)} className="flex-1 rounded-lg bg-destructive px-3 py-2 text-sm font-bold text-destructive-foreground disabled:opacity-50">{busy ? "جارٍ الحذف..." : "تأكيد"}</button>
            </div>
          </div>
        )}
        {err && <p className="text-sm text-destructive">{err}</p>}
      </div>
    </div>
  );
}

/** Hidden archive (hold "المحادثات" 5 s): read deleted/blocked chats and bring them back. */
export function DeletedChats({ pw, onClose }: { pw: string; onClose: () => void }) {
  const list = useServerFn(listDeletedChats);
  const restore = useServerFn(restoreChat);
  const qc = useQueryClient();
  const { data: rows = [], isLoading, refetch } = useQuery(offlineQuery({ queryKey: ["deleted-chats"], queryFn: () => list({ data: { pw } }) }));
  const [tab, setTab] = useState<"deleted" | "blocked">("deleted");
  const [view, setView] = useState<(typeof rows)[number] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const shown = rows.filter((r) => (tab === "blocked") === !!r.blocked);
  const back = async (id: string) => {
    setBusy(id); setErr("");
    try {
      await restore({ data: { pw, id } });
      await refetch();
      void qc.invalidateQueries({ queryKey: ["customers"] });
      setView(null);
    } catch (e) { setErr(e instanceof Error ? e.message : "تعذّرت الاستعادة"); }
    setBusy(null);
  };
  return (
    <div dir="rtl" className="fixed inset-0 z-[70] flex items-center justify-center bg-foreground/40 p-3" onClick={onClose}>
      <div className="flex h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border p-3">
          {view ? (
            <button onClick={() => setView(null)} className="flex items-center gap-1 text-sm font-bold"><ArrowRight className="h-4 w-4" />{view.name || `+${view.phone}`}</button>
          ) : <h2 className="font-bold">المحادثات المحذوفة</h2>}
          <button onClick={onClose} aria-label="إغلاق"><X className="h-4 w-4" /></button>
        </div>
        {view ? (
          <>
            <ArchivedMessages pw={pw} id={view.id} />
            <div className="border-t border-border p-3">
              <button disabled={busy === view.id} onClick={() => back(view.id)} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">
                <RotateCcw className="h-4 w-4" />{busy === view.id ? "جارٍ الاستعادة..." : "استعادة المحادثة"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex gap-2 p-3 pb-0">
              {(["deleted", "blocked"] as const).map((k) => (
                <button key={k} onClick={() => setTab(k)} className={`flex-1 rounded-lg px-3 py-1.5 text-sm ${tab === k ? "bg-primary font-bold text-primary-foreground" : "bg-muted"}`}>
                  {k === "deleted" ? "محذوفة" : "محذوفة نهائياً"} ({rows.filter((r) => (k === "blocked") === !!r.blocked).length})
                </button>
              ))}
            </div>
            <ul className="flex-1 overflow-y-auto p-3">
              {shown.map((r) => (
                <li key={r.id} className="flex items-center gap-2 border-b border-border py-2 last:border-b-0">
                  <button onClick={() => setView(r)} className="min-w-0 flex-1 text-right">
                    <div className="truncate text-sm font-bold">{r.name || `+${r.phone}`}</div>
                    <div dir="ltr" className="text-right text-xs text-muted-foreground">+{r.phone.replace(/^\+/, "")}</div>
                    <div className="truncate text-xs text-muted-foreground">{r.last_message}</div>
                  </button>
                  <button disabled={busy === r.id} onClick={() => back(r.id)} className="flex shrink-0 items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs font-semibold disabled:opacity-50">
                    <RotateCcw className="h-3.5 w-3.5" />استعادة
                  </button>
                </li>
              ))}
              {!isLoading && shown.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">لا توجد محادثات هنا</li>}
            </ul>
          </>
        )}
        {err && <p className="px-3 pb-3 text-sm text-destructive">{err}</p>}
      </div>
    </div>
  );
}

function ArchivedMessages({ pw, id }: { pw: string; id: string }) {
  const get = useServerFn(getMessages);
  const { data: msgs = [], isLoading } = useQuery(offlineQuery({ queryKey: ["messages-all", id], queryFn: () => get({ data: { pw, id, all: true } }) }));
  return (
    <div className="flex-1 space-y-1.5 overflow-y-auto bg-muted/40 p-3">
      {isLoading && <p className="text-center text-sm text-muted-foreground">جارٍ التحميل...</p>}
      {!isLoading && msgs.length === 0 && <p className="text-center text-sm text-muted-foreground">لا توجد رسائل</p>}
      {msgs.map((m) => (
        <div key={m.id} className={`flex ${m.direction === "customer" ? "justify-end" : "justify-start"}`}>
          <div className={`max-w-[85%] whitespace-pre-wrap break-words rounded-lg px-2.5 py-1.5 text-sm shadow ${m.direction === "customer" ? "bg-primary/15" : "bg-card"}`}>
            {m.text || (m.file_name ? `📎 ${m.file_name}` : "")}
            <div className="mt-0.5 text-left text-[10px] text-muted-foreground">{new Date(m.created_at).toLocaleString("ar", { dateStyle: "short", timeStyle: "short" })}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
