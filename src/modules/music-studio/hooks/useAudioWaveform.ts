import {useEffect, useState} from 'react';

import {downsampleAudioBuffer} from '../editor/audioWaveform';
import type {AudioWaveformPeak} from '../editor/audioWaveform';

type AudioContextConstructor = new () => AudioContext;

interface WebkitAudioWindow extends Window {
  webkitAudioContext?: AudioContextConstructor;
}

export interface AudioWaveformState {
  duration: number;
  error: Error | null;
  loading: boolean;
  peaks: AudioWaveformPeak[];
}

const idleState = (): AudioWaveformState => ({
  duration: 0,
  error: null,
  loading: false,
  peaks: [],
});

const getAudioContextConstructor = () => {
  if (typeof window === 'undefined') return undefined;
  return window.AudioContext
    ?? (window as WebkitAudioWindow).webkitAudioContext;
};

const asError = (error: unknown, fallbackMessage: string) => (
  error instanceof Error ? error : new Error(fallbackMessage)
);

export const useAudioWaveform = (
  audioUrl: string | null | undefined,
  reloadRevision = 0,
): AudioWaveformState => {
  const [state, setState] = useState<AudioWaveformState>(idleState);

  useEffect(() => {
    if (!audioUrl) {
      setState(idleState());
      return undefined;
    }

    const abortController = new AbortController();
    setState({duration: 0, error: null, loading: true, peaks: []});

    const loadWaveform = async () => {
      const AudioContextClass = getAudioContextConstructor();
      if (!AudioContextClass) {
        throw new Error('Web Audio API is not supported in this browser.');
      }

      const response = await fetch(audioUrl, {
        credentials: 'same-origin',
        signal: abortController.signal,
      });
      if (!response.ok) {
        throw new Error(`Audio request failed with status ${response.status}.`);
      }

      const encodedAudio = await response.arrayBuffer();
      if (abortController.signal.aborted) return;

      const audioContext = new AudioContextClass();
      try {
        const decodedAudio = await audioContext.decodeAudioData(encodedAudio);
        const waveform = downsampleAudioBuffer(decodedAudio);
        if (abortController.signal.aborted) return;

        setState({
          duration: waveform.duration,
          error: null,
          loading: false,
          peaks: waveform.peaks,
        });
      } finally {
        await audioContext.close();
      }
    };

    void loadWaveform().catch((error: unknown) => {
      if (abortController.signal.aborted) return;
      setState({
        duration: 0,
        error: asError(error, 'The audio waveform could not be loaded.'),
        loading: false,
        peaks: [],
      });
    });

    return () => abortController.abort();
  }, [audioUrl, reloadRevision]);

  return state;
};
