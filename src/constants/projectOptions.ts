// Shared dictionaries for project editor selects.
//
// Backend stores `format`, `genre`, `audience` as plain strings; frontend
// renders human-readable Russian labels. Values must stay snake_case so they
// pass backend serializer validation in
// backend/w_craft_back/movie/project/serializers.py.

export interface Option {
    value: string;
    label: string;
}

export const PROJECT_FORMAT_OPTIONS: Option[] = [
    { value: 'feature_film', label: 'Полнометражный фильм' },
    { value: 'short_film', label: 'Короткометражный фильм' },
    { value: 'series', label: 'Сериал' },
    { value: 'clip', label: 'Клип' },
    { value: 'commercial', label: 'Реклама' },
    { value: 'other', label: 'Другое' },
];

export const PROJECT_GENRE_OPTIONS: Option[] = [
    { value: 'drama', label: 'Драма' },
    { value: 'comedy', label: 'Комедия' },
    { value: 'action', label: 'Экшен' },
    { value: 'thriller', label: 'Триллер' },
    { value: 'horror', label: 'Хоррор' },
    { value: 'sci_fi', label: 'Научная фантастика' },
    { value: 'fantasy', label: 'Фэнтези' },
    { value: 'adventure', label: 'Приключения' },
    { value: 'romance', label: 'Романтика' },
    { value: 'detective', label: 'Детектив' },
    { value: 'mystery', label: 'Мистика' },
    { value: 'crime', label: 'Криминал' },
    { value: 'historical', label: 'Исторический' },
    { value: 'documentary', label: 'Документальный' },
    { value: 'animation', label: 'Анимация' },
    { value: 'family', label: 'Семейный' },
    { value: 'musical', label: 'Мюзикл' },
    { value: 'war', label: 'Военный' },
    { value: 'western', label: 'Вестерн' },
    { value: 'cyberpunk', label: 'Киберпанк' },
    { value: 'post_apocalyptic', label: 'Постапокалипсис' },
    { value: 'slice_of_life', label: 'Повседневность' },
    { value: 'superhero', label: 'Супергерои' },
    { value: 'other', label: 'Другое' },
];

export const PROJECT_TARGET_AUDIENCE_OPTIONS: Option[] = [
    { value: 'all', label: 'Все' },
    { value: 'kids', label: 'Дети' },
    { value: 'teens', label: 'Подростки' },
    { value: 'young_adults', label: 'Молодёжь' },
    { value: 'adults', label: 'Взрослые' },
    { value: 'elderly', label: 'Пожилые люди' },
];

export const GENRE_VALUES = new Set(PROJECT_GENRE_OPTIONS.map((o) => o.value));

export function genreLabel(value: string | null | undefined): string {
    if (!value) return '';
    const found = PROJECT_GENRE_OPTIONS.find((o) => o.value === value);
    return found ? found.label : value;
}
