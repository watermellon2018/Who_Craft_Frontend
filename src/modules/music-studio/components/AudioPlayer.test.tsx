import {act, fireEvent, render, screen} from '@testing-library/react';
import React from 'react';

import i18n from '../../../i18n';
import AudioPlayer from './AudioPlayer';

const playLabel = () => i18n.t('musicStudio.player.play');
const pauseLabel = () => i18n.t('musicStudio.player.pause');
const seekLabel = () => i18n.t('musicStudio.player.seek');
const volumeLabel = () => i18n.t('musicStudio.player.volume');
const playerLabel = 'Test audio';
const playButtonLabel = () => `${playLabel()}: ${playerLabel}`;
const pauseButtonLabel = () => `${pauseLabel()}: ${playerLabel}`;

let playSpy: jest.SpyInstance;
let pauseSpy: jest.SpyInstance;

beforeEach(() => {
  playSpy = jest.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function play(
    this: HTMLMediaElement,
  ) {
    this.dispatchEvent(new Event('play'));
    return Promise.resolve();
  });
  pauseSpy = jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function pause(
    this: HTMLMediaElement,
  ) {
    this.dispatchEvent(new Event('pause'));
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('plays, pauses, and tells the parent which audio element became active', () => {
  const onPlay = jest.fn();
  const {container} = render(
    <AudioPlayer
      label={playerLabel}
      src="/audio/first.mp3"
      durationSeconds={75}
      onPlay={onPlay}
    />,
  );
  const audio = container.querySelector('audio');
  expect(audio).not.toBeNull();

  fireEvent.click(screen.getByRole('button', {name: playButtonLabel()}));

  expect(playSpy).toHaveBeenCalledTimes(1);
  expect(onPlay).toHaveBeenCalledWith(audio);
  expect(screen.getByRole('button', {name: pauseButtonLabel()})).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', {name: pauseButtonLabel()}));

  expect(pauseSpy).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', {name: playButtonLabel()})).toBeInTheDocument();
});

test('reflects a pause initiated by the parent', () => {
  const {container} = render(
    <AudioPlayer label={playerLabel} src="/audio/first.mp3" durationSeconds={75} />,
  );
  const audio = container.querySelector('audio') as HTMLAudioElement;

  fireEvent.click(screen.getByRole('button', {name: playButtonLabel()}));
  act(() => audio.pause());

  expect(screen.getByRole('button', {name: playButtonLabel()})).toBeInTheDocument();
});

test('seeks and changes the native audio volume through accessible sliders', () => {
  const {container} = render(
    <AudioPlayer label={playerLabel} src="/audio/first.mp3" durationSeconds={100} />,
  );
  const audio = container.querySelector('audio') as HTMLAudioElement;

  fireEvent.change(screen.getByRole('slider', {name: seekLabel()}), {target: {value: '24.5'}});
  fireEvent.change(screen.getByRole('slider', {name: volumeLabel()}), {target: {value: '0.35'}});

  expect(audio.currentTime).toBe(24.5);
  expect(audio.volume).toBe(0.35);
  expect(screen.getByText('0:24 / 1:40')).toBeInTheDocument();
});

test('uses media metadata for duration and resets playback when the source changes', () => {
  const {container, rerender} = render(
    <AudioPlayer label={playerLabel} src="/audio/first.mp3" durationSeconds={100} />,
  );
  const audio = container.querySelector('audio') as HTMLAudioElement;
  Object.defineProperty(audio, 'duration', {configurable: true, value: 65});
  fireEvent.loadedMetadata(audio);
  audio.currentTime = 12;
  fireEvent.timeUpdate(audio);
  fireEvent.play(audio);

  expect(screen.getByText('0:12 / 1:05')).toBeInTheDocument();
  expect(screen.getByRole('button', {name: pauseButtonLabel()})).toBeInTheDocument();

  rerender(<AudioPlayer label={playerLabel} src="/audio/second.mp3" durationSeconds={42} />);

  expect(audio.currentTime).toBe(0);
  expect(screen.getByText('0:00 / 0:42')).toBeInTheDocument();
  expect(screen.getByRole('button', {name: playButtonLabel()})).toBeInTheDocument();
});

test('reports media errors and leaves the player paused', () => {
  const onError = jest.fn();
  const {container} = render(
    <AudioPlayer
      label={playerLabel}
      src="/audio/first.mp3"
      durationSeconds={75}
      onError={onError}
    />,
  );
  const audio = container.querySelector('audio') as HTMLAudioElement;
  fireEvent.play(audio);

  fireEvent.error(audio);

  expect(onError).toHaveBeenCalledTimes(1);
  const playButton = screen.getByRole('button', {name: playButtonLabel()});
  expect(playButton).toBeDisabled();
  expect(screen.getByText(i18n.t('musicStudio.player.unavailable'))).toBeInTheDocument();
});
