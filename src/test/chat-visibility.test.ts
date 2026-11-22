import { describe, expect, it } from "vitest";
import { incomingVisibility } from "@/lib/chat-visibility";

describe("deleted / blocked chats", () => {
  it("a permanently deleted (blocked) number stays hidden when it writes again", () => {
    expect(incomingVisibility({ unread: 0, deleted_at: "2026-11-21T00:00:00Z", blocked: true }, "customer", true)).toEqual({});
  });
  it("a deleted chat comes back as a fresh chat when the customer writes again", () => {
    expect(incomingVisibility({ unread: 5, deleted_at: "2026-11-21T00:00:00Z", blocked: false }, "customer", true))
      .toEqual({ deleted_at: null, hidden_before: "2026-11-21T00:00:00Z", unread: 1 });
  });
  it("a bot reply alone does not bring a deleted chat back", () => {
    expect(incomingVisibility({ unread: 0, deleted_at: "2026-11-21T00:00:00Z", blocked: false }, "bot", false)).toEqual({});
  });
});
