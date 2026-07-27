import {API_CONSTRAINTS} from '../../../api/generated/contracts';

export const PROJECT_ANNOTATION_MAX_LENGTH = API_CONSTRAINTS.projectAnnotationMaxLength;
export const PROJECT_SYNOPSIS_MAX_LENGTH = API_CONSTRAINTS.projectSynopsisMaxLength;
export const PROJECT_POSTER_MAX_BYTES = API_CONSTRAINTS.projectPosterMaxBytes;
export const PROJECT_POSTER_MAX_MEGABYTES = PROJECT_POSTER_MAX_BYTES / (1024 * 1024);

const PROJECT_POSTER_MIME_TYPES = new Set(['image/jpeg', 'image/png']);

export type ProjectPosterValidationError = 'unsupported-type' | 'too-large';

export function validateProjectPosterFile(
  file: Pick<File, 'type' | 'size'>,
): ProjectPosterValidationError | null {
  if (!PROJECT_POSTER_MIME_TYPES.has(file.type)) return 'unsupported-type';
  if (file.size > PROJECT_POSTER_MAX_BYTES) return 'too-large';
  return null;
}

export function validateProjectTextLengths(
  annotation: string,
  synopsis: string,
): 'annotation-too-long' | 'synopsis-too-long' | null {
  if (annotation.length > PROJECT_ANNOTATION_MAX_LENGTH) return 'annotation-too-long';
  if (synopsis.length > PROJECT_SYNOPSIS_MAX_LENGTH) return 'synopsis-too-long';
  return null;
}
