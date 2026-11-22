import { describe, it, expect } from "vitest";
import { mergeFormulas } from "@/lib/formulas";

describe("sizing mode switch", () => {
  it("defaults to equations", () => expect(mergeFormulas({}).mode).toBe("eq"));
  it("keeps ranges when chosen", () => expect(mergeFormulas({ mode: "ranges" }).mode).toBe("ranges"));
  it("ignores unknown values", () => expect(mergeFormulas({ mode: "x" }).mode).toBe("eq"));
});
