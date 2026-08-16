import React from 'react';
import {BulbOutlined, CloudOutlined, StarOutlined} from '@ant-design/icons';
import {useTranslation} from 'react-i18next';

import {useCraftTheme} from '../../theme/CraftThemeProvider';
import {nextCraftTheme} from '../../theme/craftTheme';
import type {CraftTheme} from '../../theme/craftTheme';
import './themeControls.css';

const ICONS: Record<CraftTheme, React.ReactNode> = {
  blue: <CloudOutlined />,
  dark: <StarOutlined />,
  light: <BulbOutlined />,
};

export default function ThemeQuickSwitcher() {
  const {t} = useTranslation();
  const {setTheme, theme} = useCraftTheme();
  const nextTheme = nextCraftTheme(theme);
  const currentLabel = t(`profile.settings.theme.${theme}`);
  const nextLabel = t(`profile.settings.theme.${nextTheme}`);

  return (
    <button
      aria-label={t('profile.settings.theme.quickSwitch', {current: currentLabel, next: nextLabel})}
      className="craft-theme-quick-switcher"
      onClick={() => setTheme(nextTheme)}
      title={t('profile.settings.theme.quickSwitch', {current: currentLabel, next: nextLabel})}
      type="button"
    >
      {ICONS[theme]}
      <span className="craft-theme-quick-switcher__label">{currentLabel}</span>
    </button>
  );
}
