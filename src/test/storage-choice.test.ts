import { describe, it, expect } from "vitest";
import { storageParts, storageAvailable } from "@/lib/storage";
import { DEFAULT_FORMULAS as D } from "@/lib/formulas";

describe("HV storage choice (matches the old bot storOptions)", () => {
  it("Hithium 112S keeps the computed batteries", () => expect(storageParts("h112s", 192, D)).toBeNull());
  it("192 kWh → 13 Pylontech M5 in a 16-rack", () => expect(storageParts("pylon", 192, D)).toEqual([["BAT_PYLON_M5_15_68K", 13], ["RACK_M5_16", 1], ["CTRL_M5", 1], ["KIT_M5", 1]]));
  it("288 kWh → 19 M5 in a 20-rack", () => expect(storageParts("pylon", 288, D)?.slice(0, 2)).toEqual([["BAT_PYLON_M5_15_68K", 19], ["RACK_M5_20", 1]]));
  it("64 kWh → 14 Pylontech M1 in a 23-rack", () => expect(storageParts("pylon", 64, D)?.slice(0, 2)).toEqual([["BAT_PYLON_M1_4_74K", 14], ["RACK_M1C_23", 1]]));
  it("160 kWh → no 112C cabinet (too far from 112/224)", () => expect(storageParts("cab112", 160, D)).toBeNull());
  it("117 kWh → 1 Hithium 112C (within +5)", () => expect(storageParts("cab112", 117, D)).toEqual([["CAB_HITHIUM_112", 1]]));
  it("118 kWh → no 112C cabinet", () => expect(storageParts("cab112", 118, D)).toBeNull());
  it("219 kWh → 2 Hithium 112C (within −5)", () => expect(storageParts("cab112", 219, D)).toEqual([["CAB_HITHIUM_112", 2]]));
  it("256 kWh → 1 Pylontech 261", () => expect(storageParts("cab261", 256, D)).toEqual([["CAB_PYLON_261", 1]]));
  it("300 kWh → no Pylontech 313", () => expect(storageParts("cab313", 300, D)).toBeNull());
  it("112 kWh → 1 Hithium 112C cabinet", () => expect(storageParts("cab112", 112, D)).toEqual([["CAB_HITHIUM_112", 1]]));
  it("160 kWh hides every cabinet button but keeps racks", () => expect((["h112s", "pylon", "cab112", "cab261", "cab313"] as const).filter((c) => storageAvailable(c, 160, D))).toEqual(["h112s", "pylon"]));
});

describe("cabinets compare to customer night need", () => {
  it("110 kWh night need offers one 112C cabinet", () => expect(storageParts("cab112", 110, D)).toEqual([["CAB_HITHIUM_112", 1]]));
  it("150 kWh night need hides the 112C cabinet", () => expect(storageParts("cab112", 150, D)).toBeNull());
});
