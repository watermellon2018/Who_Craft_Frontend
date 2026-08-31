import {estimateGenerationSeconds, formatElapsedTime, recordGenerationDuration} from './generationTiming';
import type {StoryboardShotListModelOption} from './model';

const model: StoryboardShotListModelOption = {
  available: true, estimatedCostUsd: null, estimatedInputTokens: 100,
  estimatedOutputTokens: 1800, id: 'qwen', label: 'Qwen', provider: 'OpenRouter', unavailableReason: null,
};
beforeEach(() => localStorage.clear());

test('uses a provisional estimate until successful requests have been measured for that model', () => {
  expect(estimateGenerationSeconds(model)).toBe(50);
  recordGenerationDuration(model, 24);
  recordGenerationDuration(model, 36);
  expect(estimateGenerationSeconds(model)).toBe(30);
  expect(estimateGenerationSeconds({...model, id: 'gpt'})).toBe(50);
  expect(formatElapsedTime(-2)).toBe('00:00');
  expect(formatElapsedTime(73.8)).toBe('01:13');
});

test('timing history is optional and corrupt storage does not block generation', () => {
  localStorage.setItem('wcraft:storyboard-generation-timing:v1', 'broken');
  expect(estimateGenerationSeconds(model)).toBe(50);
  recordGenerationDuration(model, Number.NaN);
  expect(estimateGenerationSeconds(model)).toBe(50);
});
