import { describe, it, expect } from "vitest";
import { DEFAULT_FORMULAS as D } from "@/lib/formulas";
import { inverterForLoad, inverterOptions, batteriesFor, panelsFor, isHvNeed } from "@/lib/sizing";
const inv = (key: string, price: number) => ({ key, name: key, unit: "حبة", price, category: "inverters" });
const items = [inv("INV_DEYE_8K_1P", 1080), inv("INV_DEYE_12K_3P", 1600), inv("INV_DEYE_16K_3P", 2050), inv("INV_DEYE_20K_3P", 2550),
  inv("INV_DEYE_50K_3P_HV", 4100), inv("INV_SOLIS_80K_3P_HV", 6200), inv("INV_SOLIS_125K_3P_HV", 9000)];
describe("equation sizing", () => {
  it("16 kW load → one 16 kW, not two 8 kW", () => expect(inverterForLoad(items, 10, 16, true, D)).toMatchObject({ kw: 16, units: 1 }));
  it("70 kW load → one 80 kW HV", () => expect(inverterForLoad(items, 50, 70, true, D)).toMatchObject({ kw: 80, units: 1 }));
  it("LV and HV never mixed in the list", () => {
    expect(inverterOptions(items, 100, true, D).every((p) => !p.hv)).toBe(true);
    expect(inverterOptions(items, 400, true, D).every((p) => p.hv)).toBe(true);
  });
  it("picked 8 kW repeats when the need is larger (max 5)", () => {
    const o = inverterOptions(items, 100, false, D).find((p) => p.kw === 8);
    expect(o?.units).toBe(2); // kWp 20 ÷ (12.8×0.9 per 8 kW) → 2 × 8 kW
  });
  it("HV starts above 25 kW", () => { expect(isHvNeed(168, 0, D)).toBe(false); expect(isHvNeed(169, 0, D)).toBe(true); });
  it("HV batteries: min 4, then any count", () => { expect(batteriesFor(20, 50, true, D)).toBe(4); expect(batteriesFor(150, 50, true, D)).toBe(6); });
  it("LV batteries are multiples of 16 kWh", () => expect(batteriesFor(60, 50, false, D)).toBe(3));
  it("panels split evenly over strings", () => { const r = panelsFor(100, { ...items[2]!, kw: 16, hv: false, three: true, units: 1, cost: 0 } as never, D); expect(r.panels % r.strings).toBe(0); });
});
describe("Deye 30 HV", () => {
  it("30 kW HV is offered for HV needs", () => {
    const it2 = [...items, inv("INV_DEYE_30K_3P_HV", 2800)];
    expect(inverterOptions(it2, 300, true, D).some((p) => p.kw === 30 && p.hv)).toBe(true);
  });
});

import { inverterOptions as _io, groupBySize as _g } from "@/lib/sizing";
describe("brand choice per size", () => {
  const its = [{ key: "INV_DEYE_50K_3P_HV", name: "", category: "inverters", price: 4100 }, { key: "INV_SOLIS_50K_3P_HV", name: "", category: "inverters", price: 4200 },
    { key: "INV_SOLIS_80K_3P_HV", name: "", category: "inverters", price: 6200 }] as never;
  it("50 kW offers Deye and Solis; 80 kW only Solis", () => {
    const g = _g(_io(its, 400, true));
    expect(g.find((x) => x.kw === 50)?.brands.map((b) => b.key)).toEqual(["INV_DEYE_50K_3P_HV", "INV_SOLIS_50K_3P_HV"]);
    expect(g.find((x) => x.kw === 80)?.brands.length).toBe(1);
  });
});

import { inverterOptionsForLoad as _iol } from "@/lib/sizing";
describe("load gives choices, not one pick", () => {
  it("38 kW load lists several sizes, and 50 kW comes in both Deye and Solis", () => {
    const inv = (key: string, price: number) => ({ key, name: key, category: "inverters", price, active: true, kind: "item" });
    const items = [inv("INV_DEYE_30K_3P_HV", 2800), inv("INV_SOLIS_30K_3P_HV", 2800), inv("INV_DEYE_50K_3P_HV", 4100), inv("INV_SOLIS_50K_3P_HV", 4200), inv("INV_DEYE_80K_3P_HV", 6200)] as never;
    const o = _iol(items, 100, 38, true);
    expect(new Set(o.map((x) => x.kw)).size).toBeGreaterThan(1);
    expect(o.filter((x) => x.kw === 50).length).toBe(2);
    expect(o.find((x) => x.kw === 30)!.units).toBe(2);
  });
});
