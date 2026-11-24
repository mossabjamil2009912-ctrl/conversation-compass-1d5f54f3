import { describe, it, expect } from "vitest";
import { batteriesFor } from "@/lib/sizing";
import { DEFAULT_FORMULAS as F } from "@/lib/formulas";
import { optionsForResBill, dailyNeed, tiersFrom, tiersDayNight } from "@/components/QuoteBuilder";

describe("night batteries (no tolerance)", () => {
  it("tolerance removed", () => expect(F.batTol).toBe(0));
  // night 70%: 21 kWh daily → 14.7 night; one 16 kWh battery gives 13.6 usable → short 1.1 → 2 batteries
  it("adds a battery when short by more than 1 kWh", () => expect(batteriesFor(21, 70, false, F)).toBe(2));
  // 20 kWh daily → 14 night; short 0.4 kWh → stays 1 battery
  it("adds a battery for any shortfall", () => expect(batteriesFor(20, 70, false, F)).toBe(2));
});
