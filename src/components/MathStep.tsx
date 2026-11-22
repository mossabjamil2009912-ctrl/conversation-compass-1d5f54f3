import type { ReactNode } from "react";

// Renders a plain equation string ("a = ⌈b ÷ c⌉ × d") as visual math: stacked fractions and labelled rounding brackets.
const OPEN: Record<string, string> = { "(": ")", "⌈": "⌉", "⌊": "⌋" };

function splitTop(s: string, seps: string[]): string[] {
  const out: string[] = []; let depth = 0, cur = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (ch in OPEN) depth++; else if (Object.values(OPEN).includes(ch)) depth--;
    const sep = depth === 0 ? seps.find((x) => s.startsWith(x, i)) : undefined;
    if (sep) { out.push(cur, sep.trim()); cur = ""; i += sep.length - 1; } else cur += ch;
  }
  out.push(cur); return out;
}

function Atom({ s }: { s: string }): ReactNode {
  const t = s.trim();
  const o = t[0];
  if (o && OPEN[o] && t.endsWith(OPEN[o]!)) {
    let depth = 0, wraps = true;
    for (let i = 0; i < t.length - 1; i++) { if (t[i]! in OPEN) depth++; else if (Object.values(OPEN).includes(t[i]!)) depth--; if (depth === 0) { wraps = false; break; } }
    if (wraps) {
      const inner = <Expr s={t.slice(1, -1)} />;
      if (o === "(") return <span className="inline-flex items-center"><span className="text-base font-light">(</span>{inner}<span className="text-base font-light">)</span></span>;
      return (
        <span className="inline-flex flex-col items-center align-middle">
          <span className="inline-flex items-center rounded border border-primary/50 px-1">{inner}</span>
          <span className="text-[9px] text-primary">{o === "⌈" ? "↑ تقريب للأعلى" : "↓ تقريب للأسفل"}</span>
        </span>
      );
    }
  }
  return <span className="whitespace-nowrap">{t}</span>;
}

function Expr({ s }: { s: string }): ReactNode {
  const parts = splitTop(s, [" ÷ ", " × "]);
  const nodes: ReactNode[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    let node: ReactNode = <Atom s={parts[i]!} />;
    while (parts[i + 1] === "÷") {
      node = (
        <span className="mx-0.5 inline-flex flex-col items-center align-middle">
          <span className="px-1">{node}</span>
          <span className="h-px w-full bg-foreground" />
          <span className="px-1"><Atom s={parts[i + 2] ?? ""} /></span>
        </span>
      );
      i += 2;
    }
    nodes.push(<span key={i} className="inline-flex items-center">{node}</span>);
    if (parts[i + 1] === "×") nodes.push(<span key={`x${i}`} className="mx-1">×</span>);
  }
  return <span className="inline-flex flex-wrap items-center">{nodes}</span>;
}

export function MathStep({ s }: { s: string }) {
  if (!/[÷×⌈⌊]/.test(s)) return <div className="text-[11px] leading-relaxed">{s}</div>;
  const sides = splitTop(s, [" = ", "= "]).filter((x, i) => i % 2 === 0);
  return (
    <div dir="ltr" className="flex flex-wrap items-center justify-end gap-1 py-1 text-[12px] font-medium">
      {sides.map((x, i) => (
        <span key={i} className="inline-flex items-center gap-1">
          {i > 0 && <span className="mx-1 font-bold text-primary">=</span>}
          {x.trim() && <span dir="auto" className="inline-flex items-center"><Expr s={x} /></span>}
        </span>
      ))}
    </div>
  );
}
