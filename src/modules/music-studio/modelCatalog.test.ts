import {
  constrainMusicDraft,
  initialMusicModelKey,
  musicModelCatalog,
} from './modelCatalog';
import type {
  MusicBrief,
  MusicCapabilities,
  MusicModelCapabilities,
  MusicReferenceAsset,
} from './types';

const baseCapabilities: MusicModelCapabilities = {
  audioReference: {
    formats: ['mp3'],
    maxBytes: 100,
    maxCount: 1,
    maxSeconds: 300,
    minSeconds: 10,
    supported: true,
  },
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
  lyrics: {
    languages: ['ru'],
    maxChars: 12_000,
    sectionTypes: ['verse', 'chorus'],
    supported: true,
  },
  outputFormats: ['mp3'],
  providerDisplayName: 'Generator',
  supportsCancellation: true,
  supportsSeed: true,
  variantCounts: [1, 2],
};

const brief: MusicBrief = {
  content: {
    lyricsLanguage: 'ru',
    mode: 'song',
    sections: [{label: 'Verse 1', text: 'Keep these lyrics', type: 'verse'}],
    vocalStyle: {delivery: 'soft', timbre: 'warm'},
  },
  context: {type: 'project'},
  durationSeconds: 120,
  energyCurve: 'steady',
  exclude: [],
  genre: 'cinematic',
  instruments: ['piano'],
  loopable: false,
  moods: ['hopeful'],
  purpose: 'song',
  seed: 42,
  tempo: {mode: 'auto'},
  textRefinement: '',
  title: 'Song',
};

const reference: MusicReferenceAsset = {
  assetId: 'reference-1',
  audioUrl: '/reference.mp3',
  audioUrlExpiresAt: null,
  durationSeconds: 10,
  localVerificationStatus: 'accepted',
  mimeType: 'audio/mpeg',
  name: 'reference.mp3',
  providerModerationStatus: 'pending',
};

test('uses the configured default model and synthesizes a legacy catalog defensively', () => {
  const capabilities: MusicCapabilities = {
    ...baseCapabilities,
    defaultModelKey: 'disabled-default',
    models: [
      {
        capabilities: baseCapabilities,
        configured: false,
        default: true,
        key: 'disabled-default',
        label: 'Disabled',
        preview: false,
        routes: [],
      },
      {
        capabilities: baseCapabilities,
        configured: true,
        default: false,
        key: 'configured-model',
        label: 'Configured',
        preview: false,
        routes: [],
      },
    ],
  };

  expect(initialMusicModelKey(capabilities, null)).toBe('configured-model');
  expect(musicModelCatalog(baseCapabilities)[0]).toEqual(expect.objectContaining({
    configured: true,
    label: 'Generator',
  }));
});

test('fills model brief fields from the top-level legacy capabilities', () => {
  const incompleteModelCapabilities = {
    ...baseCapabilities,
    briefFields: undefined,
  } as unknown as MusicModelCapabilities;
  const catalog = musicModelCatalog({
    ...baseCapabilities,
    defaultModelKey: 'raw-backend-model',
    models: [{
      capabilities: incompleteModelCapabilities,
      configured: true,
      default: true,
      key: 'raw-backend-model',
      label: 'Raw backend model',
      preview: false,
      routes: [],
    }],
  });

  expect(catalog[0].capabilities.briefFields).toEqual(baseCapabilities.briefFields);
});

test('clamps draft controls and clears unsupported reference and seed on model switch', () => {
  const constrained = constrainMusicDraft(
    brief,
    reference,
    2,
    {
      ...baseCapabilities,
      audioReference: {...baseCapabilities.audioReference, supported: false},
      contentModes: ['instrumental'],
      duration: {defaultSeconds: 15, maxSeconds: 30, minSeconds: 5},
      supportsSeed: false,
      variantCounts: [1],
    },
    'Verse 1',
  );

  expect(constrained.brief.content).toEqual({mode: 'instrumental'});
  expect(constrained.brief.durationSeconds).toBe(30);
  expect(constrained.brief.seed).toBeUndefined();
  expect(constrained.reference).toBeNull();
  expect(constrained.variantCount).toBe(1);
});

test('preserves lyrics when the selected model still supports songs', () => {
  const constrained = constrainMusicDraft(brief, reference, 2, baseCapabilities, 'Verse 1');

  expect(constrained.brief.content).toEqual(brief.content);
  expect(constrained.reference).toBe(reference);
});
