import {fireEvent, render, screen} from '@testing-library/react';
import React from 'react';

import AudioWaveformTimeline from '../components/AudioWaveformTimeline';
import {downsampleAudioBuffer} from './audioWaveform';

const createBuffer = (channels: number[][], duration = 4) => ({
  duration,
  getChannelData: (channel: number) => Float32Array.from(channels[channel] ?? []),
  numberOfChannels: channels.length,
});

test('downsamples mono PCM into min/max time bins', () => {
  const waveform = downsampleAudioBuffer(
    createBuffer([[-1, -0.5, 0.25, 1]]),
    2,
  );

  expect(waveform.duration).toBe(4);
  expect(waveform.peaks).toEqual([
    {max: -0.5, min: -1},
    {max: 1, min: 0.25},
  ]);
});

test('combines extrema from every channel', () => {
  const waveform = downsampleAudioBuffer(
    createBuffer([
      [-0.75, 0.25, 0.5, 0.125],
      [-0.125, 1, -1, 0.375],
    ]),
    2,
  );

  expect(waveform.peaks).toEqual([
    {max: 1, min: -0.75},
    {max: 0.5, min: -1},
  ]);
});

test('does not create more bins than available samples', () => {
  const waveform = downsampleAudioBuffer(createBuffer([[0.1, 0.2, 0.3]]), 1200);

  expect(waveform.peaks).toHaveLength(3);
  expect(waveform.peaks[0].min).toBeCloseTo(0.1);
  expect(waveform.peaks[2].max).toBeCloseTo(0.3);
});

test('clamps invalid PCM values and handles empty decoded audio', () => {
  const clamped = downsampleAudioBuffer(createBuffer([[-2, Number.NaN, 3]]), 1);
  const empty = downsampleAudioBuffer(createBuffer([[], []], Number.NaN));

  expect(clamped.peaks).toEqual([{max: 1, min: -1}]);
  expect(empty).toEqual({duration: 0, peaks: []});
});

test('seeks on pointer down and emits a dragged timeline selection', () => {
  const onSeek = jest.fn();
  const onSelectionChange = jest.fn();
  render(React.createElement(AudioWaveformTimeline, {
    ariaLabel: 'Audio timeline',
    currentTimeSeconds: 0,
    durationSeconds: 100,
    onSeek,
    onSelectionChange,
    peaks: [{max: 0.5, min: -0.5}],
    selection: null,
    selectionEndLabel: 'Selection end',
    selectionStartLabel: 'Selection start',
    zoom: 2,
  }));
  const timeline = screen.getByRole('group', {name: 'Audio timeline'});
  jest.spyOn(timeline, 'getBoundingClientRect').mockReturnValue({
    bottom: 184,
    height: 184,
    left: 100,
    right: 500,
    toJSON: () => ({}),
    top: 0,
    width: 400,
    x: 100,
    y: 0,
  });

  const dispatchPointer = (type: string, clientX: number) => {
    const event = new Event(type, {bubbles: true, cancelable: true});
    Object.defineProperties(event, {
      button: {value: 0},
      clientX: {value: clientX},
      pointerId: {value: 1},
    });
    fireEvent(timeline, event);
  };

  dispatchPointer('pointerdown', 200);
  dispatchPointer('pointermove', 340);
  dispatchPointer('pointerup', 340);

  expect(onSeek).toHaveBeenCalledWith(25);
  expect(onSelectionChange).toHaveBeenLastCalledWith({
    endSeconds: 60,
    startSeconds: 25,
  });
  expect(timeline).toHaveStyle({width: '200%'});
});
