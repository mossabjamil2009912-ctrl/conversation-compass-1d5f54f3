import { describe, it, expect } from "vitest";
import { explainEquations } from "@/lib/equation-details";
import { DEFAULT_FORMULAS, stringCount } from "@/lib/formulas";

const items = [
  { key: "INV_DEYE_12K_3P", name: "Deye 12K ثري فاز", unit: null, price: 1, category: "inverters" },
  { key: "PNL", name: "Panel 720W", unit: null, price: 1, category: "panels" },
  { key: "mc4_connector", name: "MC4", unit: null, price: 1, category: "accessories" },
];
describe("equation details", () => {
  it("shows the same string count as the quote equations", () => {
    const rows = explainEquations([{ key: "INV_DEYE_12K_3P", name: "Deye 12K ثري فاز", qty: 1 }, { key: "PNL", name: "Panel 720W", qty: 20 }, { key: "mc4_connector", name: "MC4", qty: 2 }], items, { need: 80 }, DEFAULT_FORMULAS);
    const s = stringCount(20, true, 1, DEFAULT_FORMULAS);
    expect(rows.find((r) => r.title === "السترنجات")?.result).toBe(`${s} سترنج`);
    expect(rows.find((r) => r.title === "قدرة الألواح المطلوبة")?.result).toBe("16 kWp");
  });
  it("shows inverter count by peak load as ceil(load ÷ inverter kW)", () => {
    const rows = explainEquations([{ key: "INV_DEYE_12K_3P", name: "Deye 12K ثري فاز", qty: 3 }, { key: "PNL", name: "Panel 720W", qty: 20 }], items, { need: 80, loadKw: 30 }, DEFAULT_FORMULAS);
    const steps = rows.find((r) => r.title === "عدد الإنفرترات")?.steps ?? [];
    expect(steps.some((x) => x.includes("⌈30 ÷ 12⌉ = 3"))).toBe(true);
  });
});

describe("battery details", () => {
  const run = (key: string, qty: number, need: number | null = 387) => {
    const battery = { key, name: key, category: "batteries", unit: null, price: 1 };
    return explainEquations([{ ...battery, qty }], [battery], { need, nightPct: 50 }, DEFAULT_FORMULAS).find((row) => row.storage)?.storage;
  };

  it("exposes the actual battery count even without panels and inverters", () => {
    expect(run("BAT_HITHIUM_16K_HV", 15)).toEqual({ qty: 15, unitKwh: 16, totalKwh: 240 });
  });
  it("keeps manual quote quantities rather than replacing them with a calculated count", () => {
    expect(run("BAT_HITHIUM_16K_LV", 3)?.qty).toBe(3);
  });
  it("uses M1 and M5 capacities rather than the Hithium capacity", () => {
    expect(run("BAT_PYLON_M1_4_74K", 41)?.totalKwh).toBeCloseTo(194.34);
    expect(run("BAT_PYLON_M5_15_68K", 13)?.totalKwh).toBeCloseTo(203.84);
  });
  it("reports small residential batteries and cabinets using their own capacity", () => {
    expect(run("BAT_UF5000", 2, null)).toEqual({ qty: 2, unitKwh: 5.12, totalKwh: 10.24 });
    expect(run("CAB_PYLON_261", 2)?.totalKwh).toBe(522);
  });
  it("does not invent a capacity for an unknown battery", () => {
    expect(run("CUSTOM_BATTERY", 4)).toEqual({ qty: 4 });
  });
});

describe("AC breaker details", () => {
  const inverter = { key: "INV_DEYE_30K_HV", name: "Deye 30 HV", unit: null, price: 1, category: "inverters" };
  const panel = { key: "COMBINER", name: "لوحة تجميع", unit: null, price: 1, category: "combiner_panels" };
  const catalog = [...items, inverter, panel];
  const run = (qty: number) => explainEquations([
    { ...inverter, qty }, { key: "PNL", name: "Panel 720W", qty: 98 }, { ...panel, qty: 1 },
  ], catalog, {}, { ...DEFAULT_FORMULAS, acThreeDiv: 658, acSafety: 1.25 });

  it("two 30 kW inverters have two branch breakers sized for one inverter each", () => {
    const branches = run(2).flatMap((row) => row.breaker?.kind === "branch" ? [row.breaker] : []);
    expect(branches).toHaveLength(1);
    expect(branches[0]?.qty).toBe(2);
    expect(branches[0]?.amps).toBeCloseTo(56.9909, 4);
  });

  it("two 30 kW inverters have one main breaker sized for the combined 60 kW", () => {
    const main = run(2).find((row) => row.breaker?.kind === "main")?.breaker;
    expect(main?.qty).toBe(1);
    expect(main?.amps).toBeCloseTo(113.9818, 4);
  });

  it("a single inverter has one AC breaker without separate branch breakers", () => {
    const breakers = run(1).flatMap((row) => row.breaker ? [row.breaker] : []);
    expect(breakers).toHaveLength(1);
    expect(breakers[0]?.qty).toBe(1);
    expect(breakers[0]?.amps).toBeCloseTo(56.9909, 4);
  });

  it("mixed inverter capacities use each inverter's own branch current", () => {
    const rows = explainEquations([
      { ...inverter, qty: 2 }, { key: "INV_DEYE_12K_3P", name: "Deye 12K ثري فاز", qty: 1 },
      { key: "PNL", name: "Panel 720W", qty: 98 }, { ...panel, qty: 1 },
    ], catalog, {}, { ...DEFAULT_FORMULAS, acThreeDiv: 658, acSafety: 1.25 });
    const branches = rows.flatMap((row) => row.breaker?.kind === "branch" ? [row.breaker] : []);
    expect(branches.map((b) => b.qty)).toEqual([2, 1]);
    expect(branches[0]?.amps).toBeCloseTo(56.9909, 4);
    expect(branches[1]?.amps).toBeCloseTo(22.7964, 4);
    expect(rows.find((row) => row.breaker?.kind === "main")?.breaker?.amps).toBeCloseTo(136.7781, 4);
  });
});
