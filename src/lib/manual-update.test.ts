import { describe, it, expect } from "vitest";
import { compareVersions, normalizeServiceUrl } from "./manual-update";

describe("manual update", () => {
  it("1.1.0 is newer than 1.0.9", () => expect(compareVersions("1.1.0", "1.0.9")).toBe(1));
  it("1.10.0 is newer than 1.9.0", () => expect(compareVersions("1.10.0", "1.9.0")).toBe(1));
  it("same version is not newer", () => expect(compareVersions("1.1.0", "1.1")).toBe(0));
  it("strips trailing slash from service url", () => expect(normalizeServiceUrl("https://x.com/api/")).toBe("https://x.com/api"));
  it("rejects non-http url", () => expect(() => normalizeServiceUrl("ftp://x.com")).toThrow());
});
