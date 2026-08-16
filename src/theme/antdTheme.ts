import {theme as antdTheme} from 'antd';
import type {ThemeConfig} from 'antd';

import {CRAFT_ACCENT, CRAFT_ACCENT_HOVER} from '../constants/theme';
import type {CraftTheme} from './craftTheme';

const PALETTES = {
  blue: {
    background: '#07111d',
    border: '#22364a',
    field: '#0b1926',
    muted: '#a5b2c2',
    placeholder: '#74879d',
    surface: '#0d1b2a',
    surfaceRaised: '#102132',
    text: '#f3f6fa',
  },
  dark: {
    background: '#111318',
    border: '#313741',
    field: '#11151d',
    muted: '#b8bdc7',
    placeholder: '#77808d',
    surface: '#141820',
    surfaceRaised: '#191e28',
    text: '#f6f1e6',
  },
  light: {
    background: '#f4f2ed',
    border: '#d8d2c7',
    field: '#ffffff',
    muted: '#69717e',
    placeholder: '#6e7580',
    surface: '#ffffff',
    surfaceRaised: '#f4efe5',
    text: '#20242c',
  },
} as const;

export function createAntTheme(theme: CraftTheme): ThemeConfig {
  const palette = PALETTES[theme];
  const isLight = theme === 'light';

  return {
    algorithm: isLight ? antdTheme.defaultAlgorithm : antdTheme.darkAlgorithm,
    token: {
      borderRadius: 8,
      colorBgBase: palette.background,
      colorBgContainer: palette.surface,
      colorBgElevated: palette.surfaceRaised,
      colorBorder: palette.border,
      colorInfo: CRAFT_ACCENT,
      colorPrimary: CRAFT_ACCENT,
      colorPrimaryHover: CRAFT_ACCENT_HOVER,
      colorText: palette.text,
      colorTextBase: palette.text,
      colorTextPlaceholder: palette.placeholder,
      colorTextSecondary: palette.muted,
      fontSize: 16,
      sizeStep: 3,
      sizeUnit: 3,
      wireframe: false,
    },
    components: {
      Button: {
        colorPrimary: CRAFT_ACCENT,
        colorPrimaryHover: CRAFT_ACCENT_HOVER,
        colorTextLightSolid: 'rgba(0, 0, 0, 0.72)',
        defaultBorderColor: CRAFT_ACCENT,
        defaultColor: CRAFT_ACCENT,
        primaryShadow: 'none',
      },
      Checkbox: {
        colorBgContainer: palette.field,
        colorBorder: palette.border,
        colorPrimary: CRAFT_ACCENT,
        colorPrimaryHover: CRAFT_ACCENT_HOVER,
        colorText: palette.text,
        colorWhite: 'rgba(0, 0, 0, 0.72)',
      },
      Input: {
        colorBgContainer: palette.field,
        colorBorder: palette.border,
        colorText: palette.text,
        colorTextPlaceholder: palette.placeholder,
      },
      InputNumber: {
        colorBgContainer: palette.field,
        colorBorder: palette.border,
        colorText: palette.text,
        colorTextPlaceholder: palette.placeholder,
      },
      Select: {
        colorBgContainer: palette.field,
        colorBgElevated: palette.surfaceRaised,
        colorBorder: palette.border,
        colorText: palette.text,
        colorTextPlaceholder: palette.placeholder,
        optionActiveBg: isLight ? 'rgba(32, 36, 44, 0.06)' : 'rgba(255, 255, 255, 0.05)',
        optionSelectedBg: 'rgba(250, 176, 5, 0.14)',
        optionSelectedColor: isLight ? '#6f4b00' : CRAFT_ACCENT,
        selectorBg: palette.field,
      },
      Switch: {
        colorPrimary: CRAFT_ACCENT,
        colorPrimaryHover: CRAFT_ACCENT_HOVER,
      },
    },
  };
}
