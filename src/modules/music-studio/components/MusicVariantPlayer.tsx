import React, {useEffect, useRef, useState} from 'react';
import {Button, Tag} from 'antd';
import {CheckOutlined} from '@ant-design/icons';
import {useTranslation} from 'react-i18next';

import {backendAssetUrl} from '../../../api/http';
import type {MusicVariant} from '../types';

interface MusicVariantPlayerProps {
  applying?: boolean;
  disabled?: boolean;
  onApply: () => void;
  onAudioPlay: (audio: HTMLAudioElement) => void;
  onSignedUrlExpired?: (refreshKey: string) => void;
  variant: MusicVariant;
}

function formatDuration(seconds: number | null) {
  const rounded = Math.max(0, Math.round(seconds ?? 0));
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`;
}

export default function MusicVariantPlayer({
  applying = false,
  disabled = false,
  onApply,
  onAudioPlay,
  onSignedUrlExpired,
  variant,
}: MusicVariantPlayerProps) {
  const {t} = useTranslation();
  const audioRef = useRef<HTMLAudioElement>(null);
  const refreshAttemptedRef = useRef(false);
  const [buffering, setBuffering] = useState(false);

  useEffect(() => {
    refreshAttemptedRef.current = false;
  }, [variant.variantId]);

  useEffect(() => () => {
    audioRef.current?.pause();
  }, []);

  const label = t('musicStudio.player.variant', {letter: String.fromCharCode(65 + variant.index)});
  return (
    <article className="music-variant-player">
      <div className="music-variant-player__heading">
        <strong>{label}</strong>
        <span>{formatDuration(variant.durationSeconds)}</span>
        {variant.appliedTrackVersionId && (
          <Tag color="green" icon={<CheckOutlined />}>
            {t('musicStudio.player.applied')}
          </Tag>
        )}
      </div>
      {variant.audioUrl ? (
        <audio
          ref={audioRef}
          controls
          preload="metadata"
          aria-label={label}
          src={backendAssetUrl(variant.audioUrl)}
          onCanPlay={() => setBuffering(false)}
          onPlay={(event) => onAudioPlay(event.currentTarget)}
          onWaiting={() => setBuffering(true)}
          onError={() => {
            if (refreshAttemptedRef.current) return;
            refreshAttemptedRef.current = true;
            onSignedUrlExpired?.(variant.variantId);
          }}
        >
          {t('musicStudio.player.unsupported')}
        </audio>
      ) : (
        <span className="music-player-status">{t('musicStudio.player.unavailable')}</span>
      )}
      <span className="music-player-status" aria-live="polite">
        {buffering ? t('musicStudio.player.buffering') : ''}
      </span>
      {!disabled && (
        <Button
          type="primary"
          disabled={Boolean(variant.appliedTrackVersionId)}
          loading={applying}
          onClick={onApply}
        >
          {variant.appliedTrackVersionId
            ? t('musicStudio.player.applied')
            : t('musicStudio.player.choose')}
        </Button>
      )}
    </article>
  );
}
