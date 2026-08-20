import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {MemoryRouter, Route, Routes, useLocation} from 'react-router-dom';

import i18n from '../../../i18n';
import {runGenerationWithCredits} from '../../credits/components/GenerationCostGuard';
import {soundEffectsApi} from '../api/soundEffectsApi';
import {useSoundEffectJob} from '../hooks/useSoundEffectJob';
import type {SoundEffectCapabilities, SoundEffectJob} from '../types';
import SoundEffectsPage from './SoundEffectsPage';

jest.mock('../hooks/useSoundEffectJob');
jest.mock('../../credits/components/GenerationCostGuard', () => ({
  GenerationCostPreview: () => null,
  runGenerationWithCredits: jest.fn(),
}));
jest.mock('../../music-studio/components/MusicStudioShell', () => ({
  __esModule: true,
  default: ({center, inspector, library, workspace}: {
    center: React.ReactNode;
    inspector: React.ReactNode;
    library: React.ReactNode;
    workspace: string;
  }) => <div data-testid="shell" data-workspace={workspace}>{library}{center}{inspector}</div>,
}));

const capabilities: SoundEffectCapabilities = {
  defaultModelKey: 'elevenlabs-sfx-v2',
  duration: {autoSupported: true, defaultSeconds: 5, maxSeconds: 30, minSeconds: 0.5},
  models: [
    {
      configured: true,
      default: true,
      duration: {autoSupported: true, maxSeconds: 30, minSeconds: 0.5},
      key: 'elevenlabs-sfx-v2',
      label: 'ElevenLabs Sound Effects v2',
      promptInfluence: {default: 0.3, max: 1, min: 0},
      providerDisplayName: 'ElevenLabs',
      preview: false,
      supportsLoop: true,
    },
    {
      configured: false,
      default: false,
      key: 'future-model',
      label: 'Future model',
      preview: true,
      routes: [],
    },
  ],
  permissions: {canEdit: true, canRunGeneration: true},
  prompt: {maxChars: 450},
  promptInfluence: {default: 0.3, max: 1, min: 0},
  supportsLoop: true,
};

const mockedUseSoundEffectJob = useSoundEffectJob as jest.MockedFunction<
  typeof useSoundEffectJob
>;
const mockedRunGenerationWithCredits = runGenerationWithCredits as jest.MockedFunction<
  typeof runGenerationWithCredits
>;

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}

function renderPage(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LocationProbe />
      <Routes>
        <Route path="/project/:projectId/sound-effects" element={<SoundEffectsPage />} />
        <Route path="/project/:projectId/sound-effects/create" element={<SoundEffectsPage />} />
        <Route path="/project/:projectId/sound-effects/jobs/:jobId" element={<SoundEffectsPage />} />
        <Route path="/project/:projectId/sound-effects/effects/:effectId" element={<SoundEffectsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(soundEffectsApi, 'getCapabilities').mockResolvedValue({data: capabilities} as never);
  jest.spyOn(soundEffectsApi, 'listEffects').mockResolvedValue({data: {
    items: [],
    permissions: capabilities.permissions,
  }} as never);
  jest.spyOn(soundEffectsApi, 'listJobs').mockResolvedValue({data: {items: []}} as never);
  mockedUseSoundEffectJob.mockReturnValue({
    errorMessage: null,
    job: null,
    loading: false,
    refresh: jest.fn(),
  });
  mockedRunGenerationWithCredits.mockImplementation((intent, operation) => operation({
    modelKey: 'elevenlabs-sfx-v2-canonical',
  } as never));
});

afterEach(() => jest.restoreAllMocks());

test('renders the separate workspace and enqueues canonical model, duration, loop, and scene', async () => {
  const enqueue = jest.spyOn(soundEffectsApi, 'enqueueJob').mockResolvedValue({data: {
    jobId: 'sfx-job-1',
  }} as never);
  renderPage('/project/7/sound-effects/create?sceneId=42');

  expect(await screen.findByText('ElevenLabs Sound Effects v2 · ElevenLabs'))
    .toBeInTheDocument();
  expect(screen.getByTestId('shell')).toHaveAttribute('data-workspace', 'sound-effects');
  fireEvent.change(screen.getByLabelText(i18n.t('soundEffects.form.prompt')), {
    target: {value: 'Metal door slams in a concrete corridor'},
  });
  fireEvent.click(screen.getByText(i18n.t('soundEffects.form.durationCustom')));
  fireEvent.change(screen.getByLabelText(i18n.t('soundEffects.form.durationSeconds')), {
    target: {value: '7.5'},
  });
  fireEvent.click(screen.getByRole('checkbox', {name: i18n.t('soundEffects.form.loop')}));
  fireEvent.click(screen.getByRole('button', {name: i18n.t('soundEffects.create.generate')}));

  await waitFor(() => expect(enqueue).toHaveBeenCalledTimes(1));
  expect(mockedRunGenerationWithCredits).toHaveBeenCalledWith(
    expect.objectContaining({modelKey: 'elevenlabs-sfx-v2'}),
    expect.any(Function),
  );
  expect(enqueue.mock.calls[0][1]).toEqual(expect.objectContaining({
    durationSeconds: 7.5,
    loop: true,
    modelKey: 'elevenlabs-sfx-v2-canonical',
    sceneId: 42,
  }));
  await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(
    '/project/7/sound-effects/jobs/sfx-job-1',
  ));
});

test('renders a completed durable job and applies its generated variant', async () => {
  const job: SoundEffectJob = {
    canCancel: false,
    canRetry: false,
    durationSeconds: 4,
    jobId: 'job-2',
    loop: false,
    modelKey: 'elevenlabs-sfx-v2',
    permissions: capabilities.permissions,
    prompt: 'Short impact',
    promptInfluence: 0.3,
    stage: 'finalized',
    status: 'completed',
    variants: [{
      audioUrl: '/media/effect.mp3',
      durationSeconds: 4,
      index: 0,
      status: 'generated',
      variantId: 'variant-1',
    }],
  };
  mockedUseSoundEffectJob.mockReturnValue({
    errorMessage: null,
    job,
    loading: false,
    refresh: jest.fn(),
  });
  const apply = jest.spyOn(soundEffectsApi, 'applyVariant').mockResolvedValue({data: {
    effectId: 19,
  }} as never);
  renderPage('/project/7/sound-effects/jobs/job-2');

  fireEvent.click(await screen.findByRole('button', {
    name: i18n.t('soundEffects.player.apply'),
  }));

  await waitFor(() => expect(apply).toHaveBeenCalledWith(
    '7',
    'job-2',
    'variant-1',
    {targetEffectId: null, title: 'Short impact'},
  ));
  await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(
    '/project/7/sound-effects/effects/19',
  ));
});
