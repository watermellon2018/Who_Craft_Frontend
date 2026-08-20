import React from 'react';
import {Alert, Button} from 'antd';
import {useTranslation} from 'react-i18next';

import type {AudioUploadDraft} from './AudioUploadForm';
import type {
  MusicBrief,
  MusicReferenceAsset,
  MusicSceneOption,
} from '../types';
import {GenerationCostPreview} from '../../credits/components/GenerationCostGuard';

export type MusicCreationMode = 'ai' | 'upload';

interface MusicCreationSummaryProps {
  brief: MusicBrief;
  canEdit: boolean;
  canGenerate: boolean;
  generateDisabled: boolean;
  mode: MusicCreationMode;
  modelKey?: string;
  modelLabel?: string;
  onClearScene: () => void;
  onGenerate: () => void;
  onOpenScenePicker: () => void;
  reference: MusicReferenceAsset | null;
  scene: MusicSceneOption | null;
  submitting: boolean;
  uploadDraft: AudioUploadDraft;
  variantCount: number;
}

function fileFormat(file: File | null): string {
  if (!file) return '—';
  const extension = file.name.split('.').pop();
  return extension ? extension.toUpperCase() : file.type || '—';
}

function durationLabel(seconds: number | null, unit: string): string {
  return seconds == null ? '—' : `${Math.round(seconds)} ${unit}`;
}

export default function MusicCreationSummary({
  brief,
  canEdit,
  canGenerate,
  generateDisabled,
  mode,
  modelKey,
  modelLabel,
  onClearScene,
  onGenerate,
  onOpenScenePicker,
  reference,
  scene,
  submitting,
  uploadDraft,
  variantCount,
}: MusicCreationSummaryProps) {
  const {t} = useTranslation();
  const seconds = t('musicStudio.units.seconds');
  const canChangeScene = mode === 'ai' ? canGenerate : canEdit;

  return (
    <div className="music-summary">
      <div className="music-summary__heading">
        <span className="music-eyebrow">{t('musicStudio.summary.eyebrow')}</span>
        <h2>{t('musicStudio.summary.title')}</h2>
        <p>{t('musicStudio.summary.helper')}</p>
      </div>

      <dl className="music-summary__list">
        {mode === 'ai' ? (
          <>
            <div>
              <dt>{t('musicStudio.model.label')}</dt>
              <dd>{modelLabel ?? '—'}</dd>
            </div>
            <div>
              <dt>{t('musicStudio.summary.trackType')}</dt>
              <dd>{t(`musicStudio.brief.mode.${brief.content.mode}`)}</dd>
            </div>
            <div>
              <dt>{t('musicStudio.brief.genre')}</dt>
              <dd>{brief.genre
                ? t(`musicStudio.options.genre.${brief.genre}`, {defaultValue: brief.genre})
                : '—'}</dd>
            </div>
            <div>
              <dt>{t('musicStudio.brief.moods')}</dt>
              <dd>{brief.moods.length
                ? brief.moods.map((mood) => t(
                    `musicStudio.options.mood.${mood}`,
                    {defaultValue: mood},
                  )).join(', ')
                : '—'}</dd>
            </div>
            <div>
              <dt>{t('musicStudio.brief.duration')}</dt>
              <dd>{durationLabel(brief.durationSeconds, seconds)}</dd>
            </div>
            <div>
              <dt>{t('musicStudio.brief.variantCount')}</dt>
              <dd>{variantCount}</dd>
            </div>
            <div>
              <dt>{t('musicStudio.reference.title')}</dt>
              <dd>{reference?.name ?? t('musicStudio.summary.noReference')}</dd>
            </div>
          </>
        ) : (
          <>
            <div>
              <dt>{t('musicStudio.upload.file')}</dt>
              <dd>{uploadDraft.file?.name ?? '—'}</dd>
            </div>
            <div>
              <dt>{t('musicStudio.upload.format')}</dt>
              <dd>{fileFormat(uploadDraft.file)}</dd>
            </div>
            <div>
              <dt>{t('musicStudio.upload.duration')}</dt>
              <dd>{durationLabel(uploadDraft.durationSeconds, seconds)}</dd>
            </div>
            <div>
              <dt>{t('musicStudio.upload.statusLabel')}</dt>
              <dd>{t(`musicStudio.upload.status.${uploadDraft.status}`)}</dd>
            </div>
          </>
        )}
      </dl>

      <section className="music-summary__scene" aria-labelledby="music-summary-scene-title">
        <div>
          <span className="music-eyebrow">{t('musicStudio.scene.context')}</span>
          <h3 id="music-summary-scene-title">
            {scene
              ? t('musicStudio.scene.compactTitle', {
                  number: scene.number ?? '—',
                  title: scene.title || scene.location,
                })
              : t('musicStudio.scene.projectWide')}
          </h3>
          <p>{scene?.summary || t('musicStudio.scene.optional')}</p>
        </div>
        <div className="music-inline-actions">
          <Button disabled={!canChangeScene} onClick={onOpenScenePicker}>
            {scene ? t('musicStudio.scene.change') : t('musicStudio.scene.choose')}
          </Button>
          {scene && (
            <Button disabled={!canChangeScene} onClick={onClearScene}>
              {t('musicStudio.scene.projectWide')}
            </Button>
          )}
        </div>
      </section>

      {!canChangeScene && <Alert showIcon type="info" message={t('musicStudio.readOnly')} />}

      <div className="music-summary__action">
        {mode === 'ai' ? (
          <>
            <Button
              block
              type="primary"
              size="large"
              disabled={!canGenerate || generateDisabled}
              loading={submitting}
              onClick={onGenerate}
            >
              {t('musicStudio.create.generate', {count: variantCount})}
            </Button>
            {canGenerate && (
              <GenerationCostPreview intent={{
                domain: 'music',
                durationSeconds: brief.durationSeconds,
                modelKey,
                operation: 'generate',
                variantCount,
                promptLength: JSON.stringify(brief).length,
              }} />
            )}
          </>
        ) : (
          <Button block type="primary" size="large" disabled>
            {t('musicStudio.upload.addToLibrary')}
          </Button>
        )}
      </div>
    </div>
  );
}
