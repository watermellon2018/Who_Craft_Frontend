import {CheckOutlined, PictureOutlined} from '@ant-design/icons';
import {Button, Drawer, Empty, Tabs} from 'antd';
import React, {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';

import {safeImageUrl} from '../../../utils/safeUrl';
import type {StoryboardSceneEntity} from '../model';

interface VisualReferenceDrawerProps {
  entities: StoryboardSceneEntity[];
  open: boolean;
  selectedIds: string[];
  onApply: (selectedIds: string[]) => void;
  onClose: () => void;
}

const CATEGORY_KEYS = ['character', 'location', 'object', 'clothing', 'other'] as const;

export default function VisualReferenceDrawer({
  entities,
  open,
  selectedIds,
  onApply,
  onClose,
}: VisualReferenceDrawerProps) {
  const {t} = useTranslation();
  const [draftIds, setDraftIds] = useState<string[]>(selectedIds);

  useEffect(() => {
    if (open) setDraftIds(selectedIds);
  }, [open, selectedIds]);

  return (
    <Drawer
      extra={(
        <Button onClick={() => onApply(draftIds)} type="primary">
          {t('common.apply')}
        </Button>
      )}
      onClose={onClose}
      open={open}
      size="large"
      title={t('storyboard.visualReferences')}
    >
      <Tabs
        items={CATEGORY_KEYS.map((category) => {
          const categoryEntities = entities.filter(({type}) => type === category);
          return {
            children: categoryEntities.length === 0 ? (
              <Empty description={t('storyboard.library.empty')} />
            ) : (
              <div className="storyboard-reference-grid">
                {categoryEntities.map((entity) => {
                  const selected = draftIds.includes(entity.id);
                  const entityImageUrl = safeImageUrl(entity.imageUrl);
                  return (
                    <button
                      aria-pressed={selected}
                      className={`storyboard-asset-card${selected ? ' storyboard-asset-card--selected' : ''}`}
                      key={entity.id}
                      onClick={() => setDraftIds((current) => (
                        selected
                          ? current.filter((id) => id !== entity.id)
                          : [...current, entity.id]
                      ))}
                      type="button"
                    >
                      <span className="storyboard-asset-card__visual">
                        {entityImageUrl
                          ? <img alt="" src={entityImageUrl} />
                          : selected
                            ? <CheckOutlined aria-hidden="true" />
                            : <PictureOutlined aria-hidden="true" />}
                      </span>
                      <span className="storyboard-asset-card__title">{entity.title}</span>
                    </button>
                  );
                })}
              </div>
            ),
            key: category,
            label: t(`storyboard.library.${category}`),
          };
        })}
      />
    </Drawer>
  );
}
