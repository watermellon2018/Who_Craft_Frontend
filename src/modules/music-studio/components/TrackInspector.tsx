import React, {useEffect, useRef, useState} from 'react';
import {Alert, Button, Descriptions, Empty, Popconfirm, Spin, Tag} from 'antd';
import {CheckOutlined, DownloadOutlined, EditOutlined, FolderOutlined, PlusOutlined} from '@ant-design/icons';
import {useTranslation} from 'react-i18next';

import {backendAssetUrl} from '../../../api/http';
import {musicApi} from '../api/musicApi';
import {musicErrorDescriptor} from '../errors';
import type {MusicTrackDetail, MusicTrackVersion} from '../types';
import SceneAssignmentPanel from './SceneAssignmentPanel';

function versionProvenanceLabel(
  version: MusicTrackVersion,
  aiCreatedLabel: string,
): string {
  const providerAndModel = [version.provenance?.provider, version.provenance?.model]
    .filter((value): value is string => Boolean(value))
    .join(' · ');
  if (providerAndModel) return providerAndModel;
  return version.provenance?.createdByAi ? aiCreatedLabel : '—';
}

interface TrackInspectorProps {
  canEdit: boolean;
  onAudioPlay: (audio: HTMLAudioElement) => void;
  onChanged: () => void;
  onCreateVersion: () => void;
  onEdit: () => void;
  onSignedUrlExpired: (refreshKey: string) => void;
  projectId: string;
  track: MusicTrackDetail;
}

