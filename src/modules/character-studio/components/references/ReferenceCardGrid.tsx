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
import {REFERENCE_LABELS, STATUS_LABELS} from './referenceLabels';

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
  return (
    <nav className="character-category-menu" aria-label="Список референсов">
      {REFERENCE_TYPE_ORDER.map((type) => {
        const row = findRow(references, type);
        const labels = REFERENCE_LABELS[type];
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
              <span>{labels.title}</span>
              <small>{labels.subtitle}</small>
            </span>
            <span
              className={`references-card__badge references-card__badge--${row.status}`}
              title={STATUS_LABELS[row.status]}
              aria-label={STATUS_LABELS[row.status]}
            >
              {row.status === 'generating' ? <LoadingOutlined spin /> : null}
              {row.is_primary && row.status === 'ready' && (
                <em className="references-card__badge-primary" aria-label="Основной референс">★</em>
              )}
            </span>
          </button>
        );
      })}
    </nav>
  );
};

export default ReferenceCardGrid;
