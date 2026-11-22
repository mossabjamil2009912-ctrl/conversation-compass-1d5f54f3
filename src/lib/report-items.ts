// Pulls the real equipment of a request's system from the quote table (BOT_PRESETS),
// so PVsyst/SLD never invent brands, models or breaker ratings.
import { BOT_PRESETS, type BotLine } from "@/lib/bot-presets";

const BRANDS: [RegExp, string][] = [
  [/ليو\s*باور/, "LeoPower"], [/دايا|ديي|deye/i, "Deye"], [/بايلونتك|pylontech/i, "Pylontech"],
  [/هيثيوم|huthium|hithium/i, "Hithium"], [/سنتك|suntech/i, "Suntech"], [/سولس|solis/i, "Solis"],
];
const brandOf = (s: string) => BRANDS.find(([r]) => r.test(s))?.[1] ?? "";
const modelOf = (l: BotLine) => {
  for (const sp of l.specs) { const m = sp.match(/(?:الموديل|موديل)\s*:\s*(.+)/); if (m) return m[1]!.trim(); }
  return "";
};
const latin = (s: string) => s.replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim();

export type ReportItems = {
  inverter?: { brand: string; model: string; qty: number };
  battery?: { brand: string; model: string; qty: number };
  panel?: { brand: string; model: string };
  dcBox?: string[]; // e.g. ["DC MCB 2P 1000V 32A"]
  acBoard?: boolean;
  cableMm2?: number;
  spd?: boolean; // surge arrester present in the quote
  rcd?: boolean; // residual-current device present in the quote
};

const norm = (s: string) => s.replace(/[–—-]/g, "-").replace(/\s+/g, " ").trim();

export function findPreset(label: string | null | undefined) {
  if (!label) return undefined;
  const l = norm(label);
  return [...BOT_PRESETS].sort((a, b) => b.title.length - a.title.length).find((p) => l.startsWith(norm(p.title)) || l.includes(norm(p.title)));
}

export function reportItems(label: string | null | undefined): ReportItems {
  const p = findPreset(label);
  if (!p) return {};
  const out: ReportItems = {};
  for (const l of p.lines) {
    const n = l.name;
    const all = [n, ...l.specs].join(" ");
    if (/مانع\s*(ال)?صواعق|SPD|surge/i.test(all)) out.spd = true;
    if (/RCD|تفاضلي|RCCB|ELCB/i.test(all)) out.rcd = true;
    if (/إنفرتر|انفرتر/.test(n)) out.inverter = { brand: brandOf(n), model: latin(modelOf(l)) || brandOf(n), qty: l.qty };
    else if (/بطارية/.test(n)) out.battery = { brand: brandOf(n), model: latin(modelOf(l)), qty: l.qty };
    else if (/الواح|ألواح/.test(n)) out.panel = { brand: brandOf(n), model: latin(modelOf(l)) };
    else if (/صندوق حماية|DC/.test(n) && !/كابل/.test(n)) out.dcBox = l.specs.map(latin).filter((s) => /\d/.test(s));
    else if (/لوحة حماية|حماية كهرباء/.test(n)) out.acBoard = true;
    else if (/كابل/.test(n)) { const m = n.match(/(\d+)\s*مم/); if (m) out.cableMm2 = Number(m[1]); }
  }
  return out;
}
