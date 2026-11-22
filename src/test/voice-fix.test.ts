import { describe, it, expect } from "vitest";
import { fixVoiceText } from "@/lib/voice-fix";
describe("fixVoiceText", () => {
  it("fixes the screenshot question", () => {
    expect(fixVoiceText("سعة بطارية فيدوز ستطعشر.")).toBe("سعة بطارية فيدوس 16");
  });
  it("fixes dialect 16 spelled سطعشر", () => {
    expect(fixVoiceText("فيدوس سطعشر")).toBe("فيدوس 16");
  });
  it("fixes Solis and 50", () => {
    expect(fixVoiceText("كم MPPT في سولز خمسين")).toBe("كم MPPT في سوليس 50");
  });
});
