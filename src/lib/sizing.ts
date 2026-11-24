// Full equation sizing for 8–20 kW (Low Voltage) and 30/50/80/125 kW (High Voltage) systems.
// Panels, inverter count and batteries come only from the equations + CRM catalog (no fixed presets).
import { F, maxPerString, stringCount, type Formulas, type EqItem } from "@/lib/formulas";

export type InvSpec = { key: string; name: string; kw: number; hv: boolean; three: boolean; price: number };
export type InvPick = InvSpec & { units: number; cost: number };
const LV_KW = [8, 12, 16, 20], HV_KW = [30, 50, 80, 125];

// Inverters in the catalog, parsed from the key: INV_*_<kw>K_<1P|3P>[_HV]. Cheapest per size + phase,
// or every brand per size + phase when allBrands (the customer then picks the brand).
export const brandOf = (key: string) => (key.match(/^INV_([A-Z]+)_/i)?.[1] ?? "").toUpperCase();
export function inverterSpecs(items: EqItem[], allBrands = false): InvSpec[] {
  const m = new Map<string, InvSpec>();
  for (const r of items) {
    if (r.category !== "inverters" || r.active === false || (r.kind ?? "item") !== "item" || r.price == null) continue;
    const kw = Number((r.key.match(/_(\d+)K_/) ?? [])[1] ?? 0), hv = /_HV$/i.test(r.key), three = hv || /_3P/i.test(r.key);
    if (!(hv ? HV_KW : LV_KW).includes(kw)) continue;
    const s = { key: r.key, name: r.name, kw, hv, three, price: Number(r.price) }, id = `${kw}-${three}-${hv}` + `-${brandOf(r.key)}`;
    if (!m.has(id) || m.get(id)!.price > s.price) m.set(id, s);
  }
  return [...m.values()].sort((a, b) => Number(a.hv) - Number(b.hv) || a.kw - b.kw || Number(a.three) - Number(b.three) || a.price - b.price);
}
// kWp = daily ÷ sun hours. Inverters needed = ⌈max(hourly load, kWp ÷ DC/AC ratio) ÷ kW⌉.
export const kwpOf = (need: number, f: Formulas = F) => need / f.sun;
// Usable panel kWp per inverter = datasheet max PV input (pvMax, editable) × pvSafety. No fixed ratios.
export const pvUsable = (s: Pick<InvSpec, "key" | "kw">, f: Formulas = F) => {
  const m = f.pvMax?.[s.key];
  return (m || s.kw) * f.pvSafety;
};
export const ratioOf = (s: Pick<InvSpec, "key" | "kw">, f: Formulas = F) => pvUsable(s, f) / s.kw;
// Panel-side count: target pvSafety, but one fewer inverter is enough while panels stay within the real datasheet max (pvMax).
export const pvUnits = (kwp: number, pvReal: number, safety: number) => { const n = Math.ceil(kwp / (pvReal * safety) - 1e-9); return n > 1 && kwp <= (n - 1) * pvReal + 1e-9 ? n - 1 : n; };
export const unitsFor = (s: InvSpec, need: number, loadKw = 0, f: Formulas = F) => Math.max(1, Math.ceil(loadKw / s.kw - 1e-9), pvUnits(kwpOf(need, f), f.pvMax?.[s.key] || s.kw, f.pvSafety));
// Low Voltage while the AC power needed stays within lvMaxKw; otherwise High Voltage. Never mixed.
// AC power for the LV/HV switch uses the largest LV three-phase inverter's real input ratio.
export const lvRatio = (f: Formulas = F) => { const k = Object.keys(f.pvMax).filter((x) => /_3P$/.test(x)).sort((a, b) => Number(b.match(/_(\d+)K_/)?.[1]) - Number(a.match(/_(\d+)K_/)?.[1]))[0]; const kw = Number(k?.match(/_(\d+)K_/)?.[1]); return k && kw ? (f.pvMax[k]! * f.pvSafety) / kw : f.pvSafety; };
export const isHvNeed = (need: number, loadKw = 0, f: Formulas = F) => Math.max(loadKw, kwpOf(need, f) / lvRatio(f)) > f.lvMaxKw + 1e-9;

