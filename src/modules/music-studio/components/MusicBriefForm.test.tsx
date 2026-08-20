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

function VariantCountBrief({onChange}: {onChange: (count: number) => void}) {
  const [variantCount, setVariantCount] = useState(2);
  return (
    <MusicBriefForm
      capabilities={capabilities}
      value={initialBrief}
      variantCount={variantCount}
      onChange={() => undefined}
      onVariantCountChange={(count) => {
        setVariantCount(count);
        onChange(count);
      }}
    />
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

  const field = (label: string) => within(characterSection as HTMLElement)
    .getAllByLabelText(label)[0]
    .closest('.ant-form-item');
  const title = field('Название');
  const purpose = field('Назначение');
  const genre = field('Жанр');
  const tempo = field('Темп');
  const energy = field('Динамика');
  const duration = field('Длительность (сек)');
  const moods = field('Настроение');
  const instruments = field('Инструменты');

  expect(title?.nextElementSibling).toBe(purpose);
  expect(purpose?.nextElementSibling).toBe(genre);
  expect(genre?.nextElementSibling).toBe(tempo);
  expect(tempo?.nextElementSibling).toBe(energy);
  expect(energy?.nextElementSibling).toBe(duration);
  expect(duration?.nextElementSibling).toBe(moods);
  expect(moods?.nextElementSibling).toBe(instruments);
  for (const item of [title, purpose, genre, tempo, energy, duration]) {
    expect(item).toHaveClass('music-character-grid__third');
  }
  for (const item of [moods, instruments]) {
    expect(item).toHaveClass('music-character-grid__half');
  }
  expect(screen.queryByRole('heading', {name: 'Звучание'})).not.toBeInTheDocument();
  expect(screen.getByLabelText('Дополнительные настройки')).toBeInTheDocument();
});

test('shows the song vocal controls in Track character before the sound description', () => {
  const songBrief: MusicBrief = {
    ...initialBrief,
    content: {
      lyricsLanguage: 'ru',
      mode: 'song',
      sections: [{label: 'Куплет 1', text: 'Текст', type: 'verse'}],
      vocalStyle: {delivery: 'soft', timbre: 'warm'},
    },
  };
  render(
    <MusicBriefForm
      capabilities={capabilities}
      value={songBrief}
      variantCount={2}
      onChange={() => undefined}
      onVariantCountChange={() => undefined}
    />,
  );
  const characterSection = screen.getByRole('heading', {name: 'Характер трека'}).closest('section');
  const advancedSection = screen.getByLabelText('Дополнительные настройки');
  const field = (label: string) => within(characterSection as HTMLElement)
    .getAllByLabelText(label)[0]
    .closest('.ant-form-item');
  const timbre = field('Тембр вокала');
  const delivery = field('Манера исполнения');
  const comment = field('Желаемое звучание');

  expect(timbre).toHaveClass('music-character-grid__half');
  expect(delivery).toHaveClass('music-character-grid__half');
  expect(timbre?.nextElementSibling).toBe(delivery);
  expect(delivery?.nextElementSibling).toBe(comment);
  expect(within(advancedSection).queryByLabelText('Тембр вокала')).not.toBeInTheDocument();
  expect(within(advancedSection).queryByLabelText('Манера исполнения')).not.toBeInTheDocument();
});

test('does not duplicate the song format in the Purpose field', () => {
  render(<ControlledBrief />);

  fireEvent.mouseDown(screen.getByRole('combobox', {name: 'Назначение'}));

  expect(screen.getByRole('option', {name: 'Фоновая музыка'})).toBeInTheDocument();
  expect(screen.queryByRole('option', {name: 'Песня'})).not.toBeInTheDocument();
});

test('offers only generation variant counts advertised by the provider', () => {
  const onVariantCountChange = jest.fn();
  render(<VariantCountBrief onChange={onVariantCountChange} />);

  fireEvent.click(screen.getByText('Дополнительные настройки'));
  const variantControl = screen.getByLabelText('Количество вариантов');
  expect(variantControl).toHaveClass('music-variant-count');
  const optionOne = within(variantControl).getByText('1').closest('.ant-segmented-item');
  const optionTwo = within(variantControl).getByText('2').closest('.ant-segmented-item');
  expect(within(variantControl).queryByText('5')).not.toBeInTheDocument();
  expect(optionTwo).toHaveClass('ant-segmented-item-selected');

  fireEvent.click(optionOne as HTMLElement);

  expect(onVariantCountChange).toHaveBeenCalledWith(1);
  expect(optionTwo).not.toHaveClass('ant-segmented-item-selected');
  expect(optionOne).toHaveClass('ant-segmented-item-selected');
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
