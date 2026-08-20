import type {
  MusicBrief,
  MusicModelCapabilities,
  MusicModelSpec,
  MusicReferenceAsset,
  MusicCapabilities,
} from './types';

export const LEGACY_MUSIC_MODEL_KEY = '__legacy__';

function legacyCapabilities(capabilities: MusicCapabilities): MusicModelCapabilities {
  const legacy = {...capabilities};
  delete legacy.defaultModelKey;
  delete legacy.models;
  return legacy;
}

export function musicModelCatalog(capabilities: MusicCapabilities): MusicModelSpec[] {
  if (capabilities.models?.length) {
    const fallback = legacyCapabilities(capabilities);
    return capabilities.models.map((model) => ({
      ...model,
      capabilities: {
        ...fallback,
        ...model.capabilities,
        briefFields: model.capabilities.briefFields ?? fallback.briefFields,
      },
    }));
  }
  return [{
    capabilities: legacyCapabilities(capabilities),
    configured: true,
    default: true,
    key: LEGACY_MUSIC_MODEL_KEY,
    label: capabilities.providerDisplayName,
    preview: false,
    routes: [],
  }];
}

export function initialMusicModelKey(
  capabilities: MusicCapabilities,
  preferredKey: string | null,
): string {
  const models = musicModelCatalog(capabilities);
  const preferred = models.find((model) => model.key === preferredKey && model.configured);
  if (preferred) return preferred.key;
  const configuredDefault = models.find(
    (model) => model.key === capabilities.defaultModelKey && model.configured,
  ) ?? models.find((model) => model.default && model.configured);
  return configuredDefault?.key ?? models.find((model) => model.configured)?.key ?? models[0].key;
}

export function selectedMusicModel(
  capabilities: MusicCapabilities,
  selectedKey: string | null,
): MusicModelSpec {
  const models = musicModelCatalog(capabilities);
  return models.find((model) => model.key === selectedKey)
    ?? models.find((model) => model.key === initialMusicModelKey(capabilities, null))
    ?? models[0];
}

export function enqueueMusicModelKey(selectedKey: string): string | undefined {
  return selectedKey === LEGACY_MUSIC_MODEL_KEY ? undefined : selectedKey;
}

function closestVariantCount(variantCounts: number[], current: number): number {
  if (!variantCounts.length) return current;
  return variantCounts.reduce((closest, candidate) => (
    Math.abs(candidate - current) < Math.abs(closest - current) ? candidate : closest
  ));
}

interface ConstrainedMusicDraft {
  brief: MusicBrief;
  reference: MusicReferenceAsset | null;
  variantCount: number;
}

export function constrainMusicDraft(
  brief: MusicBrief,
  reference: MusicReferenceAsset | null,
  variantCount: number,
  capabilities: MusicModelCapabilities,
  defaultVerseLabel: string,
): ConstrainedMusicDraft {
  const durationSeconds = Math.min(
    capabilities.duration.maxSeconds,
    Math.max(capabilities.duration.minSeconds, brief.durationSeconds),
  );
  const nextVariantCount = capabilities.variantCounts.includes(variantCount)
    ? variantCount
    : closestVariantCount(capabilities.variantCounts, variantCount);
  let content = brief.content;
  if (!capabilities.contentModes.includes(content.mode)) {
    content = capabilities.contentModes.includes('instrumental')
      ? {mode: 'instrumental'}
      : {
          lyricsLanguage: capabilities.lyrics.languages[0] ?? 'ru',
          mode: 'song',
          sections: [{label: defaultVerseLabel, text: '', type: 'verse'}],
          vocalStyle: {
            delivery: capabilities.briefFields.vocalStyles.deliveries[0] ?? 'soft',
            timbre: capabilities.briefFields.vocalStyles.timbres[0] ?? 'warm',
          },
        };
  }
  const seed = capabilities.supportsSeed ? brief.seed : undefined;
  const purpose = capabilities.briefFields.purposes.includes(brief.purpose)
    ? brief.purpose
    : capabilities.briefFields.purposes.find((item) => item !== 'song')
      ?? capabilities.briefFields.purposes[0]
      ?? '';
  const genre = capabilities.briefFields.genres.includes(brief.genre)
    ? brief.genre
    : capabilities.briefFields.genres[0] ?? '';
  const moods = brief.moods.filter((mood) => capabilities.briefFields.moods.includes(mood));
  const energyCurve = capabilities.briefFields.energyCurves.includes(brief.energyCurve)
    ? brief.energyCurve
    : capabilities.briefFields.energyCurves[0] ?? brief.energyCurve;
  const tempo = capabilities.briefFields.tempoModes.includes(brief.tempo.mode)
    ? brief.tempo
    : {mode: capabilities.briefFields.tempoModes[0] ?? 'auto'};

  return {
    brief: {
      ...brief,
      content,
      durationSeconds,
      energyCurve,
      exclude: brief.exclude.filter(
        (instrument) => capabilities.briefFields.instruments.includes(instrument),
      ),
      genre,
      instruments: brief.instruments.filter(
        (instrument) => capabilities.briefFields.instruments.includes(instrument),
      ),
      moods: moods.length ? moods : capabilities.briefFields.moods.slice(0, 1),
      purpose,
      seed,
      tempo,
    },
    reference: capabilities.audioReference.supported ? reference : null,
    variantCount: nextVariantCount,
  };
}
