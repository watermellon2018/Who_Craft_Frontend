import React from 'react';
import {fireEvent, render} from '@testing-library/react';

import ProjectMusic from './ProjectMusic';
import ProjectStats from './ProjectStats';
import {musicMock, statsMock} from './mocks';

jest.mock('../../../../api/http', () => ({
  backendAssetUrl: (path: string) => 'https://backend.test' + path,
}));

test('starts playback only on demand and pauses the active track before starting another', () => {
  const audioInstances: Array<{pause: jest.Mock; play: jest.Mock}> = [];
  const audioConstructor = jest.spyOn(window, 'Audio').mockImplementation((source?: string) => {
    const pause = jest.fn();
    const play = jest.fn().mockResolvedValue(undefined);
    audioInstances.push({pause, play});
    return {
      addEventListener: jest.fn(),
      pause,
      play,
      preload: '',
      src: source,
    } as unknown as HTMLAudioElement;
  });

  try {
    const {container, unmount} = render(
      <ProjectMusic tracks={musicMock} onOpenTrack={jest.fn()} />,
    );
    const playButtons = Array.from(container.querySelectorAll<HTMLButtonElement>('.proj-track-play'));

    expect(audioConstructor).not.toHaveBeenCalled();
    fireEvent.click(playButtons[0]);
    expect(audioConstructor).toHaveBeenCalledWith('https://backend.test/media/music/neon-shadows.mp3');
    expect(audioInstances[0].play).toHaveBeenCalledTimes(1);

    fireEvent.click(playButtons[1]);
    expect(audioInstances[0].pause).toHaveBeenCalledTimes(1);
    expect(audioInstances[1].play).toHaveBeenCalledTimes(1);
    unmount();
  } finally {
    audioConstructor.mockRestore();
  }
});

test('opens Music Studio from the music statistic', () => {
  const onStat = jest.fn();
  const {getByRole} = render(<ProjectStats stats={statsMock} onStat={onStat} />);

  fireEvent.click(getByRole('button', {name: 'Музыка'}));
  expect(onStat).toHaveBeenCalledWith('music');
});
