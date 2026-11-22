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
    expect(o?.units).toBe(2); // kWp 20 ÷ 1.3 = 15.4 kW → 2 × 8 kW
  });
  it("HV starts above 25 kW", () => { expect(isHvNeed(162, 0, D)).toBe(false); expect(isHvNeed(163, 0, D)).toBe(true); });
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
