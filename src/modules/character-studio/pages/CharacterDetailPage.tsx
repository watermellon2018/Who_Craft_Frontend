import React from 'react';
import {Button, Descriptions, List} from 'antd';
import {useNavigate, useParams} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {useCharacter} from '../hooks/useCharacter';
import {getRoleLabel} from '../components/create/characterCreateOptions';

export default function CharacterDetailPage() {
  const {projectId = '', characterId = ''} = useParams();
  const navigate = useNavigate();
  const {t} = useTranslation();
  const {character} = useCharacter(projectId, characterId);
  if (!character) return null;
  return <div style={{padding: 24, minHeight: '100vh', background: 'var(--craft-bg-deep)'}}>
    <Button type="primary" onClick={() => navigate(`/project/${projectId}/characters/${characterId}/edit`)}>{t('characterStudio.detail.openEditor')}</Button>
    <Descriptions title={character.name} bordered style={{marginTop: 20}}>
      <Descriptions.Item label={t('characterStudio.create.basicInfo.role')}>{character.role ? getRoleLabel(character.role, t) : '—'}</Descriptions.Item>
      <Descriptions.Item label={t('characterStudio.detail.identityLocked')}>{String(character.identity_locked)}</Descriptions.Item>
      <Descriptions.Item label={t('characterStudio.detail.style')}>{character.visual_style}</Descriptions.Item>
      <Descriptions.Item label={t('characterStudio.create.basicInfo.age')}>{character.age}</Descriptions.Item>
      <Descriptions.Item label={t('characterStudio.create.basicInfo.gender')}>{character.gender}</Descriptions.Item>
    </Descriptions>
    <List header={t('characterStudio.detail.outfits')} dataSource={character.outfits || []} renderItem={(outfit) => <List.Item>{outfit.name}</List.Item>} />
  </div>;
}
