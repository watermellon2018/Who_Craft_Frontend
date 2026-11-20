import {useCallback, useEffect, useRef, useState} from 'react';

import type {MessagingConversation} from '../../api/generated/contracts';
import {getAuthGeneration} from '../../api/http';
import {messagingApi} from './api';
import {mergeConversation, sortConversations} from './state';

export function useConversations(generation: number) {
  const [items, setItems] = useState<MessagingConversation[]>([]);
  const [total, setTotal] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const alive = useRef(true);
  const requestId = useRef(0);
  const controller = useRef<AbortController>();
  const updates = useRef(new Map<string, MessagingConversation>());
  const inFlight = useRef(false);
  const queued = useRef(false);

  const refresh = useCallback(async (): Promise<void> => {
    if (document.visibilityState !== 'visible' || generation !== getAuthGeneration()) return;
    if (inFlight.current) {queued.current = true; return;}
    inFlight.current = true;
    const id = ++requestId.current;
    controller.current?.abort();
    const requestController = new AbortController();
    controller.current = requestController;
    updates.current.clear();
    try {
      const rows: MessagingConversation[] = [];
      let resultTotal = 0;
      for (let page = 0; page < pageCount; page += 1) {
        const result = await messagingApi.conversations(page * 50, {generation, signal: requestController.signal});
        if (!alive.current || id !== requestId.current || generation !== getAuthGeneration()) return;
        rows.push(...result.items);
        resultTotal = result.total;
        if (rows.length >= resultTotal) break;
      }
      const confirmedUpdates = Array.from(updates.current.values());
      setItems((current) => {
        const old = new Map(current.map((item) => [item.id, item]));
        const next = new Map(rows.map((item) => [item.id, mergeConversation(old.get(item.id), item)]));
        confirmedUpdates.forEach((item) => next.set(item.id, mergeConversation(next.get(item.id), item)));
        return sortConversations(Array.from(next.values()));
      });
      setTotal(resultTotal);
      setError(false);
    } catch {
      if (alive.current && id === requestId.current && generation === getAuthGeneration()) setError(true);
    } finally {
      if (alive.current && id === requestId.current && generation === getAuthGeneration()) {
        setLoading(false);
        inFlight.current = false;
        if (queued.current) {
          queued.current = false;
          void refresh();
        }
      }
    }
  }, [generation, pageCount]);

  const cancelRequests = useCallback(() => {
    alive.current = false;
    ++requestId.current;
    inFlight.current = false;
    queued.current = false;
    controller.current?.abort();
  }, []);

  useEffect(() => {
    alive.current = true;
    void refresh();
    const timer = window.setInterval(refresh, 5000);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('online', refresh);
    return () => {
      cancelRequests();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('online', refresh);
    };
  }, [cancelRequests, refresh]);

  const update = useCallback((conversation: MessagingConversation) => {
    if (!alive.current || generation !== getAuthGeneration()) return;
    // Fold updates received during a list request into its result without starving slow requests.
    updates.current.set(conversation.id, mergeConversation(updates.current.get(conversation.id), conversation));
    setItems((current) => {
      const old = current.find((item) => item.id === conversation.id);
      const merged = mergeConversation(old, conversation);
      return sortConversations([...current.filter((item) => item.id !== conversation.id), merged]);
    });
  }, [generation]);

  const loadMore = () => {
    setLoading(true);
    setPageCount((current) => current + 1);
  };

  return {items, total, loading, error, refresh, update, loadMore};
}
