import React, {useEffect, useMemo, useState} from 'react';
import {LeftOutlined, LoadingOutlined, RightOutlined} from '@ant-design/icons';
import {backendAssetUrl} from '../../../../api/http';
import {characterApi} from '../../api/characterApi';
import type {CharacterReference} from '../../types/character.types';

interface Props {
  projectId?: string | number | null;
  characterId?: string;
  // True while the first-open autofit is running, for an inline status note.
  fitting: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  portrait: 'Портрет',
  full_body: 'В полный рост',
  three_quarter: 'Три четверти',
  profile: 'Профиль',
  back_view: 'Со спины',
};

// Read-only strip of the character's locked references, docked to the
// viewport, so the user keeps the source images in view while editing.
// Autofit from these references now runs automatically on the first open
// (no button) — the dock only shows a status note while it's working.
//
// Deliberately NOT useCharacterReferences — that hook auto-generates
// missing references on mount, which a viewer must never trigger.
const ReferenceDock: React.FC<Props> = ({projectId, characterId, fitting}) => {
  const [references, setReferences] = useState<CharacterReference[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [collapsed, setCollapsed] = useState(false);

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

  return (
    <aside className={`c3d-refdock ${collapsed ? 'c3d-refdock--collapsed' : ''}`}>
      <header className="c3d-refdock__head">
        <span>Референсы</span>
        <button
          type="button"
          className="c3d-refdock__toggle"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? 'Развернуть референсы' : 'Свернуть референсы'}
        >
          {collapsed ? <RightOutlined /> : <LeftOutlined />}
        </button>
      </header>

      {!collapsed ? (
        <>
          {active && activeUrl ? (
            <figure className="c3d-refdock__preview">
              <img src={activeUrl} alt={TYPE_LABELS[active.reference_type] ?? active.reference_type} />
              <figcaption>{TYPE_LABELS[active.reference_type] ?? active.reference_type}</figcaption>
            </figure>
          ) : null}

          <div className="c3d-refdock__thumbs" role="tablist" aria-label="Референсы персонажа">
            {references.map((ref, index) => (
              <button
                key={`${ref.reference_type}-${index}`}
                type="button"
                role="tab"
                aria-selected={index === activeIndex}
                className={`c3d-refdock__thumb ${index === activeIndex ? 'c3d-refdock__thumb--active' : ''}`}
                onClick={() => setActiveIndex(index)}
                title={TYPE_LABELS[ref.reference_type] ?? ref.reference_type}
              >
                <img src={backendAssetUrl(ref.image_url ?? '')} alt="" />
              </button>
            ))}
          </div>

          {fitting ? (
            <div className="c3d-refdock__status" role="status">
              <LoadingOutlined />
              <span>Подгоняем по фото…</span>
            </div>
          ) : null}
        </>
      ) : null}
    </aside>
  );
};

export default ReferenceDock;
