import { describe, it, expect } from "vitest";
import { parseSystem, simulate } from "@/lib/pvsyst-calc";
import { shapeArabic } from "@/lib/arabic-shape";

describe("simulation report numbers", () => {
  it("reference system (396 × 720 W) gives the reference yearly production", () => {
    const s = simulate({ kw: 50, invCount: 5.5, three: true, panels: 396, batKwh: 1018 });
    expect(s.kwp).toBe(285.12);
    expect(Math.abs(s.produced - 576816) / 576816).toBeLessThan(0.002);
    expect(Math.abs(s.specific - 2023)).toBeLessThanOrEqual(2);
  });
  it("reads the bot's system text", () => {
    expect(parseSystem("إنفرتر سوليس 50 كيلو وات 3 فاز جهد عالي × 2 | ألواح: 150 (108 ك.و) | بطاريات: 128 كيلو"))
      .toMatchObject({ kw: 50, invCount: 2, three: true, panels: 150, batKwh: 128 });
  });
  it("reads panel count before ألواح, not the 720W wattage", () => {
    const sp = parseSystem("طلب دراسة PVsyst – 8 كيلو — بطارية 16 كيلو — 8 ألواح 720W");
    expect(sp?.panels).toBe(8);
    expect(simulate(sp!).kwp).toBe(5.76);
  });
  it("capacity is panels × 0.72 kWp and DC/AC ratio follows", () => {
    const s = simulate({ kw: 50, invCount: 2, three: true, panels: 150, batKwh: 128 });
    expect(s.kwp).toBe(108);
    expect(s.pnomRatio).toBe(1.08);
  });
  it("Latin names stay unchanged; Arabic names are reshaped", () => {
    expect(shapeArabic("Dhamran Sawan Center")).toBe("Dhamran Sawan Center");
    expect(shapeArabic("محمد")).not.toBe("محمد");
  });
});

import { parseTilt, aspectsOf, SANAA_SITE } from "@/lib/pvsyst-calc";
describe("customer site choices", () => {
  it("tilt must be 0–60 degrees, Arabic digits allowed", () => {
    expect(parseTilt("15")).toBe(15);
    expect(parseTilt("٢٥")).toBe(25);
    expect(parseTilt("75")).toBeNull();
    expect(parseTilt("abc")).toBeNull();
  });
  it("directions map to PVGIS aspects", () => {
    expect(aspectsOf("s")).toEqual([0]);
    expect(aspectsOf("ns")).toEqual([0, 180]);
    expect(aspectsOf("ew")).toEqual([-90, 90]);
  });
  it("more sun on the panels means more production", () => {
    const spec = { kw: 50, invCount: 2, three: true, panels: 150, batKwh: 128 };
    const low = simulate(spec, { ...SANAA_SITE, globInc: SANAA_SITE.globInc.map((g) => g * 0.87) });
    expect(low.produced).toBeLessThan(simulate(spec).produced);
  });
});

import { parseOrientation } from "@/lib/pvsyst-calc";
describe("tilt and direction from request text", () => {
  it("reads tilt and direction", () => {
    expect(parseOrientation("8 ألواح 720W — ميلان 15 — اتجاه جنوب")).toEqual({ tilt: 15, dir: "s" });
    expect(parseOrientation("زاوية ٢٠° شرق وغرب")).toEqual({ tilt: 20, dir: "ew" });
    expect(parseOrientation("8 ألواح 720W")).toEqual({ tilt: null, dir: null });
  });
});

describe("panel wattage and exact kWp", () => {
  it("1 panel of 595W gives exactly 0.595 kWp, no rounding", async () => {
    const { parseSystem, simulate, kwpText } = await import("@/lib/pvsyst-calc");
    const spec = parseSystem("طلب دراسة PVsyst – 1.6 كيلو — بطارية 1.28 كيلو — 1 لوح 595W")!;
    expect(spec.panelW).toBe(595);
    expect(kwpText(simulate(spec).kwp)).toBe("0.595");
  });
  it("8 panels of 720W gives exactly 5.76 kWp", async () => {
    const { parseSystem, simulate, kwpText } = await import("@/lib/pvsyst-calc");
    expect(kwpText(simulate(parseSystem("8 كيلو — 8 ألواح 720W")!).kwp)).toBe("5.76");
  });
});
