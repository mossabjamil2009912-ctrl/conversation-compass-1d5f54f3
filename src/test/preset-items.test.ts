import { describe, it, expect } from "vitest";
import { mergeFormulas } from "@/lib/formulas";

describe("edited ready-made system items", () => {
  it("keeps valid edited items by system title", () => {
    const f = mergeFormulas({ presetItems: { "8 كيلو": [["INV_DEYE_12K_1P", 2], ["PV_SUNTECH_720", 10]] } });
    expect(f.presetItems["8 كيلو"]).toEqual([["INV_DEYE_12K_1P", 2], ["PV_SUNTECH_720", 10]]);
  });
  it("drops lists with zero counts", () => {
    expect(mergeFormulas({ presetItems: { x: [["A", 0]] } }).presetItems).toEqual({});
  });
});
