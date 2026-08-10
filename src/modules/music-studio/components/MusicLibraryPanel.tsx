import React, {useRef} from 'react';
import {Button, Empty, Input, Segmented, Skeleton, Tag} from 'antd';
import {HistoryOutlined, PlusOutlined, SearchOutlined} from '@ant-design/icons';
import {useTranslation} from 'react-i18next';

import {backendAssetUrl} from '../../../api/http';
import AudioPlayer from './AudioPlayer';
import type {
  MusicGenerationJob,
  MusicLibraryItem,
  MusicPermissions,
} from '../types';

interface MusicLibraryPanelProps {
  activeAudio: (audio: HTMLAudioElement) => void;
  error: string | null;
  history: MusicGenerationJob[];
  items: MusicLibraryItem[];
  loading: boolean;
  mode: 'library' | 'history';
  onCreate: () => void;
  onFilterChange: (filter: 'active' | 'archived') => void;
  onModeChange: (mode: 'library' | 'history') => void;
  onOpenJob: (jobId: string) => void;
  onOpenTrack: (trackId: number) => void;
  onQueryChange: (query: string) => void;
  onSignedUrlExpired: () => void;
  permissions: MusicPermissions;
  query: string;
  selectedJobId?: string;
  selectedTrackId?: number;
  statusFilter: 'active' | 'archived';
  total: number;
}

function duration(seconds?: number | null) {
  if (!seconds) return '—';
  const roundedSeconds = Math.round(seconds);
  return `${Math.floor(roundedSeconds / 60)}:${String(roundedSeconds % 60).padStart(2, '0')}`;
}

export default function MusicLibraryPanel({
  activeAudio,
  error,
  history,
  items,
  loading,
  mode,
  onCreate,
  onFilterChange,
  onModeChange,
  onOpenJob,
  onOpenTrack,
  onQueryChange,
  onSignedUrlExpired,
  permissions,
  query,
  selectedJobId,
  selectedTrackId,
  statusFilter,
  total,
}: MusicLibraryPanelProps) {
  const {t} = useTranslation();
  const signedUrlRefreshKeysRef = useRef(new Set<string>());

  const sourceLabel = (track: MusicLibraryItem) => {
    if (track.source === 'generated' || track.activeVersion?.provenance?.createdByAi) {
      return t('musicStudio.library.source.ai');
    }
    if (track.source === 'manual') return t('musicStudio.library.source.uploaded');
    return t('musicStudio.library.source.legacy');
  };

  return (
    <aside className="music-library" aria-label={t('musicStudio.library.title')}>
      <div className="music-library__header">
        <div>
          <h2>{mode === 'library'
            ? t('musicStudio.library.title')
            : t('musicStudio.history.title')}</h2>
          <span className="music-library__count">
            {mode === 'library'
              ? t('musicStudio.library.count', {count: total})
              : t('musicStudio.history.count', {count: history.length})}
          </span>
        </div>
        {permissions.canRunGeneration && (
          <Button
            className="music-library__create"
            type="primary"
            icon={<PlusOutlined />}
            aria-label={t('musicStudio.library.newTrack')}
            title={t('musicStudio.library.newTrack')}
            onClick={onCreate}
          />
        )}
      </div>
      <Segmented
        block
        className="music-library__tabs"
        value={mode}
        options={[
          {label: t('musicStudio.library.title'), value: 'library'},
          {icon: <HistoryOutlined />, label: t('musicStudio.history.title'), value: 'history'},
        ]}
        onChange={(value) => onModeChange(value as 'library' | 'history')}
      />

      {mode === 'library' && (
        <>
          <Input
            allowClear
            className="music-library__search"
            aria-label={t('musicStudio.library.search')}
            prefix={<SearchOutlined />}
            placeholder={t('musicStudio.library.searchPlaceholder')}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
          <Segmented
            block
            className="music-library__status-filter"
            value={statusFilter}
            options={[
              {label: t('musicStudio.library.active'), value: 'active'},
              {label: t('musicStudio.library.archived'), value: 'archived'},
            ]}
            onChange={(value) => onFilterChange(value as 'active' | 'archived')}
          />
        </>
      )}

      {loading ? (
        <div className="music-library__skeleton" aria-label={t('musicStudio.library.loading')}>
          {[0, 1, 2, 3].map((item) => (
            <div className="music-library-row" key={item}>
              <Skeleton active paragraph={{rows: 2}} title={{width: '72%'}} />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="music-library__error" role="alert">{error}</div>
      ) : mode === 'library' ? (
        items.length === 0 ? (
          <Empty
            description={statusFilter === 'active'
              ? t('musicStudio.library.empty')
              : t('musicStudio.library.emptyArchived')}
          />
        ) : (
          <div className="music-library__list">
            {items.map((track) => (
              <article
                className={selectedTrackId === track.id
                  ? 'music-library-row music-library-row--selected'
                  : 'music-library-row'}
                key={track.id}
              >
                <button type="button" onClick={() => onOpenTrack(track.id)}>
                  <span>
                    <strong>{track.title}</strong>
                    <small>
                      {sourceLabel(track)} · {duration(track.activeVersion?.durationSeconds)}
                    </small>
                  </span>
                  <span>{t('musicStudio.library.usage', {count: track.usageCount})}</span>
                </button>
                <div className="music-library-row__tags">
                  {track.tags.slice(0, 3).map((tag) => <Tag key={tag}>{tag}</Tag>)}
                </div>
                {track.activeVersion?.audioUrl && (
                  <AudioPlayer
                    compact
                    durationSeconds={track.activeVersion.durationSeconds}
                    label={t('musicStudio.player.track', {title: track.title})}
                    src={backendAssetUrl(track.activeVersion.audioUrl)}
                    onPlay={activeAudio}
                    onError={() => {
                      const refreshKey = track.activeVersion?.versionId
                        ?? ['legacy', track.id].join('-');
                      if (signedUrlRefreshKeysRef.current.has(refreshKey)) return;
                      signedUrlRefreshKeysRef.current.add(refreshKey);
                      onSignedUrlExpired();
                    }}
                  />
                )}
              </article>
            ))}
          </div>
        )
      ) : history.length === 0 ? (
        <Empty description={t('musicStudio.history.empty')} />
      ) : (
        <div className="music-library__list">
          {history.map((job) => (
            <button
              type="button"
              className={selectedJobId === job.jobId
                ? 'music-history-row music-history-row--selected'
                : 'music-history-row'}
              key={job.jobId}
              onClick={() => onOpenJob(job.jobId)}
            >
              <span>
                <strong>{job.brief.title}</strong>
                <small>{job.brief.genre} · {duration(job.brief.durationSeconds)}</small>
              </span>
              <Tag color={job.status === 'completed' ? 'green' : undefined}>
                {t(`musicStudio.job.status.${job.status}`)}
              </Tag>
            </button>
          ))}
        </div>
      )}

      {!permissions.canEdit && (
        <div className="music-readonly-note">{t('musicStudio.readOnly')}</div>
      )}
    </aside>
  );
}
