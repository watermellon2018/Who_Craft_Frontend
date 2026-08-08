import api from '../../../api/http';
import {musicApi, newMusicIdempotencyKey} from './musicApi';
import type {MusicEnqueueRequest} from '../types';

jest.mock('../../../api/http', () => ({
  __esModule: true,
  default: {post: jest.fn()},
}));

const mockedPost = api.post as jest.Mock;

const payload: MusicEnqueueRequest = {
  brief: {
    content: {mode: 'instrumental'},
    context: {type: 'project'},
    durationSeconds: 30,
    energyCurve: 'steady',
    exclude: [],
    genre: 'cinematic',
    instruments: ['piano'],
    loopable: false,
    moods: ['hopeful'],
    purpose: 'underscore',
    tempo: {mode: 'medium'},
    textRefinement: '',
    title: 'Theme',
  },
  referenceAssetId: null,
  targetTrackId: null,
  variantCount: 2,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedPost.mockResolvedValue({data: {jobId: 'job-1'}});
});

test('creates a fresh idempotency key for each deliberate submit', () => {
  expect(newMusicIdempotencyKey()).not.toBe(newMusicIdempotencyKey());
});

test('forwards the submit-scoped idempotency key to enqueue', async () => {
  await musicApi.enqueueJob('7', payload, 'music:submit-1');

  expect(mockedPost).toHaveBeenCalledWith(
    'api/projects/7/music/generation-jobs/',
    payload,
    {headers: {'Idempotency-Key': 'music:submit-1'}},
  );
});

test('sends the expected track version when archiving', async () => {
  await musicApi.archiveTrack('7', 9, 4);

  expect(mockedPost).toHaveBeenCalledWith(
    'api/projects/7/music/9/archive/',
    {expectedTrackVersion: 4},
  );
});