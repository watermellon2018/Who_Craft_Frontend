import {useSyncExternalStore} from 'react';
import {v4 as uuidv4} from 'uuid';

import {getApiStatus} from '../../api/errors';
import type {VideoJobAccepted} from '../../api/generated/contracts';
import {getAuthGeneration} from '../../api/http';
import {createVideoJob} from './api';
import type {VideoJob} from './types';

interface VideoRequestReceipt {
  state: 'pending' | 'uncertain' | 'accepted';
  token: string;
  requestId: string;
  job?: VideoJob;
}

let generation = getAuthGeneration();
const receipts = new Map<string, VideoRequestReceipt>();
const inFlight = new Map<string, Promise<VideoJobAccepted>>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {listeners.delete(listener);};
}

function publish() {
  listeners.forEach((listener) => listener());
}

function currentReceipt(key: string, authGeneration: number) {
  return authGeneration === generation && authGeneration === getAuthGeneration()
    ? receipts.get(key) ?? null : null;
}

export function useVideoRequest(key: string, authGeneration: number) {
  return useSyncExternalStore(subscribe, () => currentReceipt(key, authGeneration));
}

export function acknowledgeVideoRequest(key: string, authGeneration: number, jobId: string) {
  const receipt = currentReceipt(key, authGeneration);
  if (receipt?.state === 'accepted' && receipt.job?.id === jobId) {
    receipts.delete(key);
    publish();
  }
}

/** The receipt belongs to the request, not the mounted shot editor. */
export function submitVideoRequest(projectId: string, key: string, token: string, authGeneration: number): Promise<VideoJobAccepted> {
  if (authGeneration !== getAuthGeneration()) return Promise.reject(new Error('Auth session changed'));
  if (generation !== authGeneration) {
    generation = authGeneration;
    receipts.clear();
    inFlight.clear();
  }
  const previous = currentReceipt(key, authGeneration);
  const pending = inFlight.get(key);
  if (previous?.state === 'pending' && pending) return pending;
  const receipt: VideoRequestReceipt = previous?.state === 'uncertain'
    ? {...previous, state: 'pending'} : {state: 'pending', token, requestId: uuidv4()};
  receipts.set(key, receipt);
  publish();

  const ownsReceipt = () => getAuthGeneration() === authGeneration && generation === authGeneration
    && receipts.get(key)?.requestId === receipt.requestId;
  const run = async (): Promise<VideoJobAccepted> => {
    // Bind the in-flight receipt before a synchronous transport failure can settle it.
    await Promise.resolve();
    try {
      const response = await createVideoJob(projectId, receipt.token, receipt.requestId);
      if (ownsReceipt()) {
        receipts.set(key, {...receipt, state: 'accepted', job: response.job});
        publish();
      }
      return response;
    } catch (error: unknown) {
      if (ownsReceipt()) {
        const status = getApiStatus(error);
        if (status === null || status === 408 || status >= 500) receipts.set(key, {...receipt, state: 'uncertain'});
        else receipts.delete(key);
        publish();
      }
      throw error;
    } finally {
      if (generation === authGeneration && inFlight.get(key) === promise) inFlight.delete(key);
    }
  };
  const promise = run();
  inFlight.set(key, promise);
  return promise;
}
