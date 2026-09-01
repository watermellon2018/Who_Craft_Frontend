import {
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  HolderOutlined,
  MoreOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import {Button, Collapse, Dropdown, InputNumber, Tooltip} from 'antd';
import type {MenuProps} from 'antd';
import React, {useState} from 'react';
import {useTranslation} from 'react-i18next';

import type {StoryboardSceneEntity, StoryboardShot} from '../model';

interface ShotSidebarProps {
  selectedShotId: string | null;
  entities: StoryboardSceneEntity[];
  shots: StoryboardShot[];
  onAdd: () => void;
  onDelete: (shotId: string) => void;
  onDuplicate: (shotId: string) => void;
  onEditContext: () => void;
  onMove: (shotId: string, targetIndex: number) => void;
  onSelect: (shotId: string) => void;
  onUpdateDuration: (shotId: string, duration: number | null) => void;
}

export default function ShotSidebar({
  selectedShotId,
  entities,
  shots,
  onAdd,
  onDelete,
  onDuplicate,
  onEditContext,
  onMove,
  onSelect,
  onUpdateDuration,
}: ShotSidebarProps) {
  const {t} = useTranslation();
  const [draggedShotId, setDraggedShotId] = useState<string | null>(null);
  const selectedShot = shots.find((shot) => shot.id === selectedShotId) ?? null;
  const entityTitle = (id: string) => entities.find((entity) => entity.id === id)?.title ?? id;
  const entityTitles = (ids: string[]) => ids.map(entityTitle).join(', ');

  const menuItems = (shot: StoryboardShot): MenuProps['items'] => [
    {
      icon: <CopyOutlined aria-hidden="true" />,
      key: 'duplicate',
      label: t('storyboard.shotActions.duplicate'),
      onClick: () => onDuplicate(shot.id),
    },
    {
      danger: true,
      icon: <DeleteOutlined aria-hidden="true" />,
      key: 'delete',
      label: t('storyboard.shotActions.delete'),
      onClick: () => onDelete(shot.id),
    },
  ];

  return (
    <aside className="storyboard-shots" aria-label={t('storyboard.shots')}>
      <div className="storyboard-section-heading">
        <div>
          <h2>{t('storyboard.shots')}</h2>
          <p>{t('storyboard.shotsHelp')}</p>
        </div>
        <Tooltip title={t('storyboard.addShot')}>
          <Button aria-label={t('storyboard.addShot')} icon={<PlusOutlined aria-hidden="true" />} onClick={onAdd} />
        </Tooltip>
      </div>

      <div className="storyboard-shot-list">
        {shots.map((shot, index) => {
          const active = shot.id === selectedShotId;
          const framing = shot.keyframes.find(({type}) => type === 'start')?.cameraIntent.framing;
          return (
            <div
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
              <div className={`storyboard-shot-button${active ? ' storyboard-shot-button--active' : ''}`}>
                <button
                  aria-current={active ? 'true' : undefined}
                  className="storyboard-shot-button__select"
                  onClick={() => onSelect(shot.id)}
                  type="button"
                >
                  <span className="storyboard-shot-button__number">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="storyboard-shot-button__body">
                    <span className="storyboard-shot-button__title">{shot.title}</span>
                    <span className="storyboard-shot-button__meta">
                      <span>
                        {framing
                          ? t(`storyboard.camera.framingValue.${framing}`)
                          : t('storyboard.camera.unset')}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{t('storyboard.keyframesCount', {count: shot.keyframes.length})}</span>
                    </span>
                  </span>
                </button>
                <Dropdown menu={{items: menuItems(shot)}} trigger={['click']}>
                  <Button
                    aria-label={t('storyboard.shotActions.menu', {number: index + 1})}
                    className="storyboard-shot-button__menu"
                    icon={<MoreOutlined aria-hidden="true" />}
                    type="text"
                  />
                </Dropdown>
              </div>
            </div>
          );
        })}
      </div>

      {selectedShot && (
        <div className="storyboard-shot-context">
          <Collapse
            bordered={false}
            defaultActiveKey={['context']}
            ghost
            items={[{
              key: 'context',
              label: t('storyboard.shotContent'),
              children: (
                <>
                  <dl>
                    <dt>{t('storyboard.characters')}</dt>
                    <dd>{entityTitles(selectedShot.characterIds) || '—'}</dd>
                    <dt>{t('storyboard.location')}</dt>
                    <dd>{selectedShot.locationId ? entityTitle(selectedShot.locationId) : '—'}</dd>
                    <dt>{t('storyboard.objects')}</dt>
                    <dd>{entityTitles(selectedShot.referenceIds) || '—'}</dd>
                  </dl>
                  <Button icon={<EditOutlined aria-hidden="true" />} onClick={onEditContext} size="small" type="link">
                    {t('common.edit')}
                  </Button>
                </>
              ),
            }]}
          />
          <label className="storyboard-control-group__title" htmlFor="storyboard-shot-duration">
            {t('storyboard.duration')}
          </label>
          <InputNumber
            addonAfter={t('storyboard.secondsShort')}
            id="storyboard-shot-duration"
            max={120}
            min={0.5}
            onChange={(value) => onUpdateDuration(selectedShot.id, value)}
            precision={1}
            step={0.5}
            value={selectedShot.duration}
          />
        </div>
      )}

      <div style={{marginTop: 12}}>
        <Button block icon={<HolderOutlined aria-hidden="true" />} onClick={onAdd}>
          {t('storyboard.addShot')}
        </Button>
      </div>
    </aside>
  );
}
