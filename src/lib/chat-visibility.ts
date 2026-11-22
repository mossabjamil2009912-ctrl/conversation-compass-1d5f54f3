// What an incoming bot-ingest message does to a deleted/blocked chat.
// Blocked: stays hidden, no unread. Deleted: comes back as a fresh chat on the customer's next message.
export type ChatState = { unread: number | null; deleted_at: string | null; blocked: boolean | null };

export function incomingVisibility(c: ChatState, direction: string, bumpsUnread: boolean):
  { unread?: number; deleted_at?: null; hidden_before?: string } {
  if (c.blocked) return {};
  if (c.deleted_at && direction === "customer") return { deleted_at: null, hidden_before: c.deleted_at, unread: 1 };
  return bumpsUnread ? { unread: (c.unread ?? 0) + 1 } : {};
}
