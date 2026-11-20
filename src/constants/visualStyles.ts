import type {ProjectGenerationSettings} from '../api/generated/contracts';

export type VisualStyle = NonNullable<ProjectGenerationSettings['visual_style']>;

export const DEFAULT_VISUAL_STYLE: VisualStyle = 'cinematic_realism';

export const VISUAL_STYLES = [
    DEFAULT_VISUAL_STYLE,
    'anime',
    'pixar_like',
    'stylized_3d',
    'dark_fantasy',
    'cyberpunk',
    'noir',
    'watercolor',
    'comic_book',
] as const satisfies readonly VisualStyle[];
