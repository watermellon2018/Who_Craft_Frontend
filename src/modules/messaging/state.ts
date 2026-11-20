import type {MessagingConversation, MessagingHistory, MessagingMessage} from '../../api/generated/contracts';

export interface ConversationSnapshot {
  conversation: MessagingConversation;
  messages: MessagingMessage[];
  /** Includes newer changes to unloaded history, preventing stale pages from restoring old text. */
  knownMessages: MessagingMessage[];
  nextBefore: number | null;
  revision: number;
  windowStart: number;
}

/** Read and clear boundaries are monotonic, even when requests complete out of order. */
export function mergeConversation(current: MessagingConversation | undefined, incoming: MessagingConversation): MessagingConversation {
  if (!current) return incoming;
  const stale = incoming.revision < current.revision || incoming.cleared_through < current.cleared_through;
  const base = stale ? current : incoming;
  const readThrough = Math.max(current.read_through, incoming.read_through);
  return {
    ...base,
    read_through: readThrough,
    peer_read_through: Math.max(current.peer_read_through, incoming.peer_read_through),
    unread_count: readThrough >= base.last_sequence ? 0
      : !stale && incoming.revision === current.revision && incoming.read_through < current.read_through
        ? current.unread_count : base.unread_count,
  };
}

export function mergeMessages(current: MessagingMessage[], incoming: MessagingMessage[], clearedThrough: number, windowStart: number): MessagingMessage[] {
  const messages = new Map(current.map((item) => [item.id, item]));
  incoming.forEach((item) => {
    const existing = messages.get(item.id);
    if (item.sequence < windowStart && !existing) return;
    if (!existing || item.version > existing.version) messages.set(item.id, item);
  });
  // Keep tombstones in memory so a late history page cannot resurrect deleted text.
  return Array.from(messages.values()).filter((item) => item.sequence > clearedThrough)
    .sort((left, right) => left.sequence - right.sequence);
}

export function initialSnapshot(history: MessagingHistory): ConversationSnapshot {
  return {
    conversation: history.conversation,
    messages: history.items,
    knownMessages: history.items,
    nextBefore: history.next_before,
    revision: history.sync_revision,
    windowStart: history.items[0]?.sequence ?? history.conversation.last_sequence + 1,
  };
}

export function updateSnapshot(current: ConversationSnapshot, conversation: MessagingConversation, items: MessagingMessage[] = [], history = false): ConversationSnapshot {
  const merged = mergeConversation(current.conversation, conversation);
  const firstSequence = history ? items[0]?.sequence ?? current.windowStart : current.windowStart;
  const windowStart = Math.max(merged.cleared_through + 1, Math.min(firstSequence, current.windowStart));
  const knownMessages = mergeMessages(current.knownMessages, items, merged.cleared_through, 0);
  return {
    ...current,
    conversation: merged,
    windowStart,
    knownMessages,
    messages: knownMessages.filter((item) => item.sequence >= windowStart),
    nextBefore: current.nextBefore !== null && current.nextBefore <= merged.cleared_through + 1 ? null : current.nextBefore,
  };
}

export function sortConversations(items: MessagingConversation[]): MessagingConversation[] {
  return items.filter((item) => !item.is_hidden).sort((left, right) => (
    right.updated_at.localeCompare(left.updated_at) || left.id.localeCompare(right.id)
  ));
}
