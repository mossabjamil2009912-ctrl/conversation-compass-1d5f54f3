import { describe, it, expect } from "vitest";
import { voltOf } from "@/components/Catalog";
describe("catalog voltage folders", () => {
  it("Deye 30K is High Voltage", () => expect(voltOf({ key: "INV_DEYE_30K_3P_HV", name: "إنفرتر دايا هايبرد 30 كيلو 3 فاز جهد عالي" })).toBe("High Voltage"));
  it("Deye 12K is Low Voltage", () => expect(voltOf({ key: "INV_DEYE_12K_3P", name: "إنفرتر دايا 12" })).toBe("Low Voltage"));
  it("Hithium 16K LV battery is Low Voltage", () => expect(voltOf({ key: "BAT_HITHIUM_16K_LV", name: "HITHIUM 16 كيلو 51.2V" })).toBe("Low Voltage"));
  it("Pylontech M5 is High Voltage", () => expect(voltOf({ key: "BAT_PYLON_M5_15_68K", name: "M5" })).toBe("High Voltage"));
});