export default function TrackInspector({
  canEdit,
  onAudioPlay,
  onChanged,
  onCreateVersion,
  onEdit,
  onSignedUrlExpired,
  projectId,
  track,
}: TrackInspectorProps) {
  const {t} = useTranslation();
  const audioRef = useRef<HTMLAudioElement>(null);
  const signedUrlRefreshKeyRef = useRef<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => audioRef.current?.pause(), []);
  useEffect(() => {
    signedUrlRefreshKeyRef.current = null;
  }, [track.activeVersion?.versionId]);

  const setActive = async (version: MusicTrackVersion) => {
    const {versionId} = version;
    if (!versionId) return;
    setActionId(versionId);
    setError(null);
    try {
      await musicApi.setActiveVersion(projectId, track.id, track.version, versionId);
      onChanged();
    } catch (requestError: unknown) {
      setError(musicErrorDescriptor(requestError).message);
    } finally {
      setActionId(null);
    }
  };

  const archive = async () => {
    setActionId('archive');
    setError(null);
    try {
      await musicApi.archiveTrack(projectId, track.id, track.version);
      onChanged();
    } catch (requestError: unknown) {
      setError(musicErrorDescriptor(requestError).message);
    } finally {
      setActionId(null);
    }
  };

  if (!track.activeVersion && track.versions.length === 0) {
    return <Empty description={t('musicStudio.track.noVersions')} />;
  }

  return (
    <div className="music-track-detail">
      <section className="music-card music-track-summary">
        <div className="music-section-heading">
          <div>
            <span className="music-eyebrow">{t('musicStudio.track.detail')}</span>
            <h1>{track.title}</h1>
            <p>{track.author}</p>
          </div>
          {track.status === 'archived' && <Tag>{t('musicStudio.library.archived')}</Tag>}
        </div>
        {track.activeVersion?.audioUrl && (
          <audio
            ref={audioRef}
            controls
            preload="metadata"
            aria-label={t('musicStudio.player.track', {title: track.title})}
            src={backendAssetUrl(track.activeVersion.audioUrl)}
            onPlay={(event) => onAudioPlay(event.currentTarget)}
            onError={() => {
              const refreshKey = track.activeVersion?.versionId
                ?? ['legacy', track.id].join('-');
              if (signedUrlRefreshKeyRef.current === refreshKey) return;
              signedUrlRefreshKeyRef.current = refreshKey;
              onSignedUrlExpired(refreshKey);
            }}
          />
        )}
        <Descriptions column={{xs: 1, sm: 2}} size="small">
          <Descriptions.Item label={t('musicStudio.track.activeVersion')}>
            {track.activeVersion?.versionNumber == null
              ? t('musicStudio.track.noVersions')
              : t('musicStudio.track.version', {number: track.activeVersion.versionNumber})}
          </Descriptions.Item>
          <Descriptions.Item label={t('musicStudio.track.usedInScenes')}>
            {track.usageCount}
          </Descriptions.Item>
          <Descriptions.Item label={t('musicStudio.track.updated')}>
            {new Date(track.updatedAt).toLocaleString()}
          </Descriptions.Item>
          <Descriptions.Item label={t('musicStudio.track.provenance')}>
            {track.activeVersion
              ? versionProvenanceLabel(track.activeVersion, t('musicStudio.track.aiCreated'))
              : '—'}
          </Descriptions.Item>
        </Descriptions>
        <p className="music-terms-note">{t('musicStudio.track.terms')}</p>
        {error && <Alert type="error" showIcon message={error} />}
        <div className="music-inline-actions">
          {canEdit && track.status === 'active' && track.activeVersion?.audioUrl && (
            <Button icon={<EditOutlined />} onClick={onEdit}>
              {t('musicStudio.audioEditor.open')}
            </Button>
          )}
          {canEdit && track.status === 'active' && (
            <Button icon={<PlusOutlined />} onClick={onCreateVersion}>
              {t('musicStudio.job.newBrief')}
            </Button>
          )}
          {track.activeVersion?.audioUrl && (
            <Button
              icon={<DownloadOutlined />}
              href={backendAssetUrl(track.activeVersion.audioUrl)}
              target="_blank"
              rel="noreferrer"
            >
              {t('musicStudio.track.download')}
            </Button>
          )}
          {canEdit && track.status === 'active' && (
            <Popconfirm
              title={t('musicStudio.track.archiveConfirm')}
              okText={t('musicStudio.track.archive')}
              cancelText={t('common.cancel')}
              onConfirm={() => void archive()}
            >
              <Button danger icon={<FolderOutlined />} loading={actionId === 'archive'}>
                {t('musicStudio.track.archive')}
              </Button>
            </Popconfirm>
          )}
        </div>
      </section>

      <section className="music-card" aria-labelledby="music-versions-title">
        <div className="music-section-heading">
          <div>
            <h2 id="music-versions-title">{t('musicStudio.track.versions')}</h2>
            <p>{t('musicStudio.track.versionsHelper')}</p>
          </div>
        </div>
        <div className="music-version-list">
          {track.versions.map((version) => {
            const active = version.versionId != null
              && version.versionId === track.activeVersion?.versionId;
            const versionLabel = version.versionNumber == null
              ? t('musicStudio.track.noVersions')
              : t('musicStudio.track.version', {number: version.versionNumber});
            return (
              <article
                className={active ? 'music-version-row music-version-row--active' : 'music-version-row'}
                key={version.versionId ?? ['legacy', version.createdAt ?? version.audioUrl ?? 'unversioned'].join('-')}
              >
                <div>
                  <strong>{versionLabel}</strong>
                  <small>{version.createdAt ? new Date(version.createdAt).toLocaleString() : ''}</small>
                  <span>{versionProvenanceLabel(version, t('musicStudio.track.aiCreated'))}</span>
                  {version.lyrics && version.lyrics.length > 0 && (
                    <div
                      className="music-version-lyrics"
                      aria-label={t('musicStudio.lyrics.title')}
                    >
                      {version.lyrics.map((section, index) => (
                        <section key={[section.type, section.label, index].join('-')}>
                          <strong>{section.label}</strong>
                          <pre>{section.text}</pre>
                        </section>
                      ))}
                    </div>
                  )}
                </div>
                {active ? (
                  <Tag color="green" icon={<CheckOutlined />}>{t('musicStudio.track.active')}</Tag>
                ) : canEdit && version.versionId ? (
                  <Button loading={actionId === version.versionId} onClick={() => void setActive(version)}>
                    {t('musicStudio.track.makeActive')}
                  </Button>
                ) : null}
              </article>
            );
          })}
        </div>
        {actionId && actionId !== 'archive' && <Spin size="small" />}
      </section>

      {canEdit ? (
        <SceneAssignmentPanel projectId={projectId} track={track} onSaved={onChanged} />
      ) : (
        <section className="music-card">
          <h2>{t('musicStudio.assignment.title')}</h2>
          <p>{t('musicStudio.assignment.readOnly', {count: track.assignments.length})}</p>
        </section>
      )}
    </div>
  );
}
