import { describe, it, expect } from "vitest";
import { DEFAULT_FORMULAS } from "@/lib/formulas";
import { unitsFor, ratioOf } from "@/lib/sizing";

const f = structuredClone(DEFAULT_FORMULAS);
const solis50 = { key: "INV_SOLIS_50K_3P_HV", name: "", kw: 50, hv: true, three: true, price: 1 };
const deye50 = { key: "INV_DEYE_50K_3P_HV", name: "", kw: 50, hv: true, three: true, price: 1 };

describe("DC/AC ratio by brand", () => {
  it("usable panel input = datasheet input × 0.90 (Solis 50: 96, Deye 50: 65)", () => {
    expect(ratioOf(solis50, f) * 50).toBeCloseTo(86.4);
    expect(ratioOf(deye50, f) * 50).toBeCloseTo(58.5);
  });
  it("changing the safety factor changes usable input", () => {
    expect(ratioOf(solis50, { ...f, pvSafety: 1 }) * 50).toBeCloseTo(96);
  });
  it("75 kWp (375 kWh/day) needs one Solis 50 but two Deye 50", () => {
    expect(unitsFor(solis50, 375, 0, f)).toBe(1);
    expect(unitsFor(deye50, 375, 0, f)).toBe(2);
  });
});
