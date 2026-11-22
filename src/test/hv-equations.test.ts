import { describe, it, expect } from "vitest";
import { applyEquations, hvAccessories, maxPerString, DEFAULT_FORMULAS as D } from "@/lib/formulas";
const it_ = (key: string, category: string, name = key) => ({ key, name, unit: "حبة", price: 1, category });
const items = [it_("PV", "panels"), it_("INV_SOLIS_50K_3P_HV", "inverters", "إنفرتر 50 كيلو جهد عالي"), it_("BAT_HITHIUM_16K_HV", "batteries"),
  it_("ctrl_hithium_hv16", "battery_controls"), it_("ctrl_hithium_hv16_ebc", "battery_controls"), it_("bat_protect_dc1500_250a", "battery_controls"),
  it_("DCBOX_1500_6", "dc_boxes"), it_("DCBOX_1500_10", "dc_boxes"), it_("cable", "cables"), it_("mc4_connector", "cables")];
const L = (key: string, qty: number) => ({ key, name: key, unit: "حبة", price: 1, qty, specs: [] as string[] });
describe("High Voltage equations", () => {
  it("HV max per string at 1000V = 18", () => expect(maxPerString("hv", D)).toBe(18));
  it("4 batteries → 1 BCU, no EBC, 1 protection", () => expect(hvAccessories(4, D)).toEqual({ bat: 4, bcu: 1, ebc: 0, bdc: 1 }));
  it("24 batteries → 2 BCU, 2 EBC", () => expect(hvAccessories(24, D)).toEqual({ bat: 24, bcu: 2, ebc: 2, bdc: 2 }));
  it("22 batteries → 2 BCU (15+7), 1 EBC", () => expect(hvAccessories(22, D)).toEqual({ bat: 22, bcu: 2, ebc: 1, bdc: 2 }));
  it("15 batteries → 1 BCU, 1 EBC", () => expect(hvAccessories(15, D)).toEqual({ bat: 15, bcu: 1, ebc: 1, bdc: 1 }));
  it("16 batteries → 2 BCU (15+1), 1 EBC", () => expect(hvAccessories(16, D)).toEqual({ bat: 16, bcu: 2, ebc: 1, bdc: 2 }));
  it("7 batteries → no EBC", () => expect(hvAccessories(7, D).ebc).toBe(0));
  it("6 batteries stay 6 (min 4)", () => expect(hvAccessories(6, D).bat).toBe(6));
  it("2 batteries raise to 4", () => expect(hvAccessories(2, D).bat).toBe(4));
  it("HV quote adds BCU + EBC and 18-panel strings", () => {
    const o = applyEquations([L("PV", 180), L("INV_SOLIS_50K_3P_HV", 2), L("BAT_HITHIUM_16K_HV", 12), L("DCBOX_1500_6", 1), L("cable", 1), L("mc4_connector", 1)], items, () => null, D);
    expect(o.find((l) => l.key === "ctrl_hithium_hv16")?.qty).toBe(1);
    expect(o.find((l) => l.key === "ctrl_hithium_hv16_ebc")?.qty).toBe(1);
    expect(o.find((l) => l.key === "mc4_connector")?.qty).toBe(10);
    expect(o.find((l) => l.key.startsWith("DCBOX"))).toMatchObject({ key: "DCBOX_1500_10", qty: 1 });
  });
});
