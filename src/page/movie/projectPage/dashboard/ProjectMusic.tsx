import React from 'react';
import {
  PlusOutlined,
  CaretRightOutlined,
  MoreOutlined,
  CustomerServiceOutlined,
} from '@ant-design/icons';
import { TrackMock } from './mocks';

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

const MusicTrackRow: React.FC<{ track: TrackMock; activeFrac: number }> = ({ track, activeFrac }) => {
  return (
    <div className="proj-track-row">
      <button
        type="button"
        className="proj-track-play"
        onClick={() => console.log('TODO: play track', track.id)}
        aria-label="Play"
      >
        <CaretRightOutlined />
      </button>

      <div className="proj-track-cover" style={{ background: track.coverGradient }}>
        <CustomerServiceOutlined />
      </div>

      <div className="min-w-0 flex-shrink-0" style={{ width: 200 }}>
        <div className="text-white text-sm font-semibold truncate">{track.title}</div>
        <div className="text-white/65 text-xs truncate">{track.author}</div>
      </div>

      <Waveform seed={track.waveSeed} activeFrac={activeFrac} />

      <div className="hidden md:flex flex-wrap gap-1.5 flex-shrink-0">
        {track.tags.map((t) => (
          <span key={t} className="proj-tag" style={{ fontSize: 11, padding: '3px 8px' }}>
            {t}
          </span>
        ))}
      </div>

      <div className="flex flex-col items-end gap-0.5 flex-shrink-0 ml-2">
        <span className="text-white/85 text-xs font-medium tabular-nums">{track.duration}</span>
        <span className="text-white/55 text-[11px] hidden sm:inline">{track.usageLabel}</span>
      </div>

      <button
        type="button"
        className="text-white/60 hover:text-white p-1 flex-shrink-0"
        onClick={() => console.log('TODO: track menu', track.id)}
        aria-label="More"
      >
        <MoreOutlined />
      </button>
    </div>
  );
};

interface Props {
  tracks: TrackMock[];
  onAdd: () => void;
}

const ProjectMusic: React.FC<Props> = ({ tracks, onAdd }) => {
  return (
    <section className="proj-card p-5 sm:p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="proj-section-title">Музыка проекта</h3>
        <button
          type="button"
          className="proj-btn proj-btn-secondary"
          style={{ padding: '8px 14px', fontSize: 13 }}
          onClick={onAdd}
        >
          <PlusOutlined />
          Добавить музыку
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {tracks.map((t, i) => (
          <MusicTrackRow key={t.id} track={t} activeFrac={i === 0 ? 0.4 : 0.15} />
        ))}
      </div>
    </section>
  );
};

export default ProjectMusic;
