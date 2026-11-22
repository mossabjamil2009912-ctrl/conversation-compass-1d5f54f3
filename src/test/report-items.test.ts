import { describe, it, expect } from "vitest";
import { reportItems } from "@/lib/report-items";
describe("reportItems", () => {
  it("8 kW system uses Deye inverter, Pylontech battery and the DC box from the quote", () => {
    const r = reportItems("طلب دراسة PVsyst – 8 كيلو — بطارية 16 كيلو — 8 ألواح 720W");
    expect(r.inverter?.brand).toBe("Deye");
    expect(r.inverter?.model).toBe("SUN-8K-SG02LP1-EU-AM2-P");
    expect(r.battery?.brand).toBe("Pylontech");
    expect(r.battery?.model).toBe("Fidus-FB-L-16-PRO");
    expect(r.dcBox).toContain("DC MCB 2P 1000V 32A");
  });
  it("1.6 kW system uses LeoPower inverter", () => {
    expect(reportItems("1.6 كيلو — بطارية 1.28 كيلو — 1 لوح 595W").inverter?.brand).toBe("LeoPower");
  });
});
