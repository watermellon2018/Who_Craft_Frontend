import React from 'react';
import {Button, List, Tag} from 'antd';
import {CharacterRevision} from '../types/character.types';

export default function RevisionHistory({revisions, onRestore}: {revisions: CharacterRevision[]; onRestore: (revision: CharacterRevision) => void}) {
  return (
    <List
      dataSource={revisions}
      renderItem={(revision) => (
        <List.Item actions={[<Button key="restore" size="small" onClick={() => onRestore(revision)}>Восстановить</Button>]}>
          <List.Item.Meta
            title={`Версия ${revision.revision_number}`}
            description={<><Tag>{revision.change_type}</Tag><Tag>{regionLabel(revision.changed_region)}</Tag>{revision.change_summary}</>}
          />
        </List.Item>
      )}
    />
  );
}

function regionLabel(region: string) {
  const labels: Record<string, string> = {
    face: 'Лицо',
    hair: 'Волосы',
    body: 'Тело',
    outfit: 'Одежда',
    style: 'Стиль',
    full_character: 'Персонаж',
  };
  return labels[region] || 'Общее';
}
