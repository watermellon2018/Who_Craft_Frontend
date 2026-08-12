import React, {useState} from 'react';
import {fireEvent, render, screen} from '@testing-library/react';

import i18n from '../../../i18n';
import type {MusicBrief, MusicCapabilities} from '../types';
import MusicFormatSelector from './MusicFormatSelector';

const capabilities: MusicCapabilities = {
  audioReference: {formats: ['mp3'], maxBytes: 100, maxCount: 1, maxSeconds: 300, minSeconds: 10, supported: true},
  briefFields: {
    energyCurves: ['steady'],
    genres: ['cinematic'],
    instruments: ['piano'],
    moods: ['hopeful'],
    purposes: ['underscore', 'song'],
    tempoModes: ['auto'],
    vocalStyles: {deliveries: ['soft'], timbres: ['warm']},
  },
  contentModes: ['instrumental', 'song'],
  duration: {defaultSeconds: 30, maxSeconds: 300, minSeconds: 3},
  lyrics: {languages: ['ru'], maxChars: 12000, sectionTypes: ['verse'], supported: true},
  outputFormats: ['mp3'],
  providerDisplayName: 'Generator',
  supportsCancellation: true,
  supportsSeed: false,
  variantCounts: [1, 2],
};

const songDraft: Extract<MusicBrief['content'], {mode: 'song'}> = {
  lyricsLanguage: 'ru',
  mode: 'song',
  sections: [{label: 'Куплет 1', text: 'Сохранённый текст', type: 'verse'}],
  vocalStyle: {delivery: 'soft', timbre: 'warm'},
};

const initialBrief: MusicBrief = {
  content: songDraft,
  context: {type: 'project'},
  durationSeconds: 30,
  energyCurve: 'steady',
  exclude: [],
  genre: 'cinematic',
  instruments: [],
  loopable: false,
  moods: ['hopeful'],
  purpose: 'song',
  tempo: {mode: 'auto'},
  textRefinement: '',
  title: 'Theme',
};

function ControlledFormat() {
  const [brief, setBrief] = useState(initialBrief);
  return (
    <>
      <MusicFormatSelector capabilities={capabilities} value={brief} onChange={setBrief} />
      <output data-testid="brief-content">{JSON.stringify(brief.content)}</output>
      <output data-testid="brief-purpose">{brief.purpose}</output>
    </>
  );
}

test('selects one format and restores the existing song draft', () => {
  render(<ControlledFormat />);

  const song = screen.getByRole('radio', {
    name: new RegExp(i18n.t('musicStudio.brief.mode.song')),
  });
  const instrumental = screen.getByRole('radio', {
    name: new RegExp(i18n.t('musicStudio.brief.mode.instrumental')),
  });
  expect(song).toHaveAttribute('aria-checked', 'true');
  expect(instrumental).toHaveAttribute('aria-checked', 'false');

  fireEvent.click(instrumental);
  expect(instrumental).toHaveAttribute('aria-checked', 'true');
  expect(screen.getByTestId('brief-purpose')).toHaveTextContent('underscore');
  expect(JSON.parse(screen.getByTestId('brief-content').textContent ?? '')).toEqual({
    mode: 'instrumental',
  });

  fireEvent.click(song);
  expect(song).toHaveAttribute('aria-checked', 'true');
  expect(JSON.parse(screen.getByTestId('brief-content').textContent ?? '')).toEqual(songDraft);
  expect(screen.getByTestId('brief-purpose')).toHaveTextContent('underscore');
});
