import type {EditorFrameJob} from './editorFrameJobs';

export interface EditorFrameProgress {
  percent: number;
  queued: boolean;
  remainingSeconds: number;
  exceededEstimate: boolean;
}

export function calculateEditorFrameProgress(
  job: Pick<EditorFrameJob, 'createdAt' | 'estimatedSeconds' | 'startedAt' | 'status'>,
  now = Date.now(),
): EditorFrameProgress {
  const estimatedSeconds = Math.max(5, job.estimatedSeconds);
  const queued = job.status === 'queued' || !job.startedAt;
  if (queued) return {percent: 4, queued: true, remainingSeconds: estimatedSeconds, exceededEstimate: false};
  const startedAt = Date.parse(job.startedAt ?? job.createdAt);
  const elapsedSeconds = Number.isFinite(startedAt) ? Math.max(0, (now - startedAt) / 1000) : 0;
  const ratio = Math.min(1, elapsedSeconds / estimatedSeconds);
  return {
    percent: Math.min(95, Math.round(5 + ratio * 90)),
    queued: false,
    remainingSeconds: Math.max(0, Math.ceil(estimatedSeconds - elapsedSeconds)),
    exceededEstimate: elapsedSeconds >= estimatedSeconds,
  };
}
