import { describe, it, expect } from "vitest";
import { applyEquations, DEFAULT_FORMULAS } from "@/lib/formulas";
const it_ = (key: string, category: string, name = key, price = 1) => ({ key, category, name, unit: null, price });
const items = [it_("PV", "panels"), it_("INV", "inverters"), it_("DCBOX_1500_6", "dc_boxes"), it_("DCBOX_1500_8", "dc_boxes"), it_("ac_05", "ac_panel", "لوحة 50kw"), it_("ac_06", "combiner_panels", "تجميع 50kw"), it_("cable", "cables"), it_("mc4_connector", "cables")];
const L = (key: string, qty: number) => ({ key, name: key, unit: null, price: 1, qty, specs: [] });
const run = (pv: number, inv: number) => applyEquations([L("PV", pv), L("INV", inv), L("DCBOX_1500_6", 1), L("ac_05", 1), L("cable", 20), L("mc4_connector", 3)], items, () => null, DEFAULT_FORMULAS);
describe("equation items", () => {
  it("14 strings → 2 DC boxes of 8 lines", () => { const o = run(126, 2); expect(o.find((l) => l.key.startsWith("DCBOX"))).toMatchObject({ key: "DCBOX_1500_8", qty: 2 }); });
  it("cable stays 1 m even with 2 inverters", () => expect(run(126, 2).find((l) => l.key === "cable")!.qty).toBe(1));
  it("MC4 = strings × sets per string", () => expect(run(126, 2).find((l) => l.key === "mc4_connector")!.qty).toBe(14));
  it("2 inverters → combiner panel", () => expect(run(126, 2).some((l) => l.key === "ac_06")).toBe(true));
});
