import React, {useState} from 'react';
import {fireEvent, render, screen, within} from '@testing-library/react';

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

test('keeps the track controls in Track character and removes Sound', () => {
  render(<ControlledBrief />);
  const characterSection = screen.getByRole('heading', {name: 'Характер трека'}).closest('section');
  expect(characterSection).not.toBeNull();

  for (const label of [
    'Название',
    'Назначение',
    'Жанр',
    'Длительность (сек)',
    'Настроение',
    'Темп',
    'Инструменты',
    'Динамика',
    'Желаемое звучание',
  ]) {
    expect(within(characterSection as HTMLElement).getAllByLabelText(label).length)
      .toBeGreaterThan(0);
  }

  const instruments = within(characterSection as HTMLElement)
    .getAllByLabelText('Инструменты')[0]
    .closest('.ant-form-item');
  const energy = within(characterSection as HTMLElement)
    .getAllByLabelText('Динамика')[0]
    .closest('.ant-form-item');
  expect(instruments?.nextElementSibling).toBe(energy);
  expect(instruments).not.toHaveClass('music-form-grid__wide');
  expect(energy).not.toHaveClass('music-form-grid__wide');
  expect(screen.queryByRole('heading', {name: 'Звучание'})).not.toBeInTheDocument();
  expect(screen.getByLabelText('Дополнительные настройки')).toBeInTheDocument();
});

test('offers up to five generation variants', () => {
  const onVariantCountChange = jest.fn();
  render(
    <MusicBriefForm
      capabilities={capabilities}
      value={initialBrief}
      variantCount={2}
      onChange={() => undefined}
      onVariantCountChange={onVariantCountChange}
    />,
  );

  fireEvent.click(screen.getByText('Дополнительные настройки'));
  const variantControl = screen.getByLabelText('Количество вариантов');
  expect(within(variantControl).getByText('5')).toBeInTheDocument();
  fireEvent.click(within(variantControl).getByText('5'));
  expect(onVariantCountChange).toHaveBeenCalledWith(5);
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
