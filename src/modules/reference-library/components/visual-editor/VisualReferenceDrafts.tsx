import {MoreOutlined, PictureOutlined} from '@ant-design/icons';
import type {MenuProps} from 'antd';
import {Button, Dropdown, Modal, Tooltip} from 'antd';
import React from 'react';
import {useTranslation} from 'react-i18next';

import type {VisualReferenceDraft} from './types';

const TOOLTIP_ROOT_CLASS_NAME = 'visual-reference-tooltip';

interface VisualReferenceDraftsProps {
  activeImageId: string | null;
  disabled: boolean;
  drafts: VisualReferenceDraft[];
  primaryImageId: string | null;
  onDeleteDraft: (draftId: string) => void;
  onPrimaryChange: (draftId: string) => void;
  onSelectDraft: (draftId: string) => void;
}

export default function VisualReferenceDrafts({
  activeImageId,
  disabled,
  drafts,
  primaryImageId,
  onDeleteDraft,
  onPrimaryChange,
  onSelectDraft,
}: VisualReferenceDraftsProps) {
  const {t} = useTranslation();

  const confirmDelete = (draft: VisualReferenceDraft) => {
    Modal.confirm({
      cancelText: t('common.cancel'),
      content: t('referenceLibrary.editor.drafts.removeConfirmDescription', {
        name: draft.name,
      }),
      okButtonProps: {danger: true},
      okText: t('common.delete'),
      title: t('referenceLibrary.editor.drafts.removeConfirmTitle'),
      onOk: () => onDeleteDraft(draft.id),
    });
  };

  return (
    <section className="visual-reference-inspector__drafts">
      <div className="visual-reference-drafts__header">
        <Tooltip
          rootClassName={TOOLTIP_ROOT_CLASS_NAME}
          title={t('referenceLibrary.editor.drafts.helper')}
        >
          <span>{t('referenceLibrary.editor.drafts.title')}</span>
        </Tooltip>
        <span className="visual-reference-drafts__count">{drafts.length}</span>
      </div>

      {drafts.length > 0 ? (
        <div
          className="visual-reference-drafts__list"
          aria-label={t('referenceLibrary.editor.drafts.title')}
        >
          {drafts.map((draft, index) => {
            const primary = draft.id === primaryImageId;
            const selected = draft.id === activeImageId;
            const menuItems: MenuProps['items'] = [
              {
                disabled: disabled || primary,
                key: 'primary',
                label: t(primary
                  ? 'referenceLibrary.editor.variants.primary'
                  : 'referenceLibrary.editor.canvas.setPrimary'),
              },
              {
                danger: true,
                disabled,
                key: 'delete',
                label: t('referenceLibrary.editor.drafts.remove'),
              },
            ];
            const handleMenuClick: MenuProps['onClick'] = ({domEvent, key}) => {
              domEvent.stopPropagation();
              if (key === 'primary') onPrimaryChange(draft.id);
              if (key === 'delete') confirmDelete(draft);
            };

            return (
              <article key={draft.id} className="visual-reference-draft-card">
                <Tooltip
                  rootClassName={TOOLTIP_ROOT_CLASS_NAME}
                  title={draft.source === 'generated' ? draft.prompt : draft.name}
                >
                  <button
                    type="button"
                    className={`visual-reference-draft-card__preview${selected ? ' is-selected' : ''}`}
                    aria-label={t('referenceLibrary.editor.drafts.item', {
                      name: draft.name,
                      number: index + 1,
                    })}
                    aria-pressed={selected}
                    disabled={disabled}
                    onClick={() => onSelectDraft(draft.id)}
                  >
                    <img src={draft.imageUrl} alt="" />
                    {primary && (
                      <span>{t('referenceLibrary.versions.active')}</span>
                    )}
                  </button>
                </Tooltip>
                <Dropdown
                  disabled={disabled}
                  menu={{items: menuItems, onClick: handleMenuClick}}
                  placement="bottomRight"
                  rootClassName="visual-reference-draft-menu"
                  trigger={['click']}
                >
                  <Button
                    className="visual-reference-draft-card__menu"
                    type="text"
                    icon={<MoreOutlined />}
                    aria-label={t('referenceLibrary.editor.drafts.actions', {
                      name: draft.name,
                    })}
                    disabled={disabled}
                    onClick={(event) => event.stopPropagation()}
                  />
                </Dropdown>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="visual-reference-drafts__empty">
          <PictureOutlined />
          <strong>{t('referenceLibrary.editor.drafts.emptyTitle')}</strong>
          <p>{t('referenceLibrary.editor.drafts.emptyDescription')}</p>
        </div>
      )}
    </section>
  );
}
