jest.mock('../../api/http', () => ({__esModule: true,
  backendAssetUrl: (url: string) => /^https?:/.test(url) ? url : `https://backend.test/${url.replace(/^\/+/, '')}`,
  default: {get: jest.fn(), post: jest.fn()}}));
jest.mock('../character-studio/api/characterApi', () => ({characterApi: {list: jest.fn()}}));
jest.mock('../reference-library/api/referenceApi', () => ({referenceApi: {list: jest.fn()}}));

import api from '../../api/http';
import {characterApi} from '../character-studio/api/characterApi';
import {referenceApi} from '../reference-library/api/referenceApi';
import {applyEditorFrameJobs, editorFrameService, loadCanvasLibrary} from './editorFrameJobs';
import type {EditorFrameJob} from './editorFrameJobs';
import {createInitialKeyframes} from './model';
import type {StoryboardScene} from './model';

const scene = (): StoryboardScene => ({id: '17', title: 'Scene', text: '', order: 1, entities: [], locationIds: [], status: 'draft',
  shots: [{id: 'shot', sceneId: '17', order: 1, title: 'A title', description: 'An action', characterIds: [], referenceIds: [],
    keyframes: createInitialKeyframes('shot'), transitions: []}]});
const job = (overrides: Partial<EditorFrameJob> = {}): EditorFrameJob => ({jobId: 'job', sceneId: 17, shotId: 'shot', keyframeId: 'shot-start',
  status: 'succeeded', model: 'configured-model', expectedRevision: 4, inputFingerprint: 'fingerprint', matchesCurrentDraft: true,
  assetId: 'asset', imageUrl: '/media/private-frame.png', createdAt: '2026-09-01T10:00:00Z', startedAt: null, finishedAt: null,
  estimatedSeconds: 45, errorCode: null, billing: null, ...overrides});

beforeEach(() => jest.clearAllMocks());

test('restores a completed image without replacing edited shot content or an optional end', () => {
  const input = scene();
  const output = applyEditorFrameJobs(input, [job()]);
  expect(output.shots[0].description).toBe('An action');
  expect(output.shots[0].keyframes).toHaveLength(1);
  expect(output.shots[0].keyframes[0]).toMatchObject({imageUrl: '/media/private-frame.png', imageOutdated: false});
  expect(output.status).toBe('completed');
  expect(output.readyShotsCount).toBe(1);
  expect(input.shots[0].keyframes[0].imageUrl).toBeUndefined();
});

test('keeps an image stale while local changes await a server acknowledgement', () => {
  const output = applyEditorFrameJobs(scene(), [job({matchesCurrentDraft: true})], true);
  expect(output.shots[0].keyframes[0].imageOutdated).toBe(true);
  expect(output.readyShotsCount).toBe(0);
  expect(applyEditorFrameJobs(output, [job({matchesCurrentDraft: false})]).shots[0].keyframes[0].imageOutdated).toBe(true);
});

test('retains the newest successful image after another attempt fails and ignores foreign/removed frames', () => {
  const input = scene();
  const output = applyEditorFrameJobs(input, [job({jobId: 'failure', status: 'failed', imageUrl: null, createdAt: '2026-09-01T12:00:00Z'}),
    job({jobId: 'older', imageUrl: '/older.png', createdAt: '2026-09-01T09:00:00Z'}), job(), job({sceneId: 42, imageUrl: '/foreign.png'})]);
  expect(output.shots[0].keyframes[0].imageUrl).toBe('/media/private-frame.png');
  expect(applyEditorFrameJobs({...input, shots: []}, [job()]).shots).toEqual([]);
});

test('submits a pinned draft revision and idempotency key without browser media or a prompt', async () => {
  (api.post as jest.Mock).mockResolvedValue({data: job({status: 'queued'})});
  const request = {shotId: 'shot', keyframeId: 'shot-start', expectedRevision: 4, imageModel: 'configured-model', requestId: 'request', routingMode: 'manual' as const};
  await editorFrameService.start('8', '17', request);
  expect(api.post).toHaveBeenCalledWith('api/projects/8/storyboard/scenes/17/editor-frame-jobs/', request);
});

test('loads real canonical character assets and paginated pinned library versions', async () => {
  (characterApi.list as jest.Mock).mockResolvedValue({data: [{character_id: 'character', name: 'Hero', references: [{is_canonical: true, asset_id: 'canonical', image_url: '/hero.png'}]}]});
  (referenceApi.list as jest.Mock).mockResolvedValueOnce({data: {total: 2, items: [{id: 'table', title: 'Table', category: 'prop', status: 'active', activeVersion: {id: 'version', imageUrl: '/table.png'}}]}})
    .mockResolvedValueOnce({data: {total: 2, items: [{id: 'archived', title: 'Old', status: 'archived'}]}});
  const result = await loadCanvasLibrary('8');
  expect(result).toEqual(expect.arrayContaining([expect.objectContaining({id: 'character', assetId: 'canonical'}), expect.objectContaining({id: 'table', versionId: 'version'})]));
  expect(result.find(({id}) => id === 'character')?.imageUrl).toBe('https://backend.test/hero.png');
  expect(result.find(({id}) => id === 'table')?.imageUrl).toBe('https://backend.test/table.png');
  expect(result).toHaveLength(2);
  expect(referenceApi.list).toHaveBeenCalledTimes(2);
});
