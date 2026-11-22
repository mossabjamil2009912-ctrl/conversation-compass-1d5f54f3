// Editable sizing factors ("المعادلات" screen). Saved in app_settings key `formulas` (text_value JSON),
// sent to the bot as FORMULAS in bot-catalog, and applied live in QuoteBuilder — one set of values for app and bot.
export type Formulas = {
  days: number;          // days per month for daily need
  sun: number;           // peak sun hours per day
  dod: number;           // usable battery share
  night: { 30: number; 50: number; 70: number }; // night % used for each day/night choice
  resRanges: number[][]; // residential preset ranges (kWh/day), same order as residential presets
  dcMaxLines: number;    // largest DC box (lines)
  dcStep: number;        // DC box line step
  acSingleV: number;     // single-phase voltage
  acThreeDiv: number;    // √3 × 380
  acSafety: number;      // breaker safety factor
  cableM: number;        // cable metres per system
  mc4PerString: number;  // MC4 sets per string
  panelVoc: number;      // panel open-circuit voltage (V)
  coldFactor: number;    // Voc rise in cold
  vmaxSingle: number;    // single-phase inverter max DC voltage
  vmaxThree: number;     // three-phase LV inverter max DC voltage
  vmaxHV: number;        // high-voltage inverter max DC voltage
  hvMinBat: number;      // HV batteries come in steps of this many (min series)
  hvBatPerBcu: number;   // HV batteries per BCU controller
  ebcOver: number;       // a BCU group needs an EBC when it holds more than this many batteries
  panelW: number;        // panel watts used for panel count
  pvMax: Record<string, number>; // max panel input (kWp) per inverter key, from each datasheet (every inverter must have one)
  pvSafety: number;      // share of pvMax actually used (safety margin), e.g. 0.9
  lvMaxKw: number;       // above this AC power → High Voltage family
  maxInverters: number;  // most inverters in parallel
  batKwh: number;        // battery size (kWh) for battery count
  mode: "eq" | "ranges"; // 8–125 kW: sized by equations or by ready-made ranges (app + bot)
  batTol: number;        // night kWh shortfall accepted before adding a battery
  cabKwh: number;        // Hithium 112C cabinet kWh
  m1Kwh: number;         // Pylontech M1 battery kWh
  m5Kwh: number;         // Pylontech M5 battery kWh
  cabTol: number;        // a cabinet option shows only when capacity is within ± this of n × cabinet kWh
  m1MaxKwh: number;      // derived: m1MaxBat × m1Kwh (largest M1 bank before Pylontech switches to M5)
  m1MinBat: number;      // fewest Pylontech M1 batteries
  m1RackSmall: number;   // M1 batteries per rack up to this → small rack (13), else big rack (23)
  m1MaxBat: number;      // most M1 batteries in one (big) rack
  m5MinBat: number;      // fewest Pylontech M5 batteries
  m5RackSmall: number;   // M5 batteries per rack up to this → 11-rack
  m5RackMedium: number;  // up to this → 16-rack, else 20-rack
  m5MaxBat: number;      // most M5 batteries in one (big) rack
  presetItems: Record<string, [string, number][]>; // edited ready-made system items (catalog key, qty) by preset title; missing = original
  comRanges: Record<string, number>; // ranges mode: commercial system range (kWh/day) by comKey; missing = panels × W × sun
};
// Commercial system id shared with the bot (INV_TABLE rows): inverter kW - phase (1|3, HV = 3) - panels.
export const comKey = (kw: number, three: boolean, panels: number) => `${kw}-${three ? 3 : 1}-${panels}`;
export const DEFAULT_FORMULAS: Formulas = {
  days: 26, sun: 5, dod: 0.85, night: { 30: 30, 50: 50, 70: 70 },
  resRanges: [[1.2], [2.5], [2.5], [4], [4], [5, 7.5], [13], [21], [31.7], [35.6], [55.4], [63.4], [71.3], [83.2], [106.9]],
  dcMaxLines: 10, dcStep: 2, acSingleV: 220, acThreeDiv: 658, acSafety: 1.25, cableM: 1, mc4PerString: 1,
  panelVoc: 48.5, coldFactor: 1.1, vmaxSingle: 500, vmaxThree: 800,
  vmaxHV: 1000, hvMinBat: 4, hvBatPerBcu: 15, ebcOver: 7,
  panelW: 720, pvSafety: 0.9, pvMax: { INV_DEYE_8K_1P: 12.8, INV_DEYE_12K_1P: 19.2, INV_DEYE_12K_3P: 15.6, INV_DEYE_16K_1P: 25.6, INV_DEYE_16K_3P: 24, INV_DEYE_20K_3P: 30, INV_DEYE_30K_3P_HV: 39, INV_DEYE_50K_3P_HV: 65, INV_DEYE_80K_3P_HV: 128, INV_DEYE_125K_3P_HV: 200, INV_SOLIS_30K_3P_HV: 60, INV_SOLIS_50K_3P_HV: 96, INV_SOLIS_80K_3P_HV: 160, INV_SOLIS_125K_3P_HV: 250 }, lvMaxKw: 25, maxInverters: 5, batKwh: 16, batTol: 1, cabKwh: 112, m1Kwh: 4.74, m5Kwh: 15.68, m1MaxKwh: 109.02, m1MinBat: 6, m1RackSmall: 13, m1MaxBat: 23, m5MinBat: 7, m5RackSmall: 11, m5RackMedium: 16, m5MaxBat: 20, cabTol: 5, mode: "eq", comRanges: {}, presetItems: {},
};
export const F: Formulas = structuredClone(DEFAULT_FORMULAS);
export const mergeFormulas = (v: unknown): Formulas => {
  const o = (v && typeof v === "object" ? v : {}) as Partial<Formulas>;
  const num = (x: unknown, d: number) => (typeof x === "number" && isFinite(x) && x > 0 ? x : d);
  const D = DEFAULT_FORMULAS;
  return {
    days: num(o.days, D.days), sun: num(o.sun, D.sun), dod: num(o.dod, D.dod),
    night: { 30: num(o.night?.[30], 30), 50: num(o.night?.[50], 50), 70: num(o.night?.[70], 70) },
    resRanges: Array.isArray(o.resRanges) && o.resRanges.length === D.resRanges.length ? o.resRanges.map((r, i) => (Array.isArray(r) && r.every((x) => typeof x === "number") ? r : D.resRanges[i]!)) : D.resRanges,
    dcMaxLines: num(o.dcMaxLines, D.dcMaxLines), dcStep: num(o.dcStep, D.dcStep), acSingleV: num(o.acSingleV, D.acSingleV),
    acThreeDiv: num(o.acThreeDiv, D.acThreeDiv), acSafety: num(o.acSafety, D.acSafety), cableM: num(o.cableM, D.cableM), mc4PerString: num(o.mc4PerString, D.mc4PerString), 
    panelVoc: num(o.panelVoc, D.panelVoc), coldFactor: num(o.coldFactor, D.coldFactor), vmaxSingle: num(o.vmaxSingle, D.vmaxSingle), vmaxThree: num(o.vmaxThree, D.vmaxThree),
    vmaxHV: num(o.vmaxHV, D.vmaxHV), hvMinBat: num(o.hvMinBat, D.hvMinBat), hvBatPerBcu: num(o.hvBatPerBcu, D.hvBatPerBcu), ebcOver: num(o.ebcOver, D.ebcOver),
    panelW: num(o.panelW, D.panelW), pvSafety: num(o.pvSafety, D.pvSafety), pvMax: { ...D.pvMax, ...Object.fromEntries(Object.entries(o.pvMax && typeof o.pvMax === "object" ? o.pvMax : {}).filter(([, x]) => typeof x === "number" && isFinite(x) && x > 0)) }, lvMaxKw: num(o.lvMaxKw, D.lvMaxKw), maxInverters: num(o.maxInverters, D.maxInverters), batKwh: num(o.batKwh, D.batKwh), batTol: typeof o.batTol === "number" && o.batTol >= 0 ? o.batTol : D.batTol,
    cabKwh: num(o.cabKwh, D.cabKwh), m1Kwh: num(o.m1Kwh, D.m1Kwh), m5Kwh: num(o.m5Kwh, D.m5Kwh), m1MaxKwh: num(o.m1MaxBat, D.m1MaxBat) * num(o.m1Kwh, D.m1Kwh), cabTol: num(o.cabTol, D.cabTol),
    m1MinBat: num(o.m1MinBat, D.m1MinBat), m1RackSmall: num(o.m1RackSmall, D.m1RackSmall), m1MaxBat: num(o.m1MaxBat, D.m1MaxBat),
    m5MinBat: num(o.m5MinBat, D.m5MinBat), m5RackSmall: num(o.m5RackSmall, D.m5RackSmall), m5RackMedium: num(o.m5RackMedium, D.m5RackMedium), m5MaxBat: num(o.m5MaxBat, D.m5MaxBat),
    mode: o.mode === "ranges" ? "ranges" : "eq",
    presetItems: Object.fromEntries(Object.entries(o.presetItems && typeof o.presetItems === "object" ? o.presetItems : {}).filter(([, l]) => Array.isArray(l) && l.length > 0 && l.every((x) => Array.isArray(x) && typeof x[0] === "string" && typeof x[1] === "number" && x[1] > 0))) as Record<string, [string, number][]>,
    comRanges: Object.fromEntries(Object.entries(o.comRanges && typeof o.comRanges === "object" ? o.comRanges : {}).filter(([, x]) => typeof x === "number" && isFinite(x) && x > 0)),
  };
};
// Strings (Voc): max per string = ⌊Vmax ÷ (Voc × cold)⌋; strings = ⌈panels ÷ max⌉ (at least one per inverter).
// `three` may be "hv" for high-voltage inverters (vmaxHV).
export type Phase = boolean | "hv";
export const maxPerString = (three: Phase, f: Formulas = F) => Math.max(1, Math.floor((three === "hv" ? f.vmaxHV : three ? f.vmaxThree : f.vmaxSingle) / (f.panelVoc * f.coldFactor)));
export const stringCount = (panels: number, three: Phase, inverters = 1, f: Formulas = F) => Math.max(inverters, Math.ceil(panels / maxPerString(three, f)));
// HV battery accessories: at least hvMinBat batteries; BCU = ⌈n ÷ perBcu⌉ (full groups first, remainder last);
// EBC = number of groups holding more than ebcOver batteries; DC protection = BCU.
export const hvAccessories = (bat: number, f: Formulas = F) => {
  const n = Math.max(f.hvMinBat, Math.ceil(bat));
  const bcu = Math.ceil(n / f.hvBatPerBcu);
  const last = n - (bcu - 1) * f.hvBatPerBcu;
  const ebc = (bcu - 1) * (f.hvBatPerBcu > f.ebcOver ? 1 : 0) + (last > f.ebcOver ? 1 : 0);
  return { bat: n, bcu, ebc, bdc: bcu };
};
export const applyFormulas = (v: unknown) => Object.assign(F, mergeFormulas(v));
// DC box: qty = ⌈N / max⌉, lines = ⌈(N/qty)/step⌉ × step.
export const dcBoxes = (strings: number, f: Formulas = F) => {
  const qty = Math.max(1, Math.ceil(strings / f.dcMaxLines));
  return { qty, lines: Math.ceil(strings / qty / f.dcStep) * f.dcStep };
};
// AC breaker amps = W / V × safety (single) or W / (√3×380) × safety (three).
export const acBreakerAmps = (watts: number, three: boolean, f: Formulas = F) => (watts / (three ? f.acThreeDiv : f.acSingleV)) * f.acSafety;