// Option 2: the customer picks an inverter size, then the brand when that size exists in more than one brand.
// Returns every brand per size (cheapest first); group by kw to build the two steps.
export function inverterOptions(items: EqItem[], need: number, three: boolean, f: Formulas = F): InvPick[] {
  const hv = isHvNeed(need, 0, f);
  const fam = inverterSpecs(items, true).filter((s) => s.hv === hv);
  const ph = fam.some((s) => s.three === three) ? fam.filter((s) => s.hv || s.three === three) : fam;
  return ph.map((s) => { const units = unitsFor(s, need, 0, f); return { ...s, units, cost: units * s.price }; }).filter((p) => p.units <= f.maxInverters);
}
// Option 1: the customer gives the hourly load (kW) — cheapest inverter set that covers load and panels.
export function inverterForLoad(items: EqItem[], need: number, loadKw: number, three: boolean, f: Formulas = F): InvPick | null {
  const hv = isHvNeed(need, loadKw, f);
  const all = inverterSpecs(items).filter((s) => s.hv === hv);
  const ph = all.filter((s) => s.hv || s.three === three);
  const c = (ph.length ? ph : all).map((s) => { const units = unitsFor(s, need, loadKw, f); return { ...s, units, cost: units * s.price }; })
    .filter((p) => p.units <= f.maxInverters).sort((a, b) => a.cost - b.cost || a.units - b.units);
  return c[0] ?? null;
}
// Load given: every brand/size that covers the peak load and the panels (count included), cheapest first.
// The customer picks a size+count, then the brand when that size exists in more than one brand. Bot port: szLoadOptions.
export function inverterOptionsForLoad(items: EqItem[], need: number, loadKw: number, three: boolean, f: Formulas = F): InvPick[] {
  const hv = isHvNeed(need, loadKw, f);
  const all = inverterSpecs(items, true).filter((s) => s.hv === hv);
  const ph = all.filter((s) => s.hv || s.three === three);
  return (ph.length ? ph : all).map((s) => { const units = unitsFor(s, need, loadKw, f); return { ...s, units, cost: units * s.price }; })
    .filter((p) => p.units <= f.maxInverters).sort((a, b) => a.cost - b.cost || a.units - b.units);
}
// Panels = ⌈kWp × 1000 ÷ W⌉, rounded up so every string has the same count.
export function panelsFor(need: number, inv: InvPick, f: Formulas = F) {
  const raw = Math.max(1, Math.ceil((kwpOf(need, f) * 1000) / f.panelW - 1e-9));
  const strings = stringCount(raw, inv.hv ? "hv" : inv.three, inv.units, f);
  void maxPerString;
  return { panels: Math.ceil(raw / strings) * strings, strings };
}
// Batteries: night kWh = daily × night% ; count = ⌈(night − tolerance) ÷ (battery kWh × DoD)⌉ (HV at least hvMinBat).
// A shortfall up to batTol kWh is accepted instead of adding a whole battery.
export function batteriesFor(need: number, nightPct: number, hv: boolean, f: Formulas = F) {
  const n = Math.max(1, Math.ceil(((need * nightPct) / 100 - f.batTol) / (f.dod * f.batKwh) - 1e-9));
  return hv ? Math.max(f.hvMinBat, n) : n;
}
export const LV_BAT = "BAT_HITHIUM_16K_LV", HV_BAT = "BAT_HITHIUM_16K_HV", PANEL = "PV_SUNTECH_720";

// Builds the system's item list: template accessories (stand, DC box, AC panel, cable, MC4 …) are kept and
// later re-sized by applyEquations; inverter, panels and batteries come from the equations above.
export function buildSystem(template: [string, number][], items: EqItem[], need: number, nightPct: number, inv: InvPick, f: Formulas = F): [string, number][] {
  const cat = (k: string) => items.find((i) => i.key === k)?.category;
  const { panels } = panelsFor(need, inv, f);
  const bat = batteriesFor(need, nightPct, inv.hv, f);
  const rest = template.filter(([k]) => !["inverters", "panels", "batteries", "battery_controls"].includes(cat(k) ?? ""));
  return [[PANEL, panels], [inv.key, inv.units], [inv.hv ? HV_BAT : LV_BAT, bat], ...rest];
}
// Groups options by size (kw + phase): one entry per size, with all its brands (cheapest first).
export function groupBySize(opts: InvPick[]): { kw: number; three: boolean; hv: boolean; brands: InvPick[] }[] {
  const g: { kw: number; three: boolean; hv: boolean; brands: InvPick[] }[] = [];
  for (const o of opts) { const e = g.find((x) => x.kw === o.kw && x.three === o.three && x.hv === o.hv); if (e) e.brands.push(o); else g.push({ kw: o.kw, three: o.three, hv: o.hv, brands: [o] }); }
  return g;
}
export const BRAND_LABEL: Record<string, string> = { DEYE: "دايا", SOLIS: "سوليس" };
