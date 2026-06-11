import React from 'react';
import {Button, List, Tag} from 'antd';
import {useTranslation} from 'react-i18next';
import {CharacterRevision} from '../types/character.types';

export default function RevisionHistory({revisions, onRestore}: {revisions: CharacterRevision[]; onRestore: (revision: CharacterRevision) => void}) {
  const {t} = useTranslation();
  const labels: Record<string, string> = {
    face: t('characterStudio.revisions.face'),
    hair: t('characterStudio.revisions.hair'),
    body: t('characterStudio.revisions.body'),
    outfit: t('characterStudio.revisions.outfit'),
    style: t('characterStudio.revisions.style'),
    full_character: t('characterStudio.revisions.fullCharacter'),
  };
  const regionLabel = (region: string) => labels[region] || t('characterStudio.revisions.common');
  return (
    <List
      dataSource={revisions}
      renderItem={(revision) => (
        <List.Item actions={[<Button key="restore" size="small" onClick={() => onRestore(revision)}>{t('characterStudio.revisions.restore')}</Button>]}>
          <List.Item.Meta
            title={t('characterStudio.revisions.version', {number: revision.revision_number})}
            description={<><Tag>{revision.change_type}</Tag><Tag>{regionLabel(revision.changed_region)}</Tag>{revision.change_summary}</>}
          />
        </List.Item>
      )}
    />
  );
}
