import React, {useState} from 'react';
import {fireEvent, render, screen} from '@testing-library/react';

import type {MusicBrief, MusicCapabilities, MusicLyricsSection} from '../types';
import LyricsSectionEditor from './LyricsSectionEditor';
import MusicBriefForm from './MusicBriefForm';

const capabilities: MusicCapabilities = {
  audioReference: {formats: ['mp3'], maxBytes: 100, maxCount: 1, maxSeconds: 300, minSeconds: 10, supported: true},
  briefFields: {
    energyCurves: ['steady'],
    genres: ['cinematic'],
    instruments: ['piano'],
    moods: ['hopeful'],
    purposes: ['underscore', 'song'],
    tempoModes: ['auto', 'bpm'],
    vocalStyles: {deliveries: ['soft'], timbres: ['warm']},
  },
  contentModes: ['instrumental', 'song'],
  duration: {defaultSeconds: 30, maxSeconds: 300, minSeconds: 3},
  lyrics: {languages: ['ru', 'en'], maxChars: 12000, sectionTypes: ['verse', 'chorus'], supported: true},
  outputFormats: ['mp3'],
  providerDisplayName: 'Generator',
  supportsCancellation: true,
  supportsSeed: true,
  variantCounts: [1, 2],
};

const initialBrief: MusicBrief = {
  content: {mode: 'instrumental'},
  context: {type: 'project'},
  durationSeconds: 30,
  energyCurve: 'steady',
  exclude: [],
  genre: 'cinematic',
  instruments: [],
  loopable: false,
  moods: ['hopeful'],
  purpose: 'underscore',
  tempo: {mode: 'auto'},
  textRefinement: '',
  title: 'Theme',
};

function ControlledBrief() {
  const [brief, setBrief] = useState(initialBrief);
  return (
    <MusicBriefForm
      capabilities={capabilities}
      value={brief}
      variantCount={2}
      onChange={setBrief}
      onVariantCountChange={() => undefined}
    />
  );
}

const songDraft: Extract<MusicBrief['content'], {mode: 'song'}> = {
  lyricsLanguage: 'ru',
  mode: 'song',
  sections: [
    {label: 'Verse 1', text: 'First line\nSecond line', type: 'verse'},
    {label: 'Chorus', text: 'Keep this chorus', type: 'chorus'},
  ],
  vocalStyle: {delivery: 'soft', density: 'sparse', timbre: 'warm'},
};

function SeedBrief({supportsSeed}: {supportsSeed: boolean}) {
  const [brief, setBrief] = useState<MusicBrief>({...initialBrief, seed: 123});
  return (
    <>
      <MusicBriefForm
        capabilities={{...capabilities, supportsSeed}}
        value={brief}
        variantCount={2}
        onChange={setBrief}
        onVariantCountChange={() => undefined}
      />
      <output data-testid="seed-brief-value">{JSON.stringify(brief)}</output>
    </>
  );
}

function DraftPreservingBrief() {
  const [brief, setBrief] = useState<MusicBrief>({
    ...initialBrief,
    content: songDraft,
    purpose: 'song',
  });
  return (
    <>
      <MusicBriefForm
        capabilities={capabilities}
        value={brief}
        variantCount={2}
        onChange={setBrief}
        onVariantCountChange={() => undefined}
      />
      <output data-testid="content-value">{JSON.stringify(brief.content)}</output>
    </>
  );
}

test('keeps every core Sound control visible in instrumental and song modes', () => {
  render(<ControlledBrief />);
  for (const label of ['Жанр', 'Длительность', 'Настроение', 'Инструменты', 'Динамика', 'Темп', 'Комментарий']) {
    expect(screen.getAllByLabelText(label).length).toBeGreaterThan(0);
  }

  fireEvent.click(screen.getByText('Песня с текстом'));
  expect(screen.getAllByLabelText('Жанр').length).toBeGreaterThan(0);
  expect(screen.getAllByLabelText('Комментарий').length).toBeGreaterThan(0);
});

test('restores the exact song draft after temporarily switching to instrumental mode', () => {
  render(<DraftPreservingBrief />);

  fireEvent.click(screen.getByText('Инструментал'));
  expect(JSON.parse(screen.getByTestId('content-value').textContent ?? '')).toEqual({
    mode: 'instrumental',
  });

  fireEvent.click(screen.getByText('Песня с текстом'));
  expect(JSON.parse(screen.getByTestId('content-value').textContent ?? '')).toEqual(songDraft);
});

test('shows and keeps seed in the brief only when the capability is enabled', () => {
  render(<SeedBrief supportsSeed />);
  fireEvent.click(screen.getByText('Дополнительные настройки'));

  const seedInput = screen.getByLabelText('Seed');
  expect(seedInput).toHaveValue('123');
  fireEvent.change(seedInput, {target: {value: '456'}});
  expect(JSON.parse(screen.getByTestId('seed-brief-value').textContent ?? '')).toEqual(
    expect.objectContaining({seed: 456}),
  );
});

test('hides seed when the capability is disabled', () => {
  render(<SeedBrief supportsSeed={false} />);
  fireEvent.click(screen.getByText('Дополнительные настройки'));

  expect(screen.queryByLabelText('Seed')).not.toBeInTheDocument();
});

test('moves lyric sections without changing their text or line breaks', () => {
  const Wrapper = () => {
    const [sections, setSections] = useState<MusicLyricsSection[]>([
      {label: 'Куплет 1', text: 'Строка 1\nСтрока 2', type: 'verse'},
      {label: 'Припев', text: 'Припев дословно', type: 'chorus'},
    ]);
    return (
      <LyricsSectionEditor
        languages={['ru']}
        maxChars={12000}
        sectionTypes={['verse', 'chorus']}
        sections={sections}
        selectedLanguage="ru"
        onLanguageChange={() => undefined}
        onSectionsChange={setSections}
      />
    );
  };
  render(<Wrapper />);
  fireEvent.click(screen.getAllByLabelText('Переместить секцию ниже')[0]);

  const textareas = screen.getAllByRole('textbox').filter((input) => input.tagName === 'TEXTAREA');
  expect(textareas[0]).toHaveValue('Припев дословно');
  expect(textareas[1]).toHaveValue('Строка 1\nСтрока 2');
});
