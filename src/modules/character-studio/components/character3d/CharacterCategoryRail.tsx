import React from 'react';
import {ZoneGroup} from './zones';

interface Props {
  active: ZoneGroup | null;
  onSelect: (group: ZoneGroup) => void;
}

const CATEGORIES: Array<{key: ZoneGroup; label: string; icon: React.ReactNode}> = [
  {key: 'body', label: 'Тело', icon: <BodyIcon />},
  {key: 'face', label: 'Лицо', icon: <FaceIcon />},
  {key: 'hair', label: 'Волосы', icon: <HairIcon />},
  {key: 'skin', label: 'Кожа', icon: <SkinIcon />},
  {key: 'clothing', label: 'Одежда', icon: <ClothingIcon />},
  {key: 'pose', label: 'Поза', icon: <PoseIcon />},
];

const CharacterCategoryRail: React.FC<Props> = ({active, onSelect}) => {
  return (
    <nav className="c3d-rail" aria-label="Категории редактора">
      <div className="c3d-rail__inner">
        {CATEGORIES.map((category) => {
          const isActive = active === category.key;
          return (
            <button
              key={category.key}
              type="button"
              className={`c3d-rail__item ${isActive ? 'c3d-rail__item--active' : ''}`}
              onClick={() => onSelect(category.key)}
              aria-pressed={isActive}
            >
              <span className="c3d-rail__icon">{category.icon}</span>
              <span className="c3d-rail__label">{category.label}</span>
              {isActive ? <span className="c3d-rail__bar" /> : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

function BodyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
      <circle cx={12} cy={5.5} r={2.2} />
      <path d="M7 22 L8 14 L6.5 11 L12 9 L17.5 11 L16 14 L17 22" />
    </svg>
  );
}

function FaceIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
      <ellipse cx={12} cy={12} rx={6.5} ry={8} />
      <circle cx={9.5} cy={11} r={0.9} fill="currentColor" />
      <circle cx={14.5} cy={11} r={0.9} fill="currentColor" />
      <path d="M9.5 15.5 Q12 17 14.5 15.5" />
    </svg>
  );
}

function HairIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
      <path d="M5 14 Q5 5 12 5 Q19 5 19 14 Q17 12 15 13 Q14 9 12 9 Q10 9 9 13 Q7 12 5 14 Z" fill="currentColor" opacity={0.18} />
      <path d="M5 14 Q5 5 12 5 Q19 5 19 14" />
    </svg>
  );
}

function SkinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
      <circle cx={12} cy={12} r={7} />
      <circle cx={9} cy={10} r={0.8} fill="currentColor" />
      <circle cx={14} cy={9} r={0.6} fill="currentColor" />
      <circle cx={15} cy={13} r={0.7} fill="currentColor" />
      <circle cx={10} cy={14} r={0.5} fill="currentColor" />
    </svg>
  );
}

function ClothingIcon() {
  // A simple t-shirt glyph: collar + body + two sleeves.
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 4 L6 6 L3.5 8.5 L6 11 L7.5 9.5 L7.5 20 L16.5 20 L16.5 9.5 L18 11 L20.5 8.5 L18 6 L15 4 Q12 6 9 4 Z" />
    </svg>
  );
}

function PoseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <circle cx={12} cy={4} r={1.8} />
      <path d="M12 6 L12 14 M12 9 L7 11 M12 9 L17 11 M12 14 L8 21 M12 14 L16 21" />
    </svg>
  );
}

export default CharacterCategoryRail;
