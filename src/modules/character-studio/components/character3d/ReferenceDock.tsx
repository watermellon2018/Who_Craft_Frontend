import React, {useEffect, useMemo, useState} from 'react';
import {LeftOutlined, LoadingOutlined, PictureOutlined} from '@ant-design/icons';
import {useTranslation} from 'react-i18next';
import {backendAssetUrl} from '../../../../api/http';
import {characterApi} from '../../api/characterApi';
import type {CharacterReference} from '../../types/character.types';

interface Props {
  projectId?: string | number | null;
  characterId?: string;
  // True while the first-open autofit is running, for an inline status note.
  fitting: boolean;
}

const TYPE_LABEL_KEYS: Record<string, string> = {
  portrait: 'characterStudio3d.references.types.portrait',
  full_body: 'characterStudio3d.references.types.fullBody',
  three_quarter: 'characterStudio3d.references.types.threeQuarter',
  profile: 'characterStudio3d.references.types.profile',
  back_view: 'characterStudio3d.references.types.backView',
};

// Read-only strip of the character's locked references, docked to the
// viewport, so the user keeps the source images in view while editing.
// Autofit from these references now runs automatically on the first open
// (no button) — the dock only shows a status note while it's working.
//
// Deliberately NOT useCharacterReferences — that hook auto-generates
// missing references on mount, which a viewer must never trigger.
const ReferenceDock: React.FC<Props> = ({projectId, characterId, fitting}) => {
  const {t} = useTranslation();
  const [references, setReferences] = useState<CharacterReference[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  // Collapsed by default — the dock would otherwise cover the model on open.
  // The user expands it when they want the references in view.
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    if (!projectId || !characterId) return undefined;
    let alive = true;
    characterApi
      .getReferences(projectId, characterId)
      .then((res) => {
        if (!alive) return;
        const rows: CharacterReference[] = res.data?.references ?? [];
        setReferences(rows.filter((row) => !!row.image_url));
      })
      .catch(() => {
        // No board (draft character / offline) — the dock simply hides.
      });
    return () => {
      alive = false;
    };
  }, [projectId, characterId]);

  const active = references[activeIndex] ?? null;
  const activeUrl = useMemo(
    () => (active?.image_url ? backendAssetUrl(active.image_url) : null),
    [active],
  );

  if (!projectId || !characterId || references.length === 0) return null;

  // Collapsed: a single compact pill that doesn't cover the model. Expanded:
  // the full reference strip.
  if (collapsed) {
    return (
      <button
        type="button"
        className="c3d-refdock c3d-refdock--collapsed"
        onClick={() => setCollapsed(false)}
        aria-label={t('characterStudio3d.references.show')}
        title={t('characterStudio3d.references.show')}
      >
        <PictureOutlined />
        <span>{t('characterStudio3d.references.title')}</span>
      </button>
    );
  }

  return (
    <aside className="c3d-refdock">
      <header className="c3d-refdock__head">
        <span>{t('characterStudio3d.references.title')}</span>
        <button
          type="button"
          className="c3d-refdock__toggle"
          onClick={() => setCollapsed(true)}
          aria-label={t('characterStudio3d.references.collapse')}
        >
          <LeftOutlined />
        </button>
      </header>

      {active && activeUrl ? (
        <figure className="c3d-refdock__preview">
          <div className="c3d-refdock__preview-frame">
            <img
              src={activeUrl}
              alt={TYPE_LABEL_KEYS[active.reference_type]
                ? t(TYPE_LABEL_KEYS[active.reference_type])
                : active.reference_type}
            />
          </div>
          <figcaption>
            {TYPE_LABEL_KEYS[active.reference_type]
              ? t(TYPE_LABEL_KEYS[active.reference_type])
              : active.reference_type}
          </figcaption>
        </figure>
      ) : null}

      <div className="c3d-refdock__thumbs" role="tablist" aria-label={t('characterStudio3d.references.listLabel')}>
        {references.map((ref, index) => (
          <button
            key={`${ref.reference_type}-${index}`}
            type="button"
            role="tab"
            aria-selected={index === activeIndex}
            className={`c3d-refdock__thumb ${index === activeIndex ? 'c3d-refdock__thumb--active' : ''}`}
            onClick={() => setActiveIndex(index)}
            title={TYPE_LABEL_KEYS[ref.reference_type]
              ? t(TYPE_LABEL_KEYS[ref.reference_type])
              : ref.reference_type}
          >
            <img src={backendAssetUrl(ref.image_url ?? '')} alt="" />
          </button>
        ))}
      </div>

      {fitting ? (
        <div className="c3d-refdock__status" role="status">
          <LoadingOutlined />
          <span>{t('characterStudio3d.references.fitting')}</span>
        </div>
      ) : null}
    </aside>
  );
};

export default ReferenceDock;
