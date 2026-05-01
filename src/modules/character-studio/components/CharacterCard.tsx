import React from 'react';
import {Button, Card, Tag} from 'antd';
import {CloseOutlined, EditOutlined, LockOutlined} from '@ant-design/icons';
import {StudioCharacter} from '../types/character.types';
import {roleLabelMap} from './create/characterCreateOptions';

export default function CharacterCard({character, onEdit, onDelete}: {character: StudioCharacter; onEdit: () => void; onDelete: () => void}) {
  const image = character.images?.portrait?.image_url || character.references?.[0]?.image_url;
  return (
    <Card
      style={{position: 'relative'}}
      cover={image ? <img src={image} alt={character.name} style={{height: 220, objectFit: 'cover'}} /> : <div style={{height: 220, display: 'grid', placeItems: 'center', background: '#111318'}}>No image</div>}
    >
      <Button
        aria-label="Удалить персонажа"
        icon={<CloseOutlined />}
        onClick={onDelete}
        size="small"
        type="primary"
        danger
        style={{position: 'absolute', top: 8, right: 8, zIndex: 1}}
      />
      <Card.Meta title={character.name} description={character.role ? (roleLabelMap[character.role] ?? character.role) : 'Роль не указана'} />
      {character.identity_locked && (
        <div style={{marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap'}}>
          <Tag icon={<LockOutlined />} color="gold">locked</Tag>
        </div>
      )}
      <Button
        icon={<EditOutlined />}
        onClick={onEdit}
        style={{marginTop: 14, color: '#111318', borderColor: '#111318', fontWeight: 600}}
      >
        Edit
      </Button>
    </Card>
  );
}
