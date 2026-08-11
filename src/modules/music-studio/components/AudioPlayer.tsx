import {
  PauseCircleFilled,
  PlayCircleFilled,
  SoundOutlined,
} from '@ant-design/icons';
import {Button} from 'antd';
import React, {useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';

export interface AudioPlayerProps {
  className?: string;
  compact?: boolean;
  durationSeconds?: number | null;
  label: string;
  onError?: () => void;
  onPlay?: (audio: HTMLAudioElement) => void;
  src: string;
}

const normaliseTime = (seconds?: number | null) => (
  typeof seconds === 'number' && Number.isFinite(seconds) && seconds >= 0 ? seconds : 0
);

const formatTime = (seconds: number) => {
  const wholeSeconds = Math.floor(normaliseTime(seconds));
  return `${Math.floor(wholeSeconds / 60)}:${String(wholeSeconds % 60).padStart(2, '0')}`;
};

export default function AudioPlayer({
  className,
  compact = false,
  durationSeconds,
  label,
  onError,
  onPlay,
  src,
}: AudioPlayerProps) {
  const {t} = useTranslation();
  const audioRef = useRef<HTMLAudioElement>(null);
  const durationSecondsRef = useRef(durationSeconds);
  const loadedMetadataRef = useRef(false);
  const previousSourceRef = useRef(src);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(() => normaliseTime(durationSeconds));
  const [loadError, setLoadError] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(1);

  durationSecondsRef.current = durationSeconds;

  useEffect(() => {
    if (previousSourceRef.current === src) return;

    previousSourceRef.current = src;
    loadedMetadataRef.current = false;
    const audio = audioRef.current;
    audio?.pause();
    if (audio) audio.currentTime = 0;
    setCurrentTime(0);
    setDuration(normaliseTime(durationSecondsRef.current));
    setLoadError(false);
    setPlaying(false);
  }, [src]);

  useEffect(() => {
    if (!loadedMetadataRef.current) {
      setDuration(normaliseTime(durationSeconds));
    }
  }, [durationSeconds]);

  useEffect(() => () => {
    audioRef.current?.pause();
  }, []);

  const syncDuration = () => {
    const audioDuration = audioRef.current?.duration;
    if (audioDuration !== undefined && Number.isFinite(audioDuration) && audioDuration >= 0) {
      loadedMetadataRef.current = true;
      setDuration(audioDuration);
    }
  };

  const togglePlayback = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      audio.pause();
      return;
    }

    const playResult = audio.play();
    if (playResult) {
      void playResult.catch(() => {
        setLoadError(true);
        setPlaying(false);
      });
    }
  };

  const seek = (value: string) => {
    const nextTime = Number(value);
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(nextTime)) return;

    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const changeVolume = (value: string) => {
    const nextVolume = Number(value);
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(nextVolume)) return;

    audio.volume = nextVolume;
    setVolume(nextVolume);
  };

  const rootClassName = [
    'music-audio-player',
    compact ? 'music-audio-player--compact' : '',
    className ?? '',
  ].filter(Boolean).join(' ');

  return (
    <div aria-label={label} className={rootClassName} role="group">
      <audio
        hidden
        ref={audioRef}
        className="music-audio-player__native"
        preload="metadata"
        src={src}
        onDurationChange={syncDuration}
        onEnded={() => {
          setCurrentTime(duration);
          setPlaying(false);
        }}
        onError={() => {
          setLoadError(true);
          setPlaying(false);
          onError?.();
        }}
        onLoadedMetadata={() => {
          setLoadError(false);
          syncDuration();
        }}
        onPause={() => setPlaying(false)}
        onPlay={(event) => {
          setPlaying(true);
          onPlay?.(event.currentTarget);
        }}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onVolumeChange={(event) => setVolume(event.currentTarget.volume)}
      />
      <Button
        aria-label={`${t(playing ? 'musicStudio.player.pause' : 'musicStudio.player.play')}: ${label}`}
        aria-pressed={playing}
        className="music-audio-player__play"
        disabled={loadError}
        icon={playing ? <PauseCircleFilled /> : <PlayCircleFilled />}
        shape="circle"
        type="text"
        onClick={togglePlayback}
      />
      <input
        aria-label={t('musicStudio.player.seek')}
        className="music-audio-player__seek"
        disabled={duration <= 0 || loadError}
        max={duration}
        min={0}
        step={0.1}
        type="range"
        value={Math.min(currentTime, duration)}
        onChange={(event) => seek(event.target.value)}
      />
      <span className="music-audio-player__time">
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>
      {loadError && (
        <span className="music-audio-player__error" role="status">
          {t('musicStudio.player.unavailable')}
        </span>
      )}
      <label className="music-audio-player__volume">
        <SoundOutlined aria-hidden="true" />
        <input
          aria-label={t('musicStudio.player.volume')}
          max={1}
          min={0}
          step={0.05}
          type="range"
          value={volume}
          onChange={(event) => changeVolume(event.target.value)}
        />
      </label>
    </div>
  );
}
