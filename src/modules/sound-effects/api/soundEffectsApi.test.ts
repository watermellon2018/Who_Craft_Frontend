import api from '../../../api/http';
import {soundEffectsApi} from './soundEffectsApi';

jest.mock('../../../api/http', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

const mockedApi = api as jest.Mocked<typeof api>;

beforeEach(() => jest.clearAllMocks());

test('uses project-scoped sound effect endpoints and the idempotency header', () => {
  const payload = {
    durationSeconds: null,
    loop: true,
    modelKey: 'elevenlabs-sound-effects-v2',
    prompt: 'Heavy door slam',
    promptInfluence: 0.4,
    sceneId: 7,
    targetEffectId: null,
  };

  soundEffectsApi.getCapabilities(12);
  soundEffectsApi.listEffects(12);
  soundEffectsApi.enqueueJob(12, payload, 'sound-effect:key');
  soundEffectsApi.applyVariant(12, 'job-1', 'variant-1', {
    targetEffectId: null,
    title: 'Heavy door slam',
  });

  expect(mockedApi.get).toHaveBeenNthCalledWith(
    1,
    'api/projects/12/sound-effects/capabilities/',
    {signal: undefined},
  );
  expect(mockedApi.get).toHaveBeenNthCalledWith(
    2,
    'api/projects/12/sound-effects/',
    {signal: undefined},
  );
  expect(mockedApi.post).toHaveBeenNthCalledWith(
    1,
    'api/projects/12/sound-effects/generation-jobs/',
    payload,
    {headers: {'Idempotency-Key': 'sound-effect:key'}},
  );
  expect(mockedApi.post).toHaveBeenNthCalledWith(
    2,
    'api/projects/12/sound-effects/generation-jobs/job-1/variants/variant-1/apply/',
    {targetEffectId: null, title: 'Heavy door slam'},
  );
});
