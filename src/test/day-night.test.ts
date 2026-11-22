import { describe, it, expect } from "vitest";
import { optionsForResBill, tiersFrom, tiersDayNight, dailyNeed } from "@/components/QuoteBuilder";

const t = (bill: number) => tiersFrom(optionsForResBill(bill, 290));
const n = (bill: number) => dailyNeed("res", "bill", bill, 290);
describe("day/night by real night consumption (85% usable battery)", () => {
  it("40,000 night 70% (÷26) → night 3.71 kWh fits 5.12 battery → stays 5.12", () => expect(tiersDayNight(t(40000), 70, n(40000))!.rec.title).toContain("بطارية 5.12 كيلو — 4 ألواح"));
  it("50,000 at 50/50 unchanged", () => expect(tiersDayNight(t(50000), 50, n(50000))!.rec.title).toContain("بطارية 5.12 كيلو"));
  it("65,000 night 70% → night 6.03 kWh > 4.35 → 10.24 battery", () => expect(tiersDayNight(t(65000), 70, n(65000))!.rec.title).toContain("بطارية 10.24 كيلو"));
});
