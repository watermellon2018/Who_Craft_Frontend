// Shared dictionaries for project editor selects.
//
// Backend stores `format`, `genre`, `audience` as plain strings; frontend
// translates stable label keys at render time. Values must stay snake_case so they
// pass backend serializer validation in
// backend/w_craft_back/movie/project/serializers.py.

export interface Option {
    value: string;
    labelKey: string;
}

export const PROJECT_FORMAT_OPTIONS: Option[] = [
    { value: 'feature_film', labelKey: 'project.options.format.featureFilm' },
    { value: 'short_film', labelKey: 'project.options.format.shortFilm' },
    { value: 'series', labelKey: 'project.options.format.series' },
    { value: 'clip', labelKey: 'project.options.format.clip' },
    { value: 'commercial', labelKey: 'project.options.format.commercial' },
    { value: 'other', labelKey: 'project.options.format.other' },
];

export const PROJECT_GENRE_OPTIONS: Option[] = [
    { value: 'drama', labelKey: 'project.options.genre.drama' },
    { value: 'comedy', labelKey: 'project.options.genre.comedy' },
    { value: 'action', labelKey: 'project.options.genre.action' },
    { value: 'thriller', labelKey: 'project.options.genre.thriller' },
    { value: 'horror', labelKey: 'project.options.genre.horror' },
    { value: 'sci_fi', labelKey: 'project.options.genre.sciFi' },
    { value: 'fantasy', labelKey: 'project.options.genre.fantasy' },
    { value: 'adventure', labelKey: 'project.options.genre.adventure' },
    { value: 'romance', labelKey: 'project.options.genre.romance' },
    { value: 'detective', labelKey: 'project.options.genre.detective' },
    { value: 'mystery', labelKey: 'project.options.genre.mystery' },
    { value: 'crime', labelKey: 'project.options.genre.crime' },
    { value: 'historical', labelKey: 'project.options.genre.historical' },
    { value: 'documentary', labelKey: 'project.options.genre.documentary' },
    { value: 'animation', labelKey: 'project.options.genre.animation' },
    { value: 'family', labelKey: 'project.options.genre.family' },
    { value: 'musical', labelKey: 'project.options.genre.musical' },
    { value: 'war', labelKey: 'project.options.genre.war' },
    { value: 'western', labelKey: 'project.options.genre.western' },
    { value: 'cyberpunk', labelKey: 'project.options.genre.cyberpunk' },
    { value: 'post_apocalyptic', labelKey: 'project.options.genre.postApocalyptic' },
    { value: 'slice_of_life', labelKey: 'project.options.genre.sliceOfLife' },
    { value: 'superhero', labelKey: 'project.options.genre.superhero' },
    { value: 'other', labelKey: 'project.options.genre.other' },
];

export const PROJECT_TARGET_AUDIENCE_OPTIONS: Option[] = [
    { value: 'all', labelKey: 'project.options.audience.all' },
    { value: 'kids', labelKey: 'project.options.audience.kids' },
    { value: 'teens', labelKey: 'project.options.audience.teens' },
    { value: 'young_adults', labelKey: 'project.options.audience.youngAdults' },
    { value: 'adults', labelKey: 'project.options.audience.adults' },
    { value: 'elderly', labelKey: 'project.options.audience.elderly' },
];

export const GENRE_VALUES = new Set(PROJECT_GENRE_OPTIONS.map((o) => o.value));
