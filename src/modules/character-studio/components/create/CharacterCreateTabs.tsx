import React from 'react';
import {FileTextOutlined, PictureOutlined} from '@ant-design/icons';
import {useNavigate} from 'react-router-dom';
import {useProjectIdFromRoute} from '../../hooks/useProjectIdFromRoute';

export type CharacterCreateMode = 'description' | 'reference';

interface CharacterCreateTabsProps {
  activeMode?: CharacterCreateMode;
}

export default function CharacterCreateTabs({activeMode = 'description'}: CharacterCreateTabsProps) {
  const navigate = useNavigate();
  const projectId = useProjectIdFromRoute();
  const descriptionActive = activeMode === 'description';
  const referenceActive = activeMode === 'reference';

  return (
    <div className="character-create-tabs" role="tablist" aria-label="Режим создания персонажа">
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
        Создать по описанию
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
        Создать по референсу
      </button>
    </div>
  );
}
