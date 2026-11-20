import {initialSnapshot, mergeConversation, updateSnapshot} from './state';
import {conversation, history, message} from './testFixtures';

describe('messaging snapshot reconciliation', () => {
  it.each(['delete', 'edit'])('keeps an unseen older %s when a stale history page arrives later', (operation) => {
    const oldConversation = conversation({last_sequence: 100, revision: 100});
    const initial = initialSnapshot(history({items: [message(51), message(100)], conversation: oldConversation, sync_revision: 100, next_before: 51}));
    const changed = message(25, {version: 101, text: operation === 'delete' ? '' : 'Edited elsewhere',
      deleted_at: operation === 'delete' ? '2026-09-26T10:01:00Z' : null,
      edited_at: operation === 'edit' ? '2026-09-26T10:01:00Z' : null});
    const polled = updateSnapshot(initial, {...oldConversation, revision: 101}, [changed]);
    expect(polled.messages.map((item) => item.sequence)).toEqual([51, 100]);
    const paginated = updateSnapshot(polled, oldConversation, [message(1), message(25), message(50)], true);
    expect(paginated.messages.find((item) => item.id === 25)).toEqual(changed);
    expect(paginated.conversation.revision).toBe(101);
    expect(paginated.revision).toBe(100);
  });

  it('does not advance the changes cursor from a newer pagination snapshot or a local write', () => {
    const initial = initialSnapshot(history({items: [message(50)], sync_revision: 50, conversation: conversation({revision: 50, last_sequence: 50})}));
    const paginated = updateSnapshot(initial, conversation({revision: 70, last_sequence: 70}), [message(1)], true);
    const sent = updateSnapshot(paginated, conversation({revision: 71, last_sequence: 71}), [message(71, {is_own: true})]);
    expect(sent.revision).toBe(50);
    expect(sent.messages.map((item) => item.sequence)).toEqual([1, 50, 71]);
  });

  it('applies a clear from another tab and never reintroduces its history from a late response', () => {
    const initial = initialSnapshot(history({items: [message(1), message(2)], next_before: 1, conversation: conversation({revision: 2, last_sequence: 2})}));
    const cleared = updateSnapshot(initial, conversation({cleared_through: 2, read_through: 2, unread_count: 0, is_hidden: true, revision: 2, last_sequence: 2}));
    const staleHistory = updateSnapshot(cleared, initial.conversation, [message(1), message(2)], true);
    expect(staleHistory.messages).toEqual([]);
    expect(staleHistory.knownMessages).toEqual([]);
    expect(staleHistory.conversation.is_hidden).toBe(true);
    expect(staleHistory.nextBefore).toBeNull();
    const reopened = updateSnapshot(staleHistory, conversation({cleared_through: 2, read_through: 2, revision: 3, last_sequence: 3}), [message(3)]);
    expect(reopened.messages.map((item) => item.sequence)).toEqual([3]);
    expect(reopened.conversation.is_hidden).toBe(false);
  });

  it('keeps the latest tombstone and monotonic read cursors during overlapping responses', () => {
    const initial = initialSnapshot(history());
    const removed = updateSnapshot(initial, conversation({revision: 3, read_through: 1, peer_read_through: 1, unread_count: 0}), [message(1, {version: 3, text: '', deleted_at: '2026-09-26T10:01:00Z'})]);
    const stale = updateSnapshot(removed, conversation(), [message()]);
    expect(stale.messages[0].text).toBe('');
    expect(stale.messages[0].deleted_at).not.toBeNull();
    expect(stale.conversation.read_through).toBe(1);
    expect(stale.conversation.peer_read_through).toBe(1);
    expect(stale.conversation.unread_count).toBe(0);
  });

  it('does not regress an unread counter when an older read response arrives', () => {
    expect(mergeConversation(conversation({read_through: 1, unread_count: 0}), conversation()).unread_count).toBe(0);
  });
});
