import React from 'react';
import {Button, Card, Tag} from 'antd';
import {CloseOutlined, LockOutlined} from '@ant-design/icons';
import {useTranslation} from 'react-i18next';
import type {StudioCharacter} from '../types/character.types';
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

interface CharacterCardProps {
  busy?: boolean;
  character: StudioCharacter;
  onDelete: () => void;
  onEdit: () => void;
}

export default function CharacterCard({busy = false, character, onEdit, onDelete}: CharacterCardProps) {
  const {t} = useTranslation();
  const isDraft = character.status === 'draft';
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
        loading={busy}
        style={{position: 'relative'}}
        cover={image ? <img src={image} alt={character.name} style={{height: 220, objectFit: 'cover'}} /> : <div style={{height: 220, display: 'grid', placeItems: 'center', background: '#111318'}}>{isDraft ? t('characterStudio.gallery.draftPlaceholder') : t('characterStudio.gallery.noImage')}</div>}
      >
        <Card.Meta
          title={character.name}
          description={isDraft
            ? t('characterStudio.gallery.draftDescription')
            : character.role
              ? (roleLabelMap[character.role] ?? character.role)
              : t('characterStudio.gallery.roleMissing')}
        />
        {isDraft && (
          <div style={{marginTop: 12}}>
            <Tag color="gold">{t('characterStudio.gallery.draftBadge')}</Tag>
          </div>
        )}
        {character.identity_locked && (
          <div style={{marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap'}}>
            <Tag icon={<LockOutlined />} color="gold">locked</Tag>
          </div>
        )}
      </Card>
      <button
        aria-label={isDraft
          ? t('characterStudio.gallery.resumeDraftAria', {name: character.name})
          : t('characterStudio.gallery.editCharacterAria', {name: character.name})}
        disabled={busy}
        onClick={onEdit}
        type="button"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          border: 0,
          borderRadius: 8,
          background: 'transparent',
          cursor: busy ? 'wait' : 'pointer',
        }}
      />
      <Button
        aria-label={isDraft
          ? t('characterStudio.gallery.deleteDraftAria', {name: character.name})
          : t('characterStudio.gallery.deleteCharacterAria', {name: character.name})}
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
