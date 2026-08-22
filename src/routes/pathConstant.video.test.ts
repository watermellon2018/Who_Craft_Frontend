import {
  scriptScenePath,
  videoGenerationPath,
  videoPath,
  videoPreparationPath,
} from './pathConstant';

describe('video routes', () => {
  it('builds the entry, preparation and generation paths', () => {
    expect(videoPath(42)).toBe('/project/42/video');
    expect(videoPreparationPath(42)).toBe('/project/42/video/preparation');
    expect(videoGenerationPath(42)).toBe('/project/42/video/generate');
  });

  it('builds a durable screenplay scene deep link', () => {
    expect(scriptScenePath(42, 'scene 7')).toBe('/project/42/script?sceneId=scene%207');
  });
});
