import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  CopyOutlined,
  DeleteOutlined,
  DownOutlined,
  HolderOutlined,
  MoreOutlined,
  PlusOutlined,
  UndoOutlined,
  UpOutlined,
} from '@ant-design/icons';
import {Button, Dropdown, Input, Tooltip} from 'antd';
import type {MenuProps} from 'antd';
import React, {useEffect, useId, useState} from 'react';
import {useTranslation} from 'react-i18next';

import type {StoryboardScene, StoryboardShot} from '../model';
import ShotSourceDetails from './ShotSourceDetails';

interface ShotListBuilderProps {
  scene: StoryboardScene;
  onAdd: (afterShotId?: string) => void;
  onConfirm: () => void;
  onDelete: (shotId: string) => void;
  onDuplicate: (shotId: string) => void;
  onMove: (shotId: string, targetIndex: number) => void;
  onReset: () => void;
  resetDisabled?: boolean;
  onUpdate: (shotId: string, patch: Pick<StoryboardShot, 'description' | 'title'>) => void;
}

export default function ShotListBuilder({
  scene,
  onAdd,
  onConfirm,
  onDelete,
  onDuplicate,
  onMove,
  onReset,
  onUpdate,
  resetDisabled = false,
}: ShotListBuilderProps) {
  const {t} = useTranslation();
  const idPrefix = useId();
  const [draggedShotId, setDraggedShotId] = useState<string | null>(null);
  const [expandedShotId, setExpandedShotId] = useState<string | null>(null);

  useEffect(() => {
    setDraggedShotId(null);
    setExpandedShotId(null);
  }, [scene.id]);

  const menuItems = (shot: StoryboardShot, index: number): MenuProps['items'] => [
    {
      icon: <PlusOutlined aria-hidden="true" />,
      key: 'add-after',
      label: t('storyboard.shotActions.addAfter'),
      onClick: () => onAdd(shot.id),
    },
    {
      icon: <CopyOutlined aria-hidden="true" />,
      key: 'duplicate',
      label: t('storyboard.shotActions.duplicate'),
      onClick: () => onDuplicate(shot.id),
    },
    {
      disabled: index === 0,
      icon: <ArrowUpOutlined aria-hidden="true" />,
      key: 'up',
      label: t('storyboard.shotActions.moveUp'),
      onClick: () => onMove(shot.id, index - 1),
    },
    {
      disabled: index === scene.shots.length - 1,
      icon: <ArrowDownOutlined aria-hidden="true" />,
      key: 'down',
      label: t('storyboard.shotActions.moveDown'),
      onClick: () => onMove(shot.id, index + 1),
    },
    {type: 'divider'},
    {
      danger: true,
      icon: <DeleteOutlined aria-hidden="true" />,
      key: 'delete',
      label: t('storyboard.shotActions.delete'),
      onClick: () => onDelete(shot.id),
    },
  ];

  return (
    <section className="storyboard-builder" aria-labelledby="storyboard-builder-title">
      <div className="storyboard-builder__header">
        <div className="storyboard-builder__intro">
          <div className="storyboard-builder__heading">
            <h2 id="storyboard-builder-title">
              {t('storyboard.builder.title', {count: scene.shots.length})}
            </h2>
            {scene.shots.length > 0 && scene.shots.every((shot) => shot.source?.origin === 'ai') && (
              <span className="storyboard-builder__badge">{t('storyboard.ai.proposal')}</span>
            )}
          </div>
          <p className="storyboard-builder__help">{t('storyboard.ai.editHelp')}</p>
        </div>
        <Button
          className="craft-action-button--secondary"
          disabled={resetDisabled || scene.canEdit === false}
          icon={<UndoOutlined aria-hidden="true" />}
          onClick={onReset}
        >
          {t('storyboard.builder.reset')}
        </Button>
      </div>

      <div className="storyboard-builder__list">
        {scene.shots.map((shot, index) => {
          const expanded = expandedShotId === shot.id;
          const rowId = `${idPrefix}-${shot.id}`;
          return (
            <div
              className={`storyboard-builder-shot${expanded ? ' storyboard-builder-shot--expanded' : ''}`}
              key={shot.id}
              onDragOver={(event) => {
                if (draggedShotId) event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (draggedShotId && draggedShotId !== shot.id) onMove(draggedShotId, index);
                setDraggedShotId(null);
              }}
            >
              <div className="storyboard-builder-shot__row">
                <span className="storyboard-builder-shot__number" id={`${rowId}-number`}>
                  {String(index + 1).padStart(2, '0')}
                </span>
                <button
                  aria-controls={`${rowId}-details`}
                  aria-expanded={expanded}
                  aria-labelledby={`${rowId}-number ${rowId}-title ${rowId}-toggle`}
                  className="storyboard-builder-shot__summary"
                  onClick={() => setExpandedShotId(expanded ? null : shot.id)}
                  type="button"
                >
                  <span className="storyboard-builder-shot__body">
                    <span className="storyboard-builder-shot__title" id={`${rowId}-title`}>
                      {shot.title || t('storyboard.newShot.title')}
                    </span>
                    {!expanded && (
                      <Tooltip
                        mouseEnterDelay={0.6}
                        overlayClassName="storyboard-builder-preview"
                        title={shot.description || undefined}
                      >
                        <span className="storyboard-builder-shot__preview">
                          {shot.description || t('storyboard.builder.emptyDescription')}
                        </span>
                      </Tooltip>
                    )}
                  </span>
                  <span className="storyboard-builder-shot__toggle" id={`${rowId}-toggle`}>
                    {expanded ? <UpOutlined aria-hidden="true" /> : <DownOutlined aria-hidden="true" />}
                    {t(expanded ? 'storyboard.builder.collapse' : 'storyboard.builder.expand')}
                  </span>
                </button>
                <div className="storyboard-builder-shot__actions">
                  <Tooltip title={t('storyboard.shotActions.drag')}>
                    <Button
                      aria-label={t('storyboard.shotActions.drag')}
                      className="storyboard-builder-shot__drag"
                      draggable
                      icon={<HolderOutlined aria-hidden="true" />}
                      onDragEnd={() => setDraggedShotId(null)}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData('text/plain', shot.id);
                        setDraggedShotId(shot.id);
                      }}
                      type="text"
                    />
                  </Tooltip>
                  <Dropdown menu={{items: menuItems(shot, index)}} trigger={['click']}>
                    <Button
                      aria-label={t('storyboard.shotActions.menu', {number: index + 1})}
                      icon={<MoreOutlined aria-hidden="true" />}
                      type="text"
                    />
                  </Dropdown>
                </div>
              </div>
              <div
                className="storyboard-builder-shot__details"
                hidden={!expanded}
                id={`${rowId}-details`}
              >
                {expanded && (
                  <>
                    <label htmlFor={`${rowId}-title-input`}>
                      {t('storyboard.fields.shotTitle', {number: index + 1})}
                    </label>
                    <Input
                      id={`${rowId}-title-input`}
                      maxLength={255}
                      onChange={(event) => onUpdate(shot.id, {
                        description: shot.description,
                        title: event.target.value,
                      })}
                      value={shot.title}
                    />
                    <label htmlFor={`${rowId}-description-input`}>
                      {t('storyboard.fields.shotDescription', {number: index + 1})}
                    </label>
                    <Input.TextArea
                      autoSize={{minRows: 3, maxRows: 12}}
                      id={`${rowId}-description-input`}
                      maxLength={4000}
                      onChange={(event) => onUpdate(shot.id, {
                        description: event.target.value,
                        title: shot.title,
                      })}
                      value={shot.description}
                    />
                    <ShotSourceDetails scene={scene} shot={shot} />
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="storyboard-builder__footer">
        <Button
          className="craft-action-button craft-action-button--secondary"
          icon={<PlusOutlined aria-hidden="true" />}
          onClick={() => onAdd()}
        >
          {t('storyboard.addShot')}
        </Button>
        <Button
          className="craft-action-button"
          disabled={scene.shots.length === 0}
          onClick={onConfirm}
          size="large"
          type="primary"
        >
          {t('storyboard.stageShots')}
        </Button>
      </div>
    </section>
  );
}
