import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  CopyOutlined,
  DeleteOutlined,
  HolderOutlined,
  MoreOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import {Button, Dropdown, Input, Tooltip} from 'antd';
import type {MenuProps} from 'antd';
import React, {useState} from 'react';
import {useTranslation} from 'react-i18next';

import type {StoryboardScene, StoryboardShot} from '../model';

interface ShotListBuilderProps {
  scene: StoryboardScene;
  onAdd: (afterShotId?: string) => void;
  onConfirm: () => void;
  onDelete: (shotId: string) => void;
  onDuplicate: (shotId: string) => void;
  onMove: (shotId: string, targetIndex: number) => void;
  onUpdate: (shotId: string, patch: Pick<StoryboardShot, 'description' | 'title'>) => void;
}

export default function ShotListBuilder({
  scene,
  onAdd,
  onConfirm,
  onDelete,
  onDuplicate,
  onMove,
  onUpdate,
}: ShotListBuilderProps) {
  const {t} = useTranslation();
  const [draggedShotId, setDraggedShotId] = useState<string | null>(null);

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
      <p className="storyboard-overview__eyebrow">{t('storyboard.ai.proposal')}</p>
      <h2 id="storyboard-builder-title">
        {t('storyboard.ai.proposedShots', {count: scene.shots.length})}
      </h2>
      <p className="storyboard-muted">{t('storyboard.ai.editHelp')}</p>

      <div className="storyboard-builder__list">
        {scene.shots.map((shot, index) => (
          <div
            className="storyboard-builder-shot"
            draggable
            key={shot.id}
            onDragEnd={() => setDraggedShotId(null)}
            onDragOver={(event) => event.preventDefault()}
            onDragStart={() => setDraggedShotId(shot.id)}
            onDrop={() => {
              if (draggedShotId && draggedShotId !== shot.id) onMove(draggedShotId, index);
              setDraggedShotId(null);
            }}
          >
            <span className="storyboard-builder-shot__number">
              {String(index + 1).padStart(2, '0')}
            </span>
            <Input
              aria-label={t('storyboard.fields.shotTitle', {number: index + 1})}
              maxLength={120}
              onChange={(event) => onUpdate(shot.id, {
                description: shot.description,
                title: event.target.value,
              })}
              value={shot.title}
            />
            <Input
              aria-label={t('storyboard.fields.shotDescription', {number: index + 1})}
              maxLength={600}
              onChange={(event) => onUpdate(shot.id, {
                description: event.target.value,
                title: shot.title,
              })}
              value={shot.description}
            />
            <div className="storyboard-inline-actions">
              <Tooltip title={t('storyboard.shotActions.drag')}>
                <Button aria-label={t('storyboard.shotActions.drag')} icon={<HolderOutlined aria-hidden="true" />} type="text" />
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
        ))}
      </div>

      <div className="storyboard-section-heading">
        <Button icon={<PlusOutlined aria-hidden="true" />} onClick={() => onAdd()}>
          {t('storyboard.addShot')}
        </Button>
        <Button disabled={scene.shots.length === 0} onClick={onConfirm} size="large" type="primary">
          {t('storyboard.stageShots')}
        </Button>
      </div>
    </section>
  );
}