// ===== Equation-driven items (ported 1:1 to the bot as ACTES_EQUATIONS) =====
// Rewrites a system's DC boxes, AC panel, cable and MC4 lines from the equations,
// always picking the item from the CRM catalog (never from code). Other lines are untouched.
export type EqItem = { key: string; name: string; unit: string | null; price: number | string | null; category: string; specs?: unknown; active?: boolean; kind?: string };
export type EqLine = { key: string; name: string; unit: string | null; price: number; qty: number; specs: string[]; auto?: boolean };
const specsOfItem = (r: EqItem) => (Array.isArray(r.specs) ? (r.specs as unknown[]).map(String) : []);
export function applyEquations<L extends EqLine>(lines: L[], items: EqItem[], keyOf: (l: L) => string | null, f: Formulas = F): L[] {
  const ok = items.filter((i) => i.active !== false && (i.kind ?? "item") === "item");
  const find = (k: string) => ok.find((i) => i.key === k);
  const itemOf = (l: L) => find(l.key) ?? (keyOf(l) ? find(keyOf(l)!) : undefined);
  const cat = lines.map(itemOf);
  const invQty = lines.reduce((s, l, i) => s + (cat[i]?.category === "inverters" ? l.qty : 0), 0);
  const panels = lines.reduce((s, l, i) => s + (cat[i]?.category === "panels" ? l.qty : 0), 0);
  if (!invQty || !panels) return lines;
  const invText = lines.map((l, i) => (cat[i]?.category === "inverters" ? `${l.name} ${cat[i]?.name} ${l.key} ${l.specs.join(" ")}` : "")).join(" ");
  const hv = /جهد عالي|_HV\b|\bHV\b/i.test(invText);
  const three: Phase = hv ? "hv" : /ثري|3\s*فاز|three|LP3|SG0\dLP3/i.test(invText);
  const strings = stringCount(panels, three, invQty, f);
  // HV batteries → BCU / EBC / DC protection from the equation (items from the catalog only).
  const hvBat = lines.reduce((s, l, i) => s + (cat[i]?.category === "batteries" && /HV|هاي فولتج/i.test(`${l.key} ${cat[i]?.name}`) ? l.qty : 0), 0);
  const acc = hv && hvBat ? hvAccessories(hvBat, f) : null;
  const ACC: [RegExp, keyof NonNullable<typeof acc>][] = [[/ebc/i, "ebc"], [/^ctrl_/i, "bcu"], [/protect/i, "bdc"]];
  if (acc) {
    const seen = new Set<string>();
    lines = lines.map((l, i) => {
      const r = cat[i];
      if (r?.category === "batteries" && /HV|هاي فولتج/i.test(`${l.key} ${r.name}`)) return { ...l, qty: acc.bat };
      if (r?.category === "battery_controls") { const m = ACC.find(([re]) => re.test(r.key)); if (m) { seen.add(m[1]); return { ...l, qty: acc[m[1]] }; } }
      return l;
    }).filter((l, i) => !(cat[i]?.category === "battery_controls" && l.qty === 0));
    const add = (re: RegExp, want: keyof typeof acc) => {
      if (seen.has(want) || !acc[want]) return;
      const r = ok.find((x) => x.category === "battery_controls" && re.test(x.key) && (want !== "bcu" || !/ebc/i.test(x.key)));
      if (r) lines = [...lines, { ...lines[0]!, key: r.key, name: r.name, unit: r.unit, price: Number(r.price ?? 0), qty: acc[want], specs: specsOfItem(r), auto: false }];
    };
    for (const [re, w] of ACC) add(re, w);
  }
  return applyEquationsInner(lines, ok, keyOf, f, strings, invQty);
}
function applyEquationsInner<L extends EqLine>(lines: L[], ok: EqItem[], keyOf: (l: L) => string | null, f: Formulas, strings: number, invQty: number): L[] {
  const find = (k: string) => ok.find((i) => i.key === k);
  const cat = lines.map((l) => find(l.key) ?? (keyOf(l) ? find(keyOf(l)!) : undefined));
  const as = (l: L, r: EqItem, qty: number): L => ({ ...l, key: r.key, name: r.name, unit: r.unit, price: Number(r.price ?? 0), qty, specs: specsOfItem(r).length ? specsOfItem(r) : l.specs });
  const out: L[] = [];
  let dcDone = false;
  lines.forEach((l, i) => {
    const r = cat[i];
    if (!r || l.auto) return void out.push(l);
    if (r.category === "dc_boxes") {
      if (dcDone) return; dcDone = true;
      const { qty, lines: n } = dcBoxes(strings, f);
      const volt = (r.key.match(/DCBOX_(\d+)_/) ?? [])[1] ?? "1500";
      const pick = find(`DCBOX_${volt}_${n}`) ?? find(`DCBOX_1500_${n}`) ?? find(`DCBOX_1000_${n}`);
      return void out.push(pick ? as(l, pick, qty) : l);
    }
    if (/mc4/i.test(r.key)) return void out.push({ ...l, qty: strings * f.mc4PerString });
    if (r.category === "cables") return void out.push({ ...l, qty: f.cableM });
    if (r.category === "ac_panel" || r.category === "combiner_panels") {
      const want = invQty >= 2 ? "combiner_panels" : "ac_panel";
      if (r.category === want) return void out.push({ ...l, qty: 1 });
      const tag = (r.name.match(/(\d+)\s*kw/i) ?? [])[1];
      const alt = ok.filter((x) => x.category === want && (!tag || new RegExp(`${tag}\\s*kw`, "i").test(x.name)))
        .sort((a, b) => Number(a.price ?? 0) - Number(b.price ?? 0))[0];
      return void out.push(alt ? as(l, alt, 1) : l);
    }
    out.push(l);
  });
  return out;
}
