import { describe, it, expect } from "vitest";
import { batteriesFor } from "@/lib/sizing";
import { DEFAULT_FORMULAS as F } from "@/lib/formulas";
import { optionsForResBill, dailyNeed, tiersFrom, tiersDayNight } from "@/components/QuoteBuilder";

describe("night battery tolerance (1 kWh)", () => {
  it("default tolerance is 1 kWh", () => expect(F.batTol).toBe(1));
  // night 70%: 21 kWh daily → 14.7 night; one 16 kWh battery gives 13.6 usable → short 1.1 → 2 batteries
  it("adds a battery when short by more than 1 kWh", () => expect(batteriesFor(21, 70, false, F)).toBe(2));
  // 20 kWh daily → 14 night; short 0.4 kWh → stays 1 battery
  it("keeps one battery when short by under 1 kWh", () => expect(batteriesFor(20, 70, false, F)).toBe(1));
  it("50,000 YER bill at night 70% keeps the 5.12 kWh battery", () => {
    const need = dailyNeed("res", "bill", 50000, 290);
    expect(tiersDayNight(tiersFrom(optionsForResBill(50000, 290)), 70, need)?.rec.title).toContain("5.12");
  });
});
