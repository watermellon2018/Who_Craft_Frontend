import React from 'react';
import {Button} from 'antd';
import {ArrowLeftOutlined} from '@ant-design/icons';
import {useNavigate} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import CharacterCreateTabs, {CharacterCreateMode} from './CharacterCreateTabs';
import {useProjectIdFromRoute} from '../../hooks/useProjectIdFromRoute';

interface CharacterCreateHeaderProps {
  activeMode: CharacterCreateMode;
  subtitle: string;
}

export default function CharacterCreateHeader({activeMode, subtitle}: CharacterCreateHeaderProps) {
  const navigate = useNavigate();
  const {t} = useTranslation();
  const projectId = useProjectIdFromRoute();

  return (
    <header className="character-create-hero">
      <div className="character-create-hero__copy">
        <Button
          className="character-create-back-button"
          htmlType="button"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate(`/project/${projectId}/characters`)}
        >
          {t('characterStudio.editor.back')}
        </Button>
        <p className="character-create-eyebrow">{t('characterStudio.create.studio')}</p>
        <h1>{t('characterStudio.create.title')}</h1>
        <p className="character-create-hero__subtitle">{subtitle}</p>
      </div>
      <CharacterCreateTabs activeMode={activeMode} />
    </header>
  );
}
