import {
  PROJECT_ANNOTATION_MAX_LENGTH,
  PROJECT_POSTER_MAX_BYTES,
  PROJECT_POSTER_MAX_MEGABYTES,
  PROJECT_SYNOPSIS_MAX_LENGTH,
  validateProjectPosterFile,
  validateProjectTextLengths,
} from './projectFormContract';

describe('project form OpenAPI constraints', () => {
  it('uses separate annotation and synopsis limits', () => {
    expect(PROJECT_ANNOTATION_MAX_LENGTH).toBe(800);
    expect(PROJECT_POSTER_MAX_MEGABYTES).toBe(5);
    expect(PROJECT_SYNOPSIS_MAX_LENGTH).toBe(2000);
    expect(validateProjectTextLengths('a'.repeat(800), 's'.repeat(2000))).toBeNull();
    expect(validateProjectTextLengths('a'.repeat(801), 's')).toBe('annotation-too-long');
    expect(validateProjectTextLengths('a', 's'.repeat(801))).toBeNull();
    expect(validateProjectTextLengths('a', 's'.repeat(2001))).toBe('synopsis-too-long');
  });

  it('rejects invalid poster files before preview/payload processing', () => {
    expect(validateProjectPosterFile({type: 'text/plain', size: 10})).toBe('unsupported-type');
    expect(validateProjectPosterFile({
      type: 'image/png',
      size: PROJECT_POSTER_MAX_BYTES + 1,
    })).toBe('too-large');
    expect(validateProjectPosterFile({
      type: 'image/jpeg',
      size: PROJECT_POSTER_MAX_BYTES,
    })).toBeNull();
  });
});
