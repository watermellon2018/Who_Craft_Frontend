import React, {useRef} from 'react';
import {Button, Empty, Input, Segmented, Spin, Tag} from 'antd';
import {HistoryOutlined, PlusOutlined, SearchOutlined} from '@ant-design/icons';
import {useTranslation} from 'react-i18next';

import {backendAssetUrl} from '../../../api/http';
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
}

function duration(seconds?: number | null) {
  if (!seconds) return '—';
  return `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;
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
}: MusicLibraryPanelProps) {
  const {t} = useTranslation();
  const signedUrlRefreshKeysRef = useRef(new Set<string>());
  return (
    <aside className="music-library" aria-label={t('musicStudio.library.title')}>
      <div className="music-library__header">
        <h2>{mode === 'library'
          ? t('musicStudio.library.title')
          : t('musicStudio.history.title')}</h2>
        {permissions.canRunGeneration && (
          <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
            {t('musicStudio.library.newTrack')}
          </Button>
        )}
      </div>
      <Segmented
        block
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
            aria-label={t('musicStudio.library.search')}
            prefix={<SearchOutlined />}
            placeholder={t('musicStudio.library.searchPlaceholder')}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
          <Segmented
            block
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
        <div className="music-centered"><Spin /></div>
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
                    <small>{track.author} · {duration(track.activeVersion?.durationSeconds)}</small>
                  </span>
                  <span>{t('musicStudio.library.usage', {count: track.usageCount})}</span>
                </button>
                <div className="music-library-row__tags">
                  {track.tags.slice(0, 3).map((tag) => <Tag key={tag}>{tag}</Tag>)}
                </div>
                {track.activeVersion?.audioUrl && (
                  <audio
                    controls
                    preload="metadata"
                    aria-label={t('musicStudio.player.track', {title: track.title})}
                    src={backendAssetUrl(track.activeVersion.audioUrl)}
                    onPlay={(event) => activeAudio(event.currentTarget)}
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
