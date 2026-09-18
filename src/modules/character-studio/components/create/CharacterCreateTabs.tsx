import React from 'react';
import {FileTextOutlined, PictureOutlined} from '@ant-design/icons';
import {useNavigate} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {useProjectIdFromRoute} from '../../hooks/useProjectIdFromRoute';

export type CharacterCreateMode = 'description' | 'reference';

interface CharacterCreateTabsProps {
  activeMode?: CharacterCreateMode;
}

export default function CharacterCreateTabs({activeMode = 'description'}: CharacterCreateTabsProps) {
  const navigate = useNavigate();
  const {t} = useTranslation();
  const projectId = useProjectIdFromRoute();
  const descriptionActive = activeMode === 'description';
  const referenceActive = activeMode === 'reference';

  return (
    <div className="character-create-tabs" role="tablist" aria-label={t('characterStudio.create.modeLabel')}>
      <button
        className={`character-create-tabs__item ${descriptionActive ? 'character-create-tabs__item--active' : ''}`}
        type="button"
        aria-current={descriptionActive ? 'page' : undefined}
        onClick={() => {
          if (!descriptionActive) {
            navigate(`/project/${projectId}/characters/create`);
          }
        }}
      >
        <FileTextOutlined />
        {t('characterStudio.create.byDescription')}
      </button>
      <button
        className={`character-create-tabs__item ${referenceActive ? 'character-create-tabs__item--active' : ''}`}
        type="button"
        aria-current={referenceActive ? 'page' : undefined}
        onClick={() => {
          if (!referenceActive) {
            navigate(`/project/${projectId}/characters/create/reference`);
          }
        }}
      >
        <PictureOutlined />
        {t('characterStudio.create.byReference')}
      </button>
    </div>
  );
}
