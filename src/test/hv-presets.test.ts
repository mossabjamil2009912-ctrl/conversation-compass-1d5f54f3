import { describe, it, expect } from "vitest";
import { PRESETS, comKeyOf } from "@/components/QuoteBuilder";
describe("HV presets match bot BIG_ROWS", () => {
  const keys = new Set(PRESETS.filter((p) => p.type === "com").map(comKeyOf));
  it("has 1–5 inverter systems for 50/80/125 kW", () => {
    for (const k of ["50-3-600", "80-3-1020", "125-3-1615", "125-3-663", "80-3-153"]) expect(keys.has(k)).toBe(true);
  });
  it("covers all 53 distinct bot keys (55 rows, 2 shared panel counts)", () => expect([...keys].filter((k) => /^(50|80|125)-/.test(k)).length).toBe(53));
});
