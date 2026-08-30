import React from 'react';
import {useTranslation} from 'react-i18next';

import {useCraftTheme} from '../../theme/CraftThemeProvider';
import {CRAFT_THEMES} from '../../theme/craftTheme';
import type {CraftTheme} from '../../theme/craftTheme';
import './themeControls.css';

const PREVIEW_LABEL_KEYS: Record<CraftTheme, string> = {
  blue: 'profile.settings.theme.blue',
  dark: 'profile.settings.theme.dark',
  light: 'profile.settings.theme.light',
};

interface ThemePickerProps {
  disabled?: boolean;
}

export default function ThemePicker({disabled = false}: ThemePickerProps) {
  const {t} = useTranslation();
  const {setTheme, theme} = useCraftTheme();

  return (
    <fieldset className="craft-theme-picker">
      <legend>{t('profile.settings.theme.title')}</legend>
      <p>{t('profile.settings.theme.description')}</p>
      <div className="craft-theme-picker__options">
        {CRAFT_THEMES.map((option) => (
          <label className="craft-theme-option" key={option}>
            <input
              aria-label={t(PREVIEW_LABEL_KEYS[option])}
              checked={theme === option}
              disabled={disabled}
              name="craft-color-theme"
              onChange={() => setTheme(option)}
              type="radio"
              value={option}
            />
            <span className={`craft-theme-option__content craft-theme-option__content--${option}`}>
              <span className="craft-theme-option__preview" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              <span className="craft-theme-option__label">
                {t(PREVIEW_LABEL_KEYS[option])}
              </span>
              <span className="craft-theme-option__check" aria-hidden="true">✓</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
