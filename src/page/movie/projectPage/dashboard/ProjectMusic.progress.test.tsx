import React from 'react';
import {act, fireEvent, render} from '@testing-library/react';

import ProjectMusic from './ProjectMusic';
import {musicMock} from './mocks';

jest.mock('../../../../api/http', () => ({
  backendAssetUrl: (path: string) => 'https://backend.test' + path,
}));

interface AudioHarness {
  emit: (type: string) => void;
  pause: jest.Mock;
  play: jest.Mock;
  setProgress: (currentTime: number, duration: number) => void;
}

test('derives waveform progress from audio timing and resets it on every stop path', () => {
  const audioInstances: AudioHarness[] = [];
  const audioConstructor = jest.spyOn(window, 'Audio').mockImplementation((source?: string) => {
    const listeners: Record<string, () => void> = {};
    const pause = jest.fn();
    const play = jest.fn().mockResolvedValue(undefined);
    const audio = {
      addEventListener: jest.fn((type: string, listener: EventListenerOrEventListenerObject) => {
        listeners[type] = () => {
          const event = new Event(type);
          if (typeof listener === 'function') listener(event);
          else listener.handleEvent(event);
        };
      }),
      currentTime: 0,
      duration: Number.NaN,
      pause,
      play,
      preload: '',
      src: source,
    };
    audioInstances.push({
      emit: (type) => listeners[type]?.(),
      pause,
      play,
      setProgress: (currentTime, duration) => {
        audio.currentTime = currentTime;
        audio.duration = duration;
      },
    });
    return audio as unknown as HTMLAudioElement;
  });

  try {
    const {container, unmount} = render(
      <ProjectMusic tracks={musicMock} onOpenTrack={jest.fn()} />,
    );
    const playButtons = Array.from(container.querySelectorAll<HTMLButtonElement>('.proj-track-play'));
    const waveforms = Array.from(container.querySelectorAll<HTMLElement>('.proj-wave'));
    const activeBars = (waveform: HTMLElement) => waveform.querySelectorAll('.proj-wave-bar.active').length;

    expect(audioConstructor).not.toHaveBeenCalled();
    expect(activeBars(waveforms[0])).toBe(0);

    fireEvent.click(playButtons[0]);
    audioInstances[0].setProgress(25, 100);
    act(() => audioInstances[0].emit('durationchange'));
    expect(activeBars(waveforms[0])).toBe(9);

    audioInstances[0].setProgress(50, 100);
    act(() => audioInstances[0].emit('timeupdate'));
    expect(activeBars(waveforms[0])).toBe(18);

    fireEvent.click(playButtons[1]);
    expect(audioInstances[0].pause).toHaveBeenCalledTimes(1);
    expect(activeBars(waveforms[0])).toBe(0);

    audioInstances[1].setProgress(50, 100);
    act(() => audioInstances[1].emit('timeupdate'));
    expect(activeBars(waveforms[1])).toBe(18);
    act(() => audioInstances[1].emit('error'));
    expect(activeBars(waveforms[1])).toBe(0);

    fireEvent.click(playButtons[1]);
    audioInstances[2].setProgress(75, 100);
    act(() => audioInstances[2].emit('durationchange'));
    expect(activeBars(waveforms[1])).toBe(27);
    act(() => audioInstances[2].emit('ended'));
    expect(activeBars(waveforms[1])).toBe(0);

    fireEvent.click(playButtons[0]);
    audioInstances[3].setProgress(10, 100);
    act(() => audioInstances[3].emit('timeupdate'));
    expect(activeBars(waveforms[0])).toBe(3);
    fireEvent.click(playButtons[0]);
    expect(activeBars(waveforms[0])).toBe(0);

    unmount();
  } finally {
    audioConstructor.mockRestore();
  }
});
