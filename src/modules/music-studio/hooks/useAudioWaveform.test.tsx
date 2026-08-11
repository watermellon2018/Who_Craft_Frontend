import {render, screen} from '@testing-library/react';
import React from 'react';

import {useAudioWaveform} from './useAudioWaveform';

const audioUrl = 'https://assets.example.test/signed-track.mp3';

function WaveformHarness() {
  const state = useAudioWaveform(audioUrl);
  if (state.loading) return <span>loading</span>;
  if (state.error) return <span>error</span>;
  return <span>ready:{state.peaks.length}</span>;
}

test('decodes signed audio with same-origin credentials and closes its AudioContext', async () => {
  const close = jest.fn().mockResolvedValue(undefined);
  const decodeAudioData = jest.fn().mockResolvedValue({
    duration: 2,
    getChannelData: () => Float32Array.from([-0.5, 0.5]),
    numberOfChannels: 1,
  });
  const AudioContextMock = jest.fn().mockImplementation(() => ({
    close,
    decodeAudioData,
  }));
  const originalAudioContext = window.AudioContext;
  const originalFetch = global.fetch;
  Object.defineProperty(window, 'AudioContext', {
    configurable: true,
    value: AudioContextMock,
  });
  global.fetch = jest.fn().mockResolvedValue({
    arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
    ok: true,
  } as unknown as Response);

  try {
    render(<WaveformHarness />);

    expect(await screen.findByText('ready:2')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(audioUrl, expect.objectContaining({
      credentials: 'same-origin',
      signal: expect.any(AbortSignal),
    }));
    expect(decodeAudioData).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  } finally {
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      value: originalAudioContext,
    });
    global.fetch = originalFetch;
  }
});
