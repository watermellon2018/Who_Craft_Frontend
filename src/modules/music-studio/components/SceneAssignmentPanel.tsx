import React, {useEffect, useMemo, useState} from 'react';
import {Alert, Button, InputNumber, Select} from 'antd';
import {useTranslation} from 'react-i18next';

import {musicApi} from '../api/musicApi';
import {musicErrorDescriptor} from '../errors';
import type {MusicSceneOption, MusicTrackDetail} from '../types';
import ScenePickerDialog from './ScenePickerDialog';

interface SceneAssignmentPanelProps {
  onSaved: () => void;
  projectId: string;
  track: MusicTrackDetail;
}

interface SelectedAssignment {
  scene: MusicSceneOption;
  startTimeSeconds: number;
  trackVersionId: string;
}

export default function SceneAssignmentPanel({
  onSaved,
  projectId,
  track,
}: SceneAssignmentPanelProps) {
  const {t} = useTranslation();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState<SelectedAssignment[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const defaultVersionId = track.activeVersion?.versionId
    ?? track.versions.find((version) => version.versionId)?.versionId
    ?? '';
  const versionOptions = useMemo(() => track.versions.flatMap((version) => (
    version.versionId
      ? [{
          label: version.versionNumber == null
            ? t('musicStudio.track.noVersions')
            : t('musicStudio.track.version', {number: version.versionNumber}),
          value: version.versionId,
        }]
      : []
  )), [t, track.versions]);

  useEffect(() => {
    setSelected(track.assignments
      .filter((assignment) => Boolean(assignment.scene))
      .map((assignment) => ({
        scene: assignment.scene,
        startTimeSeconds: assignment.startTimeSeconds,
        trackVersionId: assignment.trackVersionId ?? defaultVersionId,
      })));
    setError(null);
    setSaved(false);
  }, [defaultVersionId, track]);

  const selectedScenes = useMemo(() => selected.map((item) => item.scene), [selected]);

  const replaceScenes = (scenes: MusicSceneOption[]) => {
    setSelected(scenes.map((scene) => {
      const current = selected.find((item) => item.scene.sceneId === scene.sceneId);
      return {
        scene,
        startTimeSeconds: current?.startTimeSeconds ?? 0,
        trackVersionId: current?.trackVersionId ?? defaultVersionId,
      };
    }));
    setPickerOpen(false);
    setSaved(false);
  };

  const save = async () => {
    if (selected.some((item) => !item.trackVersionId)) return;
    setSaving(true);
    setError(null);
    try {
      await musicApi.replaceAssignments(
        projectId,
        track.id,
        track.version,
        selected.map((item) => ({
          sceneId: item.scene.sceneId,
          startTimeSeconds: item.startTimeSeconds,
          trackVersionId: item.trackVersionId,
        })),
      );
      setSaved(true);
      onSaved();
    } catch (requestError: unknown) {
      setError(musicErrorDescriptor(requestError).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="music-card" aria-labelledby="music-assignment-title">
      <div className="music-section-heading">
        <div>
          <h2 id="music-assignment-title">{t('musicStudio.assignment.title')}</h2>
          <p>{t('musicStudio.assignment.helper')}</p>
        </div>
        <Button onClick={() => setPickerOpen(true)}>{t('musicStudio.assignment.chooseScenes')}</Button>
      </div>


      {selected.length === 0 ? (
        <p className="music-field-hint">{t('musicStudio.assignment.none')}</p>
      ) : (
        <div className="music-assignment-list">
          {selected.map((item) => (
            <div className="music-assignment-row" key={item.scene.sceneId}>
              <span>
                <strong>{t('musicStudio.scene.rowTitle', {
                  act: item.scene.act ?? '—',
                  number: item.scene.number ?? '—',
                  title: item.scene.title || item.scene.location,
                })}</strong>
                <small>{item.scene.summary}</small>
              </span>
              <label>
                {t('musicStudio.assignment.pinnedVersion')}
                <Select
                  aria-label={[
                    t('musicStudio.assignment.pinnedVersion'),
                    item.scene.title || item.scene.location,
                  ].join(' ')}
                  value={item.trackVersionId || undefined}
                  options={versionOptions}
                  onChange={(trackVersionId) => {
                    setSelected((current) => current.map((entry) => (
                      entry.scene.sceneId === item.scene.sceneId
                        ? {...entry, trackVersionId}
                        : entry
                    )));
                    setSaved(false);
                  }}
                />
              </label>
              <label>
                {t('musicStudio.assignment.start')}
                <InputNumber
                  min={0}
                  addonAfter={t('musicStudio.units.seconds')}
                  value={item.startTimeSeconds}
                  onChange={(startTimeSeconds) => {
                    setSelected((current) => current.map((entry) => (
                      entry.scene.sceneId === item.scene.sceneId
                        ? {...entry, startTimeSeconds: startTimeSeconds ?? 0}
                        : entry
                    )));
                    setSaved(false);
                  }}
                />
              </label>
            </div>
          ))}
        </div>
      )}

      {error && <Alert type="error" showIcon message={error} />}
      {saved && <Alert type="success" showIcon message={t('musicStudio.assignment.saved')} />}
      <Button
        type="primary"
        loading={saving}
        disabled={selected.some((item) => !item.trackVersionId)}
        onClick={() => void save()}
      >
        {t('musicStudio.assignment.save')}
      </Button>

      <ScenePickerDialog
        mode="multiple"
        open={pickerOpen}
        projectId={projectId}
        selected={selectedScenes}
        onClose={() => setPickerOpen(false)}
        onConfirm={replaceScenes}
      />
    </section>
  );
}
