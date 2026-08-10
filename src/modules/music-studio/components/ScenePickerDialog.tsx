import React, {useEffect, useMemo, useState} from 'react';
import {Alert, Checkbox, Empty, Input, Modal, Radio, Select, Spin} from 'antd';
import {SearchOutlined} from '@ant-design/icons';
import {useTranslation} from 'react-i18next';

import {musicApi} from '../api/musicApi';
import {musicErrorDescriptor} from '../errors';
import type {MusicSceneOption} from '../types';

interface ScenePickerDialogProps {
  mode?: 'single' | 'multiple';
  onClose: () => void;
  onConfirm: (scenes: MusicSceneOption[]) => void;
  open: boolean;
  projectId: string;
  selected: MusicSceneOption[];
}

function sceneLabel(scene: MusicSceneOption, sceneWord: string, actWord: string) {
  const number = scene.number == null ? '—' : String(scene.number).padStart(2, '0');
  const act = scene.act == null ? '' : ` · ${actWord} ${scene.act}`;
  return `${sceneWord} ${number}${act} · ${scene.title || scene.location}`;
}

export default function ScenePickerDialog({
  mode = 'single',
  onClose,
  onConfirm,
  open,
  projectId,
  selected,
}: ScenePickerDialogProps) {
  const {t} = useTranslation();
  const [query, setQuery] = useState('');
  const [act, setAct] = useState<number | undefined>();
  const [items, setItems] = useState<MusicSceneOption[]>([]);
  const [selection, setSelection] = useState<Map<number, MusicSceneOption>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelection(new Map(selected.map((scene) => [scene.sceneId, scene])));
  }, [open, selected]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await musicApi.listSceneOptions(
          projectId,
          {act, limit: 30, q: query.trim() || undefined},
          controller.signal,
        );
        setItems(response.data.items);
      } catch (requestError: unknown) {
        if (!controller.signal.aborted) setError(musicErrorDescriptor(requestError).message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [act, open, projectId, query]);

  const acts = useMemo(() => Array.from(new Set(items
    .map((scene) => scene.act)
    .filter((value): value is number => value != null))).sort((left, right) => left - right), [items]);

  const choose = (scene: MusicSceneOption, checked: boolean) => {
    setSelection((current) => {
      const next = mode === 'single' ? new Map<number, MusicSceneOption>() : new Map(current);
      if (checked) next.set(scene.sceneId, scene);
      else next.delete(scene.sceneId);
      return next;
    });
  };

  return (
    <Modal
      className="music-scene-picker"
      rootClassName="music-scene-picker-root"
      open={open}
      title={mode === 'multiple'
        ? t('musicStudio.scene.assignTitle')
        : t('musicStudio.scene.pickerTitle')}
      okText={t('musicStudio.scene.confirm')}
      cancelText={t('common.cancel')}
      okButtonProps={{disabled: mode === 'single' && selection.size !== 1}}
      onCancel={onClose}
      onOk={() => onConfirm(Array.from(selection.values()))}
      width={760}
    >
      <div className="music-scene-picker__filters">
        <Input
          allowClear
          aria-label={t('musicStudio.scene.search')}
          prefix={<SearchOutlined />}
          placeholder={t('musicStudio.scene.searchPlaceholder')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Select
          allowClear
          aria-label={t('musicStudio.scene.actFilter')}
          placeholder={t('musicStudio.scene.allActs')}
          value={act}
          onChange={setAct}
          options={acts.map((item) => ({
            label: t('musicStudio.scene.act', {act: item}),
            value: item,
          }))}
        />
      </div>
      {error && <Alert type="error" showIcon message={error} />}
      {loading ? (
        <div className="music-centered"><Spin /></div>
      ) : items.length === 0 ? (
        <Empty description={t('musicStudio.scene.empty')} />
      ) : (
        <div className="music-scene-picker__list">
          {items.map((scene) => {
            const checked = selection.has(scene.sceneId);
            const control = mode === 'multiple'
              ? <Checkbox checked={checked} onChange={(event) => choose(scene, event.target.checked)} />
              : <Radio checked={checked} onChange={() => choose(scene, true)} />;
            return (
              <div
                role="button"
                tabIndex={0}
                className={checked ? 'music-scene-row music-scene-row--selected' : 'music-scene-row'}
                key={scene.sceneId}
                onClick={() => choose(scene, !checked)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  event.preventDefault();
                  choose(scene, !checked);
                }}
              >
                {control}
                <span className="music-scene-row__content">
                  <strong>{sceneLabel(scene, t('musicStudio.scene.scene'), t('musicStudio.scene.actShort'))}</strong>
                  <span>{scene.summary || scene.location || t('musicStudio.scene.noSummary')}</span>
                  <small>{[scene.location, ...scene.characters].filter(Boolean).join(' · ')}</small>
                </span>
                <span className="music-scene-row__meta">
                  <span>{scene.durationSeconds == null ? '—' : `${scene.durationSeconds} ${t('musicStudio.units.seconds')}`}</span>
                  {scene.mood && <span className="music-chip">{scene.mood}</span>}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
