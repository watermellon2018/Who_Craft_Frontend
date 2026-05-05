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

const tabs: Array<{key: CharacterRegion | 'personality'; label: string; description: string; icon: React.ReactNode}> = [
  {key: 'face', label: 'Лицо', description: 'Черты и мимика', icon: <UserOutlined />},
  {key: 'hair', label: 'Волосы', description: 'Прическа и борода', icon: <BgColorsOutlined />},
  {key: 'body', label: 'Тело', description: 'Телосложение', icon: <TeamOutlined />},
  {key: 'outfit', label: 'Одежда', description: 'Слои и силуэт', icon: <SkinOutlined />},
  {key: 'style', label: 'Настройки', description: 'Общие параметры', icon: <SettingOutlined />},
  {key: 'personality', label: 'Характер', description: 'Поведение и роль', icon: <EyeOutlined />},
];

export default function CharacterCategorySidebar({active, onSelect}: {active: string; onSelect: (key: string) => void;}) {
  return (
    <nav className="character-category-menu" aria-label="Категории редактора">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={`character-category-card${active === tab.key ? ' character-category-card--active' : ''}`}
          onClick={() => onSelect(tab.key)}
        >
          <span className="character-category-card__icon">{tab.icon}</span>
          <span className="character-category-card__copy">
            <span>{tab.label}</span>
            <small>{tab.description}</small>
          </span>
        </button>
      ))}
    </nav>
  );
}
