import { describe, it, expect } from "vitest";
import { storageParts } from "@/lib/storage";
import { DEFAULT_FORMULAS as D } from "@/lib/formulas";

describe("Pylontech racks", () => {
  it("30 M5 batteries → 2 racks of 16", () => {
    const p = storageParts("pylon", 30 * D.m5Kwh, D)!;
    expect(p).toContainEqual(["BAT_PYLON_M5_15_68K", 30]);
    expect(p).toContainEqual(["RACK_M5_16", 2]);
  });
  it("M1 30 batteries → 2 racks of 23", () => {
    const p = storageParts("m1", 30 * D.m1Kwh, D)!;
    expect(p).toContainEqual(["RACK_M1C_23", 2]);
    expect(p).toContainEqual(["CTRL_M1C", 2]);
  });
  it("M1 26 batteries → 2 racks of 13", () => expect(storageParts("m1", 26 * D.m1Kwh, D)).toContainEqual(["RACK_M1C_13", 2]));
  it("23 M1 batteries stays M1 rack 23", () => {
    expect(storageParts("pylon", 23 * D.m1Kwh, D)).toContainEqual(["RACK_M1C_23", 1]);
  });
  it("24 M1 batteries moves to M5", () => {
    expect(storageParts("pylon", 24 * D.m1Kwh, D)![0]?.[0]).toBe("BAT_PYLON_M5_15_68K");
  });
});
