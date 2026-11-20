import type {MessagingConversation, MessagingHistory, MessagingMessage} from '../../api/generated/contracts';

export const conversationId = '00000000-0000-4000-8000-000000000001';
export const secondConversationId = '00000000-0000-4000-8000-000000000002';

export function message(sequence = 1, overrides: Partial<MessagingMessage> = {}): MessagingMessage {
  return {
    id: sequence, conversation_id: conversationId, sequence, sender_id: 2, is_own: false,
    text: `Message ${sequence}`, created_at: '2026-09-26T10:00:00Z', edited_at: null, deleted_at: null,
    version: sequence, client_id: `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
    ...overrides,
  };
}

export function conversation(overrides: Partial<MessagingConversation> = {}): MessagingConversation {
  return {
    id: conversationId, peer: {id: 2, username: 'alice', display_name: 'Alice', avatar_url: null, is_active: true},
    last_message: message(), unread_count: 1, last_sequence: 1, revision: 1, read_through: 0,
    peer_read_through: 0, cleared_through: 0, is_hidden: false, can_send: true, updated_at: '2026-09-26T10:00:00Z',
    ...overrides,
  };
}

export function history(overrides: Partial<MessagingHistory> = {}): MessagingHistory {
  return {items: [message()], conversation: conversation(), sync_revision: 1, next_before: null, ...overrides};
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {resolve = resolvePromise; reject = rejectPromise;});
  return {promise, resolve, reject};
}
