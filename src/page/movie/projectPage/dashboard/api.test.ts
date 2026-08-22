import {adaptProgress} from './api';

describe('adaptProgress', () => {
  it('converts progress ratios to rounded UI percentages', () => {
    const reviewScene = {
      sceneId: 7,
      title: 'Сцена 07 — Ночной рынок',
      currentRevision: 4,
      acceptedRevision: 3,
    };

    expect(adaptProgress({
      overall: 67,
      script: 80,
      visual: 75,
      audio: 0,
      postproduction: 63,
      readiness: {
        overall: 0.673,
        script: 0.8,
        characters: 0.8125,
        storyboard: 0.75,
        video: 0.625,
        storyboardNeedsReview: 1,
        storyboardReviewScenes: [reviewScene],
      },
    })).toEqual({
      overall: 67,
      legend: [
        {label: 'Сценарий', value: 80, accent: 'yellow'},
        {label: 'Персонажи', value: 81, accent: 'purple'},
        {label: 'Раскадровка', value: 75, accent: 'green'},
        {label: 'Видео', value: 63, accent: 'blue'},
      ],
      storyboardNeedsReview: 1,
      storyboardReviewScenes: [reviewScene],
    });
  });

  it('preserves N/A characters and clamps values to the UI range', () => {
    const progress = adaptProgress({
      overall: 120,
      script: -20,
      visual: Number.NaN,
      audio: 0,
      postproduction: 0,
      readiness: {
        overall: 1.2,
        script: -0.2,
        characters: null,
        storyboard: Number.NaN,
        video: 0,
        storyboardNeedsReview: -3,
        storyboardReviewScenes: [],
      },
    });

    expect(progress.overall).toBe(100);
    expect(progress.legend.map(({value}) => value)).toEqual([0, null, 0, 0]);
    expect(progress.storyboardNeedsReview).toBe(0);
  });

  it('keeps percentages usable during a rolling backend deployment', () => {
    const progress = adaptProgress({
      overall: 58,
      script: 80,
      visual: 42,
      audio: 67,
      postproduction: 30,
    });

    expect(progress.overall).toBe(58);
    expect(progress.legend.map(({value}) => value)).toEqual([80, null, 42, 30]);
    expect(progress.storyboardNeedsReview).toBe(0);
  });
});
