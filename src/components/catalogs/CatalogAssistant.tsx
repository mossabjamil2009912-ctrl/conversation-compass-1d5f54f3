import { useEffect, useRef, useState } from "react";
import { ArrowUp, Loader2, Mic, Square, Volume2, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import logo from "@/assets/actes-logo.png";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGEST = ["كم قدرة لوح سنتك؟", "كم MPPT في سوليس 50؟", "سعة بطارية فيدوس 16؟"];

// Short spoken version (no tables/markdown) so the phone voice starts fast.
function speechText(t: string) {
  return t.split("\n").filter((l) => !l.trim().startsWith("|")).join(" ")
    .replace(/[*#_`>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 260);
}

/** Floating smart assistant for the catalogs: short, direct answers from the catalogs. */
export function CatalogAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [rec, setRec] = useState(false);
  const [playing, setPlaying] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const srRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);
  useEffect(() => { if ("speechSynthesis" in window) window.speechSynthesis.getVoices(); }, []);

  function stopAudio() {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setPlaying(null);
  }
  function speak(text: string, idx: number) {
    stopAudio();
    if (!("speechSynthesis" in window)) return;
    const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("ar"));
    const u = new SpeechSynthesisUtterance(speechText(text));
    if (voices[0]) { u.voice = voices[0]; u.lang = voices[0].lang; } else u.lang = "ar";
    u.rate = 1.1;
    u.onend = () => setPlaying((p) => (p === idx ? null : p));
    u.onerror = () => setPlaying((p) => (p === idx ? null : p));
    setPlaying(idx);
    window.speechSynthesis.speak(u);
  }

  // Device speech recognition: talk instead of typing (where the browser supports it).
  function toggleRec() {
    if (rec) { srRef.current?.stop(); return; }
    stopAudio();
    const W = window as unknown as Record<string, unknown>;
    const SR = (W["SpeechRecognition"] || W["webkitSpeechRecognition"]) as
      | (new () => { lang: string; interimResults: boolean; continuous: boolean;
          onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
          onend: () => void; onerror: () => void; start: () => void; stop: () => void })
      | undefined;
    if (!SR) { setMsgs((m) => [...m, { role: "assistant", content: "المتصفح لا يدعم الإدخال الصوتي، اكتب سؤالك." }]); return; }
    const r = new SR();
    r.lang = "ar-YE"; r.interimResults = false; r.continuous = false;
    let got = "";
    r.onresult = (e) => { got = Array.from(e.results).map((x) => x[0]?.transcript ?? "").join(" "); };
    r.onerror = () => {};
    r.onend = () => { setRec(false); srRef.current = null; if (got.trim()) void send(got, true); };
    try { r.start(); srRef.current = r; setRec(true); } catch { setRec(false); }
  }

  async function send(text: string, voice = false) {
    const q = text.trim();
    if (!q || busy) return;
    const next: Msg[] = [...msgs, { role: "user", content: q }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    try {
      const r = await fetch("/api/public/catalog-assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      if (!r.ok || !r.body) throw new Error();
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let out = "";
      setMsgs((m) => [...m, { role: "assistant", content: "" }]);
      setBusy(false);
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        out += dec.decode(value, { stream: true });
        const t = out;
        setMsgs((m) => { const c = [...m]; c[c.length - 1] = { role: "assistant", content: t }; return c; });
      }
      if (voice && out) speak(out, next.length);
    } catch {
      setMsgs((m) => [...m, { role: "assistant", content: navigator.onLine ? "عذراً، حدث خطأ. حاول مرة أخرى." : "المساعد يحتاج اتصالاً بالإنترنت." }]);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} aria-label="المساعد الذكي"
        className="fixed bottom-5 left-5 z-40 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-[3px] border-foreground bg-card p-1.5 shadow-lg ring-2 ring-primary/40 ring-offset-2 ring-offset-background transition-transform hover:scale-105">
        <img src={logo} alt="ACTES" className="h-full w-full object-contain" />
      </button>
    );
  }

  return (
    <div dir="rtl" className="fixed inset-x-3 bottom-3 z-50 flex h-[78vh] flex-col overflow-hidden rounded-2xl border border-border bg-background text-foreground shadow-2xl sm:inset-x-auto sm:left-5 sm:w-[400px]">
      <div className="flex items-center justify-between bg-ink px-4 py-3 text-ink-foreground">
        <div className="flex items-center gap-2 font-semibold">
          <img src={logo} alt="" className="h-7 w-7 rounded-full bg-card object-contain p-0.5" />
          المساعد الذكي
        </div>
        <button onClick={() => { stopAudio(); setOpen(false); }} aria-label="إغلاق" className="rounded-lg p-1 opacity-80 hover:opacity-100">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {msgs.length === 0 && (
          <div className="space-y-3 pt-4 text-center">
            <p className="text-sm text-muted-foreground">اسأل عن أي منتج أو مواصفة — إجابة مختصرة من الكتالوجات.</p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGEST.map((s) => (
                <button key={s} onClick={() => void send(s)} className="rounded-full border border-border bg-card px-3 py-1.5 text-xs hover:border-primary">{s}</button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
            <div className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${m.role === "user" ? "bg-primary text-primary-foreground" : "border border-border bg-card"}`}>
              {m.role === "assistant" ? (
                <>
                  <div className="prose-sm [&_strong]:font-bold [&_table]:my-1 [&_table]:w-full [&_td]:border [&_td]:border-border [&_td]:px-1.5 [&_th]:border [&_th]:border-border [&_th]:px-1.5 [&_ul]:list-disc [&_ul]:pr-4">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content || "…"}</ReactMarkdown>
                  </div>
                  {m.content && (
                    <button onClick={() => (playing === i ? stopAudio() : speak(m.content, i))} aria-label="استماع" className="mt-1 text-muted-foreground hover:text-primary">
                      {playing === i ? <Square className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                    </button>
                  )}
                </>
              ) : m.content}
            </div>
          </div>
        ))}
        {busy && <div className="flex justify-end"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>}
        <div ref={endRef} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); void send(input); }} className="flex items-center gap-2 border-t border-border p-2">
        <button type="button" onClick={toggleRec} aria-label="تحدث" className={`rounded-full p-2.5 ${rec ? "bg-destructive text-destructive-foreground" : "bg-muted text-foreground"}`}>
          {rec ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={rec ? "أستمع…" : "اكتب سؤالك…"}
          className="min-w-0 flex-1 rounded-full border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-primary" />
        <button type="submit" disabled={!input.trim() || busy} aria-label="إرسال" className="rounded-full bg-primary p-2.5 text-primary-foreground disabled:opacity-40">
          <ArrowUp className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
