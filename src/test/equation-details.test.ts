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
});
