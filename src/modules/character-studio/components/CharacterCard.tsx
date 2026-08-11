import React from 'react';
import {Button, Card, Tag} from 'antd';
import {CloseOutlined, LockOutlined} from '@ant-design/icons';
import {StudioCharacter} from '../types/character.types';
import {roleLabelMap} from './create/characterCreateOptions';

// Only fall back to character assets that legitimately stand in for a portrait
// (a generated portrait asset or the user's original uploaded reference photo).
// Picking any recent asset of this character would surface things like clothing
// reference uploads or zone-edit intermediate assets that aren't portraits.
const PORTRAIT_REFERENCE_ASSET_TYPES = new Set(['portrait', 'uploaded_reference']);

// Append the asset_id as a cache-buster so the gallery never shows a stale
// browser-cached image after the user edits a portrait. The editor already
// does the same; without it here the gallery and editor would diverge on
// the same URL (one showing the cached old face, the other the new one).
function withCacheBust(url: string, key?: string | null) {
  if (!key) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}_cb=${encodeURIComponent(key)}`;
}

export default function CharacterCard({character, onEdit, onDelete}: {character: StudioCharacter; onEdit: () => void; onDelete: () => void}) {
  const portraitAsset = character.images?.portrait;
  const portraitFallback = (character.references || []).find(
    (reference) => PORTRAIT_REFERENCE_ASSET_TYPES.has(reference.asset_type),
  );
  const rawImage = portraitAsset?.image_url || portraitFallback?.image_url;
  const cacheKey = portraitAsset?.asset_id || portraitFallback?.asset_id;
  const image = rawImage ? withCacheBust(rawImage, cacheKey) : undefined;
  return (
    <div style={{position: 'relative'}}>
      <Card
        style={{position: 'relative'}}
        cover={image ? <img src={image} alt={character.name} style={{height: 220, objectFit: 'cover'}} /> : <div style={{height: 220, display: 'grid', placeItems: 'center', background: '#111318'}}>No image</div>}
      >
        <Card.Meta title={character.name} description={character.role ? (roleLabelMap[character.role] ?? character.role) : 'Роль не указана'} />
        {character.identity_locked && (
          <div style={{marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap'}}>
            <Tag icon={<LockOutlined />} color="gold">locked</Tag>
          </div>
        )}
      </Card>
      <button
        aria-label={`Редактировать персонажа «${character.name}»`}
        onClick={onEdit}
        type="button"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          border: 0,
          borderRadius: 8,
          background: 'transparent',
          cursor: 'pointer',
        }}
      />
      <Button
        aria-label="Удалить персонажа"
        icon={<CloseOutlined />}
        onClick={onDelete}
        size="small"
        type="primary"
        danger
        style={{position: 'absolute', top: 8, right: 8, zIndex: 2}}
      />
    </div>
  );
}
