import {useCallback, useEffect, useRef, useState} from 'react';

import type {MessagingConversation, MessagingMutation} from '../../api/generated/contracts';
import {getAuthGeneration} from '../../api/http';
import {messagingApi, messagingErrorStatus} from './api';
import {canReadVisibleConversation, notifyMessagingChanged} from './session';
import {initialSnapshot, updateSnapshot} from './state';
import type {ConversationSnapshot} from './state';

export function useConversation(id: string | undefined, generation: number, onUpdate: (conversation: MessagingConversation) => void) {
  const [snapshot, setSnapshot] = useState<ConversationSnapshot | null>(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [loadError, setLoadError] = useState<'load' | 'unavailable' | null>(null);
  const [syncError, setSyncError] = useState(false);
  const [olderLoading, setOlderLoading] = useState(false);
  const current = useRef<ConversationSnapshot | null>(null);
  const active = useRef<string>();
  const controller = useRef<AbortController>();
  const polling = useRef(false);
  const loadingOlder = useRef(false);
  const pendingRead = useRef(false);
  const epoch = useRef(0);

  const valid = useCallback((requestEpoch: number) => (
    epoch.current === requestEpoch && active.current === id && generation === getAuthGeneration()
  ), [generation, id]);

  const publish = useCallback((next: ConversationSnapshot) => {
    current.current = next;
    setSnapshot(next);
    onUpdate(next.conversation);
  }, [onUpdate]);

  const load = useCallback(async () => {
    if (!id || generation !== getAuthGeneration()) return;
    const requestEpoch = ++epoch.current;
    active.current = id;
    controller.current?.abort();
    controller.current = new AbortController();
    current.current = null;
    setSnapshot(null);
    setLoading(true);
    setLoadError(null);
    setSyncError(false);
    polling.current = false;
    loadingOlder.current = false;
    pendingRead.current = false;
    setOlderLoading(false);
    try {
      const response = await messagingApi.history(id, null, {generation, signal: controller.current.signal});
      if (!valid(requestEpoch)) return;
      publish(initialSnapshot(response));
    } catch (error) {
      if (valid(requestEpoch)) setLoadError(messagingErrorStatus(error) === 404 ? 'unavailable' : 'load');
    } finally {
      if (valid(requestEpoch)) setLoading(false);
    }
  }, [generation, id, publish, valid]);

  const sync = useCallback(async () => {
    if (!id || !current.current || active.current !== id || polling.current || document.visibilityState !== 'visible') return;
    const requestEpoch = epoch.current;
    if (!valid(requestEpoch)) return;
    polling.current = true;
    try {
      // The message-change cursor is independent of history pagination and mutation responses.
      let more = true;
      while (more && valid(requestEpoch) && current.current) {
        const previousRevision = current.current.revision;
        const result = await messagingApi.changes(id, previousRevision, {generation, signal: controller.current?.signal});
        if (!valid(requestEpoch) || !current.current) return;
        const next = updateSnapshot(current.current, result.conversation, result.items);
        next.revision = Math.max(previousRevision, result.next_revision);
        publish(next);
        more = result.has_more && result.next_revision > previousRevision;
      }
      if (valid(requestEpoch)) setSyncError(false);
    } catch (error) {
      if (valid(requestEpoch)) {
        if (messagingErrorStatus(error) === 404) {
          current.current = null;
          setSnapshot(null);
          setLoadError('unavailable');
        } else setSyncError(true);
      }
    } finally {
      if (valid(requestEpoch)) polling.current = false;
    }
  }, [generation, id, publish, valid]);

  const cancelRequests = useCallback(() => {
    // Invalidate whichever request is current at cleanup, including manual retries.
    ++epoch.current;
    active.current = undefined;
    controller.current?.abort();
  }, []);

  useEffect(() => {
    if (id) void load();
    else {
      active.current = undefined;
      current.current = null;
      setSnapshot(null);
      setLoading(false);
      setLoadError(null);
    }
    const timer = window.setInterval(sync, 3000);
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('online', sync);
    return () => {
      cancelRequests();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('online', sync);
    };
  }, [cancelRequests, id, load, sync]);

  const loadMore = useCallback(async () => {
    const before = current.current?.nextBefore;
    if (!id || before == null || loadingOlder.current) return;
    const requestEpoch = epoch.current;
    if (!valid(requestEpoch)) return;
    loadingOlder.current = true;
    setOlderLoading(true);
    try {
      const response = await messagingApi.history(id, before, {generation, signal: controller.current?.signal});
      if (!valid(requestEpoch) || !current.current) return;
      const next = updateSnapshot(current.current, response.conversation, response.items, true);
      next.nextBefore = response.next_before !== null && response.next_before > next.conversation.cleared_through + 1
        ? response.next_before : null;
      publish(next);
      setSyncError(false);
    } catch {
      if (valid(requestEpoch)) setSyncError(true);
    } finally {
      if (valid(requestEpoch)) {
        loadingOlder.current = false;
        setOlderLoading(false);
      }
    }
  }, [generation, id, publish, valid]);

  const acceptConversation = useCallback((conversation: MessagingConversation) => {
    if (active.current !== conversation.id || generation !== getAuthGeneration() || !current.current) return;
    publish(updateSnapshot(current.current, conversation));
    notifyMessagingChanged();
  }, [generation, publish]);

  const acceptMutation = useCallback((result: MessagingMutation) => {
    if (active.current !== result.conversation.id || generation !== getAuthGeneration() || !current.current) return;
    publish(updateSnapshot(current.current, result.conversation, [result.message]));
    notifyMessagingChanged();
  }, [generation, publish]);

  const markRead = useCallback(async (sequence: number) => {
    const conversation = current.current?.conversation;
    if (!id || !conversation || pendingRead.current || !canReadVisibleConversation() || sequence <= conversation.read_through || sequence <= conversation.cleared_through) return;
    const requestEpoch = epoch.current;
    if (!valid(requestEpoch)) return;
    pendingRead.current = true;
    try {
      const response = await messagingApi.read(id, sequence, {generation, signal: controller.current?.signal});
      if (valid(requestEpoch)) acceptConversation(response);
    } catch {
      // Keep messages unread until confirmed. A later visible update retries the receipt.
    } finally {
      if (valid(requestEpoch)) pendingRead.current = false;
    }
  }, [acceptConversation, generation, id, valid]);

  return {
    snapshot: snapshot?.conversation.id === id ? snapshot : null,
    loading, loadError, syncError, olderLoading, loadMore,
    refresh: current.current ? sync : load, acceptConversation, acceptMutation, markRead,
  };
}
