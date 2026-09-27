import api from '../../../api/http';
import {generationModality, personalGenerationRoutes, preferredGenerationSource, refreshPersonalVideoModels} from './personalApi';
import type {PersonalApiSettings} from './personalApi';

jest.mock('../../../api/http', () => ({__esModule: true, default: {post: jest.fn()}, getAuthGeneration: () => 7}));

const settings: PersonalApiSettings = {
  connections: [
    {id: 'video-key', name: 'Видео', provider: 'gemini', keyHint: '••••1234', isActive: true, version: 1, createdAt: '', updatedAt: ''},
    {id: 'disabled-key', name: 'Отключено', provider: 'gemini', keyHint: '••••5678', isActive: false, version: 1, createdAt: '', updatedAt: ''},
  ],
  preferences: [
    {modality: 'image', source: 'platform', routes: [{connectionId: 'video-key', modelKey: 'image'}]},
    {modality: 'video', source: 'personal', routes: [
      {connectionId: 'disabled-key', modelKey: 'video-fast'},
      {connectionId: 'video-key', modelKey: 'image'},
      {connectionId: 'video-key', modelKey: 'video-fast'},
      {connectionId: 'video-key', modelKey: 'video-quality'},
    ]},
  ],
  providers: [{id: 'gemini', label: 'Gemini', modalities: ['image', 'video']}],
  models: [
    {key: 'image', label: 'Image', modality: 'image', providers: ['gemini'], operations: ['generate'], isFree: false},
    {key: 'video-fast', label: 'Video Fast', modality: 'video', providers: ['gemini'], operations: ['generate'], isFree: false},
    {key: 'video-quality', label: 'Video Quality', modality: 'video', providers: ['gemini'], operations: ['generate'], isFree: false},
  ],
  hasPaidSubscription: false,
  storageAvailable: true,
};

it('uses the independent video preference instead of the image default', () => {
  const modality = generationModality('video');

  expect(modality).toBe('video');
  expect(preferredGenerationSource(settings, modality)).toBe('personal');
  expect(preferredGenerationSource(settings, 'image')).toBe('platform');
});

it('preserves video priority while excluding inactive connections and image models', () => {
  const routes = personalGenerationRoutes(settings, 'video');

  expect(routes.map((route) => route.modelKey)).toEqual(['video-fast', 'video-quality']);
  expect(routes.every((route) => route.connection.id === 'video-key')).toBe(true);
  expect(personalGenerationRoutes(settings, 'video', 'edit')).toEqual([]);
});

it('does not reuse image preferences when video has not been configured', () => {
  const withoutVideo = {...settings, preferences: settings.preferences.filter((preference) => preference.modality !== 'video')};

  expect(preferredGenerationSource(withoutVideo, 'video')).toBe('platform');
  expect(personalGenerationRoutes(withoutVideo, 'video')).toEqual([]);
});

it('refreshes video metadata without sending provider secrets or starting a generation', async () => {
  const post = api.post as jest.Mock;
  post.mockResolvedValueOnce({data: settings});

  await expect(refreshPersonalVideoModels()).resolves.toBe(settings);
  expect(post).toHaveBeenCalledTimes(1);
  expect(post).toHaveBeenCalledWith('api/personal-api/video-models/refresh/', {}, {expectedAuthGeneration: 7});
});
