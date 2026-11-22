import { describe, it, expect } from "vitest";
import { DEFAULT_FORMULAS } from "@/lib/formulas";
import { unitsFor, ratioOf } from "@/lib/sizing";

const f = structuredClone(DEFAULT_FORMULAS);
const solis50 = { key: "INV_SOLIS_50K_3P_HV", name: "", kw: 50, hv: true, three: true, price: 1 };
const deye50 = { key: "INV_DEYE_50K_3P_HV", name: "", kw: 50, hv: true, three: true, price: 1 };

describe("DC/AC ratio by brand", () => {
  it("Solis uses 1.6, Deye uses 1.3", () => {
    expect(ratioOf(solis50, f)).toBe(1.6);
    expect(ratioOf(deye50, f)).toBe(1.3);
  });
  it("75 kWp (375 kWh/day) needs one Solis 50 but two Deye 50", () => {
    expect(unitsFor(solis50, 375, 0, f)).toBe(1);
    expect(unitsFor(deye50, 375, 0, f)).toBe(2);
  });
});
