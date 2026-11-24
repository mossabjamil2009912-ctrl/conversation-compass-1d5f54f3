import { describe, expect, it } from "vitest";
import workflow from "../../docs/n8n/actes-bot-workflow.json";

describe("bot string allocation", () => {
  it("98 panels use 14 per string and 7 strings, exactly like the app", () => {
    const node = workflow.nodes.find((n) => "jsCode" in n.parameters && typeof n.parameters.jsCode === "string" && n.parameters.jsCode.includes("function ACTES_STRING_LAYOUT"));
    if (!node || !("jsCode" in node.parameters) || typeof node.parameters.jsCode !== "string") throw new Error("Missing bot allocator");
    const code = node.parameters.jsCode;
    const start = code.indexOf("function ACTES_STRING_LAYOUT");
    const end = code.indexOf("function szPanels", start);
    if (start < 0 || end < 0) throw new Error("Missing bot sizing functions");
    const allocate = new Function(`${code.slice(start, end)}; return ACTES_STRING_LAYOUT;`)() as (panels: number, max: number, inv: number) => { per: number; strings: number };
    expect(allocate(98, 15, 2)).toEqual({ per: 14, strings: 7 });
  });
});