import React from 'react';
import {CharacterRegion} from '../types/character.types';
import {
  BgColorsOutlined,
  EyeOutlined,
  SettingOutlined,
  SkinOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {useTranslation} from 'react-i18next';

const tabs: Array<{key: CharacterRegion | 'personality'; icon: React.ReactNode}> = [
  {key: 'face', icon: <UserOutlined />},
  {key: 'hair', icon: <BgColorsOutlined />},
  {key: 'body', icon: <TeamOutlined />},
  {key: 'outfit', icon: <SkinOutlined />},
  {key: 'style', icon: <SettingOutlined />},
  {key: 'personality', icon: <EyeOutlined />},
];

export default function CharacterCategorySidebar({active, onSelect}: {active: string; onSelect: (key: string) => void;}) {
  const {t} = useTranslation();
  return (
    <nav className="character-category-menu" aria-label={t('characterStudio.categories.ariaLabel')}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={`character-category-card${active === tab.key ? ' character-category-card--active' : ''}`}
          onClick={() => onSelect(tab.key)}
        >
          <span className="character-category-card__icon">{tab.icon}</span>
          <span className="character-category-card__copy">
            <span>{t(`characterStudio.categories.${tab.key}.label`)}</span>
            <small>{t(`characterStudio.categories.${tab.key}.description`)}</small>
          </span>
        </button>
      ))}
    </nav>
  );
}
