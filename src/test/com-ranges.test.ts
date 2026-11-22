import { describe, it, expect, afterEach } from "vitest";
import { mergeFormulas, applyFormulas, DEFAULT_FORMULAS } from "@/lib/formulas";
import { optionsForCom } from "@/components/QuoteBuilder";

afterEach(() => { applyFormulas(DEFAULT_FORMULAS); });

describe("editable commercial ranges", () => {
  it("keeps only positive numbers", () => expect(mergeFormulas({ comRanges: { "20-3-39": 155, bad: -1, x: "a" } }).comRanges).toEqual({ "20-3-39": 155 }));
  it("ranges mode: an edited range picks the smaller system (need 150 kWh/day → 20 kW · 39 panels)", () => {
    applyFormulas({ mode: "ranges", comRanges: { "20-3-39": 155 } });
    expect(optionsForCom("kwh", 150 * 26)[0]?.title).toMatch(/20 كيلو 3 فاز · 39 لوح/);
  });
  it("ranges mode without edits uses panels × W × sun (need 150 → 52 panels)", () => {
    applyFormulas({ mode: "ranges" });
    expect(optionsForCom("kwh", 150 * 26)[0]?.title).toMatch(/20 كيلو 3 فاز · 52 لوح/);
  });
  it("equations mode ignores edited ranges", () => {
    applyFormulas({ mode: "eq", comRanges: { "20-3-39": 155 } });
    expect(optionsForCom("kwh", 150 * 26)[0]?.title).toMatch(/52 لوح/);
  });
});
