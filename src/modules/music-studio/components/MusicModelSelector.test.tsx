import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';

import i18n from '../../../i18n';
import type {MusicModelSpec} from '../types';
import MusicModelSelector from './MusicModelSelector';

const capabilities: MusicModelSpec['capabilities'] = {
  audioReference: {
    formats: ['mp3'],
    maxBytes: 100,
    maxCount: 1,
    maxSeconds: 300,
    minSeconds: 10,
    supported: false,
  },
  briefFields: {
    energyCurves: ['steady'],
    genres: ['cinematic'],
    instruments: ['piano'],
    moods: ['hopeful'],
    purposes: ['underscore'],
    tempoModes: ['auto'],
    vocalStyles: {deliveries: [], timbres: []},
  },
  contentModes: ['instrumental'],
  duration: {defaultSeconds: 30, maxSeconds: 300, minSeconds: 3},
  lyrics: {languages: [], maxChars: 0, sectionTypes: [], supported: false},
  outputFormats: ['mp3'],
  providerDisplayName: 'Provider',
  supportsCancellation: true,
  supportsSeed: false,
  variantCounts: [1],
};

const models: MusicModelSpec[] = [
  {
    capabilities,
    configured: true,
    default: true,
    key: 'lyria-3-pro',
    label: 'Lyria 3 Pro',
    preview: true,
    routes: [{
      configured: true,
      key: 'openrouter',
      provider: 'openrouter',
      providerDisplayName: 'OpenRouter',
      unitCostUsd: '0.0844',
    }],
  },
  {
    capabilities,
    configured: false,
    default: false,
    key: 'stable-audio',
    label: 'Stable Audio',
    preview: false,
    routes: [],
  },
];

test('renders one option per model with preview, provider price, and disabled state', async () => {
  render(
    <MusicModelSelector models={models} value="lyria-3-pro" onChange={jest.fn()} />,
  );

  fireEvent.mouseDown(screen.getByRole('combobox', {
    name: i18n.t('musicStudio.model.label'),
  }));

  expect((await screen.findAllByText('Lyria 3 Pro')).length).toBeGreaterThan(0);
  expect(screen.getAllByText(i18n.t('musicStudio.model.preview')).length).toBeGreaterThan(0);
  expect(screen.getAllByText(i18n.t('musicStudio.model.routeDetail', {
    price: '0.0844',
    providers: 'OpenRouter',
  })).length).toBeGreaterThan(0);
  expect(screen.getByText('Stable Audio').closest('.ant-select-item-option')).toHaveClass(
    'ant-select-item-option-disabled',
  );
});
