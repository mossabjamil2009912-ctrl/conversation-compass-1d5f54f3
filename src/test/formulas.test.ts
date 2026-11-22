import { describe, it, expect, afterEach } from "vitest";
import { dcBoxes, applyFormulas, DEFAULT_FORMULAS } from "@/lib/formulas";
import { dailyNeed } from "@/components/QuoteBuilder";

afterEach(() => applyFormulas(DEFAULT_FORMULAS));
describe("editable equations", () => {
  it("DC box: 14 strings → 2 boxes of 8 lines", () => expect(dcBoxes(14)).toEqual({ qty: 2, lines: 8 }));
  it("DC box: 18 strings → 2 boxes of 10 lines", () => expect(dcBoxes(18)).toEqual({ qty: 2, lines: 10 }));
  it("DC box: 3 strings → 1 box of 4 lines", () => expect(dcBoxes(3)).toEqual({ qty: 1, lines: 4 }));
  it("changing month days changes the daily need", () => {
    applyFormulas({ ...DEFAULT_FORMULAS, days: 30 });
    expect(dailyNeed("res", "bill", 30000, 250)).toBe(4);
  });
});

import { maxPerString, stringCount, DEFAULT_FORMULAS as DF } from "@/lib/formulas";
describe("string division (Voc)", () => {
  it("single phase max 9 per string", () => expect(maxPerString(false, DF)).toBe(9));
  it("three phase max 14 per string", () => expect(maxPerString(true, DF)).toBe(14));
  it("14 single-phase panels → 2 strings", () => expect(stringCount(14, false, 1, DF)).toBe(2));
  it("27 single-phase panels → 3 strings", () => expect(stringCount(27, false, 1, DF)).toBe(3));
  it("52 three-phase panels → 4 strings", () => expect(stringCount(52, true, 1, DF)).toBe(4));
});
