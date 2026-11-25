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

import { storageParts as sp2 } from "@/lib/storage";
import { DEFAULT_FORMULAS as DF } from "@/lib/formulas";
describe("M1D / ReefMagic", () => {
  it("M1D: min 6, one controller per 15", () => {
    expect(sp2("m1d", 50, DF)).toEqual([["BAT_PYLON_M1D_18K", 6], ["CTRL_M1D", 1]]);
    expect(sp2("m1d", 300, DF)).toEqual([["BAT_PYLON_M1D_18K", 17], ["CTRL_M1D", 2]]);
  });
  it("ReefMagic: min 2, one controller per 10", () => {
    expect(sp2("reef", 10, DF)).toEqual([["BAT_PYLON_REEFMAGIC_7_5K", 2], ["CTRL_REEFMAGIC", 1]]);
    expect(sp2("reef", 90, DF)).toEqual([["BAT_PYLON_REEFMAGIC_7_5K", 12], ["CTRL_REEFMAGIC", 2]]);
  });
});
