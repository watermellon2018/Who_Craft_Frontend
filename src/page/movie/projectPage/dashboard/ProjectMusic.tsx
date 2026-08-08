import React, {useEffect, useRef, useState} from 'react';
import {
  PlusOutlined,
  CaretRightOutlined,
  PauseOutlined,
  MoreOutlined,
  CustomerServiceOutlined,
} from '@ant-design/icons';
import {useTranslation} from 'react-i18next';
import {backendAssetUrl} from '../../../../api/http';
import type {TrackMock} from './mocks';

const WAVE_BARS = 36;

function seededHeights(seed: number, count: number): number[] {
  const out: number[] = [];
  let s = seed;
  for (let i = 0; i < count; i += 1) {
    s = (s * 9301 + 49297) % 233280;
    const r = s / 233280;
    out.push(0.25 + r * 0.75);
  }
  return out;
}

const Waveform: React.FC<{ seed: number; activeFrac: number }> = ({ seed, activeFrac }) => {
  const heights = seededHeights(seed, WAVE_BARS);
  const activeUntil = Math.floor(WAVE_BARS * activeFrac);
  return (
    <div className="proj-wave">
      {heights.map((h, i) => (
        <div
          key={i}
          className={`proj-wave-bar${i < activeUntil ? ' active' : ''}`}
          style={{ height: `${h * 100}%` }}
        />
      ))}
    </div>
  );
};

interface MusicTrackRowProps {
  track: TrackMock;
  activeFrac: number;
  isPlaying: boolean;
  onOpen: () => void;
  onToggle: () => void;
}

const MusicTrackRow: React.FC<MusicTrackRowProps> = ({
  track, activeFrac, isPlaying, onOpen, onToggle,
}) => {
  const {t} = useTranslation();
  return (
    <div className="proj-track-row">
      <button
        type="button"
        className="proj-track-play"
        disabled={!track.audioUrl}
        onClick={onToggle}
        title={track.audioUrl ? undefined : t('musicStudio.player.unavailable', {defaultValue: 'Аудиофайл недоступен'})}
        aria-label={isPlaying
          ? t('musicStudio.player.pauseTrack', {title: track.title, defaultValue: 'Пауза — ' + track.title})
          : t('musicStudio.player.track', {title: track.title})}
      >
        {isPlaying ? <PauseOutlined /> : <CaretRightOutlined />}
      </button>

      <div className="proj-track-cover" style={{ background: track.coverGradient }}>
        <CustomerServiceOutlined />
      </div>

      <div className="min-w-0 flex-shrink-0" style={{ width: 200 }}>
        <button
          type="button"
          className="proj-track-title text-white text-sm font-semibold truncate"
          onClick={onOpen}
          title={track.title}
        >
          {track.title}
        </button>
        <div className="proj-track-meta text-white/65 text-xs truncate">
          <span>{track.author}</span>
          {track.versionNumber != null && <span>{t('musicStudio.track.version', {number: track.versionNumber})}</span>}
        </div>
      </div>

      <Waveform seed={track.waveSeed} activeFrac={isPlaying ? activeFrac : 0} />

      <div className="hidden md:flex flex-wrap gap-1.5 flex-shrink-0">
        {track.tags.map((t) => (
          <span key={t} className="proj-tag" style={{ fontSize: 11, padding: '3px 8px' }}>
            {t}
          </span>
        ))}
      </div>

      <div className="flex flex-col items-end gap-0.5 flex-shrink-0 ml-2">
        <span className="text-white/85 text-xs font-medium tabular-nums">{track.duration}</span>
        <span className="text-white/55 text-[11px] hidden sm:inline">
          {t('musicStudio.library.usage', {count: track.usageCount})}
        </span>
      </div>

      <button
        type="button"
        className="text-white/60 hover:text-white p-1 flex-shrink-0"
        onClick={onOpen}
        title={t('musicStudio.track.detail')}
        aria-label={t('musicStudio.track.detail') + ': ' + track.title}
      >
        <MoreOutlined />
      </button>
    </div>
  );
};

interface Props {
  tracks: TrackMock[];
  onAdd?: () => void;
  onOpenTrack: (trackId: string) => void;
}

const ProjectMusic: React.FC<Props> = ({ tracks, onAdd, onOpenTrack }) => {
  const {t} = useTranslation();
  const playerRef = useRef<HTMLAudioElement | null>(null);
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [playbackProgress, setPlaybackProgress] = useState(0);

  useEffect(() => () => {
    playerRef.current?.pause();
    playerRef.current = null;
  }, []);

  const resetPlayback = (player: HTMLAudioElement) => {
    if (playerRef.current !== player) return;
    setActiveTrackId(null);
    setPlaybackProgress(0);
  };

  const syncPlaybackProgress = (player: HTMLAudioElement) => {
    if (playerRef.current !== player) return;
    const duration = player.duration;
    const fraction = Number.isFinite(duration) && duration > 0
      ? player.currentTime / duration
      : 0;
    setPlaybackProgress(Math.max(0, Math.min(1, fraction)));
  };

  const togglePlayback = (track: TrackMock) => {
    if (!track.audioUrl) return;
    const current = playerRef.current;
    if (current && activeTrackId === track.id) {
      current.pause();
      setActiveTrackId(null);
      setPlaybackProgress(0);
      return;
    }
    current?.pause();
    setPlaybackProgress(0);
    const player = new Audio(backendAssetUrl(track.audioUrl));
    player.preload = 'metadata';
    player.addEventListener('durationchange', () => {
      syncPlaybackProgress(player);
    });
    player.addEventListener('timeupdate', () => {
      syncPlaybackProgress(player);
    });
    player.addEventListener('ended', () => {
      resetPlayback(player);
    });
    player.addEventListener('error', () => {
      resetPlayback(player);
    });
    playerRef.current = player;
    setActiveTrackId(track.id);
    void player.play().catch(() => {
      resetPlayback(player);
    });
  };

  return (
    <section className="proj-card p-5 sm:p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="proj-section-title">{t('musicStudio.title')}</h3>
        {onAdd && <button
          type="button"
          className="proj-btn proj-btn-secondary"
          style={{ padding: '8px 14px', fontSize: 13 }}
          onClick={onAdd}
          aria-label={t('musicStudio.library.newTrack')}
        >
          <PlusOutlined />
          {t('musicStudio.library.newTrack')}
        </button>}
      </div>

      <div className="flex flex-col gap-3">
        {tracks.map((t) => (
          <MusicTrackRow
            key={t.id}
            track={t}
            activeFrac={activeTrackId === t.id ? playbackProgress : 0}
            isPlaying={activeTrackId === t.id}
            onOpen={() => onOpenTrack(t.id)}
            onToggle={() => togglePlayback(t)}
          />
        ))}
      </div>
    </section>
  );
};

export default ProjectMusic;
