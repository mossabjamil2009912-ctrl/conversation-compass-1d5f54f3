import { describe, it, expect } from "vitest";
import { ruleQty, ruleMatches, emptyRule, type QuoteCtx } from "@/lib/auto-rules";

// MC4: one set per string (9 panels per string) for 8/12/16/20 kW systems.
const rule = { ...emptyRule(), scope: "custom" as const, inv_kw: [8, 12, 16, 20], qty_mode: "per_panels" as const, per: 9 };
const ctx = (inv: number, panels: number): QuoteCtx => ({ type: "res", inv: [inv], bat: [], panels: [{ key: "PV_SUNTECH_720", qty: panels }] });

describe("MC4 per string", () => {
  it("8 kW, 8 panels → 1 set", () => expect(ruleQty(rule, ctx(8, 8))).toBe(1));
  it("8 kW, 18 panels → 2 sets", () => expect(ruleQty(rule, ctx(8, 18))).toBe(2));
  it("12 kW, 21 panels → 3 sets", () => expect(ruleQty(rule, ctx(12, 21))).toBe(3));
  it("20 kW, 52 panels → 6 sets", () => expect(ruleQty(rule, ctx(20, 52))).toBe(6));
  it("not added to 50 kW systems", () => expect(ruleMatches(rule, ctx(50, 75))).toBe(false));
});
