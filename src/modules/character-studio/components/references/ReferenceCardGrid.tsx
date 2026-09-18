import React from 'react';
import {
  CameraOutlined,
  LoadingOutlined,
  PictureOutlined,
  ProfileOutlined,
  RetweetOutlined,
  SkinOutlined,
  SmileOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {CharacterReference, REFERENCE_TYPE_ORDER, ReferenceType} from '../../types/character.types';
import {useTranslation} from 'react-i18next';
import {REFERENCE_LABEL_KEYS, STATUS_LABEL_KEYS} from './referenceLabels';

interface Props {
  references: CharacterReference[];
  selectedType: ReferenceType;
  onSelect: (type: ReferenceType) => void;
}

const ICONS: Record<ReferenceType, React.ReactNode> = {
  portrait: <UserOutlined />,
  full_body: <TeamOutlined />,
  three_quarter: <RetweetOutlined />,
  profile: <ProfileOutlined />,
  back_view: <CameraOutlined />,
  emotions: <SmileOutlined />,
  poses: <ThunderboltOutlined />,
  outfit_details: <SkinOutlined />,
  character_sheet: <PictureOutlined />,
};

function findRow(refs: CharacterReference[], type: ReferenceType): CharacterReference {
  return (
    refs.find((row) => row.reference_type === type) || {
      reference_type: type,
      status: 'missing',
      asset_id: null,
      image_url: null,
      is_primary: false,
      version: 0,
      source: null,
    }
  );
}

const ReferenceCardGrid: React.FC<Props> = ({references, selectedType, onSelect}) => {
  const {t} = useTranslation();
  return (
    <nav className="character-category-menu" aria-label={t('characterStudio.references.listLabel')}>
      {REFERENCE_TYPE_ORDER.map((type) => {
        const row = findRow(references, type);
        const labelKeys = REFERENCE_LABEL_KEYS[type];
        const isSelected = selectedType === type;
        const className = `character-category-card${isSelected ? ' character-category-card--active' : ''}`;
        return (
          <button
            type="button"
            key={type}
            className={className}
            onClick={() => onSelect(type)}
          >
            <span className="character-category-card__icon">{ICONS[type]}</span>
            <span className="character-category-card__copy">
              <span>{t(labelKeys.title)}</span>
              <small>{t(labelKeys.subtitle)}</small>
            </span>
            <span
              className={`references-card__badge references-card__badge--${row.status}`}
              title={t(STATUS_LABEL_KEYS[row.status])}
              aria-label={t(STATUS_LABEL_KEYS[row.status])}
            >
              {row.status === 'generating' ? <LoadingOutlined spin /> : null}
              {row.is_primary && row.status === 'ready' && (
                <em className="references-card__badge-primary" aria-label={t('characterStudio.references.primaryLabel')}>★</em>
              )}
            </span>
          </button>
        );
      })}
    </nav>
  );
};

export default ReferenceCardGrid;
