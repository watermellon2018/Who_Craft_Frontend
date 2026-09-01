import {calculateEditorFrameProgress} from './editorFrameProgress';

const job = {
  createdAt: '2026-09-01T10:00:00.000Z',
  estimatedSeconds: 40,
  startedAt: '2026-09-01T10:00:00.000Z',
  status: 'running' as const,
};

test('shows queued and bounded running progress without claiming completion', () => {
  expect(calculateEditorFrameProgress({...job, startedAt: null, status: 'queued'})).toEqual({
    percent: 4, queued: true, remainingSeconds: 40, exceededEstimate: false,
  });
  expect(calculateEditorFrameProgress(job, Date.parse(job.startedAt) + 20_000)).toEqual({
    percent: 50, queued: false, remainingSeconds: 20, exceededEstimate: false,
  });
  expect(calculateEditorFrameProgress(job, Date.parse(job.startedAt) + 60_000)).toEqual({
    percent: 95, queued: false, remainingSeconds: 0, exceededEstimate: true,
  });
});
