import type {StoryboardShotListModelOption} from './model';

const STORAGE_KEY = 'wcraft:storyboard-generation-timing:v1';
interface TimingSample {seconds: number; tokens: number}
type TimingHistory = Record<string, TimingSample[]>;

function readHistory(): TimingHistory {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([, samples]) => Array.isArray(samples)
      && samples.length <= 5 && samples.every((sample) => sample
        && Number.isFinite(sample.seconds) && sample.seconds > 0 && sample.seconds < 3600
        && Number.isFinite(sample.tokens) && sample.tokens > 0)));
  } catch {
    return {};
  }
}

export function estimateGenerationSeconds(model?: StoryboardShotListModelOption): number {
  const samples = model ? readHistory()[model.id] : undefined;
  if (model && samples?.length) {
    const estimates = samples.map((sample) => sample.seconds
      * Math.max(0.5, Math.min(2, model.estimatedOutputTokens / sample.tokens)));
    return Math.max(5, Math.round(estimates.reduce((sum, value) => sum + value, 0) / estimates.length));
  }
  // A provisional UI heuristic, not a provider SLA or measured model speed.
  return Math.max(30, Math.min(180, Math.round(20 + (model?.estimatedOutputTokens ?? 2400) / 60)));
}

export function recordGenerationDuration(model: StoryboardShotListModelOption, seconds: number): void {
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds >= 3600) return;
  try {
    const history = readHistory();
    history[model.id] = [...(history[model.id] ?? []), {
      seconds, tokens: Math.max(1, model.estimatedOutputTokens),
    }].slice(-5);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // Timing history is optional; generation and saving must not depend on it.
  }
}

export function formatElapsedTime(seconds: number): string {
  const value = Math.max(0, Math.floor(seconds));
  return `${Math.floor(value / 60).toString().padStart(2, '0')}:${(value % 60).toString().padStart(2, '0')}`;
}
