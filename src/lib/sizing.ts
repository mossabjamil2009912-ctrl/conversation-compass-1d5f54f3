// Full equation sizing for 8–20 kW (Low Voltage) and 30/50/80/125 kW (High Voltage) systems.
// Panels, inverter count and batteries come only from the equations + CRM catalog (no fixed presets).
import { F, maxPerString, stringCount, type Formulas, type EqItem } from "@/lib/formulas";

export type InvSpec = { key: string; name: string; kw: number; hv: boolean; three: boolean; price: number };
export type InvPick = InvSpec & { units: number; cost: number };
const LV_KW = [8, 12, 16, 20], HV_KW = [30, 50, 80, 125];

// Inverters in the catalog (cheapest per size + phase), parsed from the key: INV_*_<kw>K_<1P|3P>[_HV].
export function inverterSpecs(items: EqItem[]): InvSpec[] {
  const m = new Map<string, InvSpec>();
  for (const r of items) {
    if (r.category !== "inverters" || r.active === false || (r.kind ?? "item") !== "item" || r.price == null) continue;
    const kw = Number((r.key.match(/_(\d+)K_/) ?? [])[1] ?? 0), hv = /_HV$/i.test(r.key), three = hv || /_3P/i.test(r.key);
    if (!(hv ? HV_KW : LV_KW).includes(kw)) continue;
    const s = { key: r.key, name: r.name, kw, hv, three, price: Number(r.price) }, id = `${kw}-${three}-${hv}`;
    if (!m.has(id) || m.get(id)!.price > s.price) m.set(id, s);
  }
  return [...m.values()].sort((a, b) => Number(a.hv) - Number(b.hv) || a.kw - b.kw || Number(a.three) - Number(b.three));
}
// kWp = daily ÷ sun hours. Inverters needed = ⌈max(hourly load, kWp ÷ DC/AC ratio) ÷ kW⌉.
export const kwpOf = (need: number, f: Formulas = F) => need / f.sun;
// DC/AC ratio depends on the brand: Solis accepts more panels per kW than Deye.
export const ratioOf = (s: Pick<InvSpec, "key">, f: Formulas = F) => (/SOLIS/i.test(s.key) ? f.dcRatioSolis : f.dcRatio);
export const unitsFor = (s: InvSpec, need: number, loadKw = 0, f: Formulas = F) => Math.max(1, Math.ceil(Math.max(loadKw, kwpOf(need, f) / ratioOf(s, f)) / s.kw - 1e-9));
// Low Voltage while the AC power needed stays within lvMaxKw; otherwise High Voltage. Never mixed.
export const isHvNeed = (need: number, loadKw = 0, f: Formulas = F) => Math.max(loadKw, kwpOf(need, f) / f.dcRatio) > f.lvMaxKw + 1e-9;

// Option 2: the customer picks an inverter — every size of the matching family, repeated up to maxInverters.
export function inverterOptions(items: EqItem[], need: number, three: boolean, f: Formulas = F): InvPick[] {
  const hv = isHvNeed(need, 0, f);
  const fam = inverterSpecs(items).filter((s) => s.hv === hv);
  const ph = fam.some((s) => s.three === three) ? fam.filter((s) => s.hv || s.three === three) : fam;
  return ph.map((s) => { const units = unitsFor(s, need, 0, f); return { ...s, units, cost: units * s.price }; }).filter((p) => p.units <= f.maxInverters);
}
// Option 1: the customer gives the hourly load (kW) — cheapest inverter set that covers load and panels.
export function inverterForLoad(items: EqItem[], need: number, loadKw: number, three: boolean, f: Formulas = F): InvPick | null {
  const all = inverterSpecs(items);
  const ph = all.filter((s) => s.hv || s.three === three);
  const c = (ph.length ? ph : all).map((s) => { const units = unitsFor(s, need, loadKw, f); return { ...s, units, cost: units * s.price }; })
    .filter((p) => p.units <= f.maxInverters).sort((a, b) => a.cost - b.cost || a.units - b.units);
  return c[0] ?? null;
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
