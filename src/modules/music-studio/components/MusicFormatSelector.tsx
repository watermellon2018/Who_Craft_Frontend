import {AudioOutlined} from '@ant-design/icons';
import React, {useEffect, useRef} from 'react';
import {useTranslation} from 'react-i18next';

import type {
  MusicBrief,
  MusicBriefContent,
  MusicCapabilities,
  MusicContentMode,
} from '../types';

type MusicSongContent = Extract<MusicBriefContent, {mode: 'song'}>;

interface MusicFormatSelectorProps {
  capabilities: MusicCapabilities;
  disabled?: boolean;
  onChange: (brief: MusicBrief) => void;
  value: MusicBrief;
}

export default function MusicFormatSelector({
  capabilities,
  disabled = false,
  onChange,
  value,
}: MusicFormatSelectorProps) {
  const {t} = useTranslation();
  const songContent = value.content.mode === 'song' ? value.content : null;
  const songDraftRef = useRef<MusicSongContent | null>(songContent);

  useEffect(() => {
    if (songContent) songDraftRef.current = songContent;
  }, [songContent]);

  const changeMode = (mode: MusicContentMode) => {
    if (mode === value.content.mode) return;
    const purpose = value.purpose === 'song'
      ? capabilities.briefFields.purposes.find((item) => item !== 'song') ?? ''
      : value.purpose;
    if (mode === 'instrumental') {
      onChange({
        ...value,
        content: {mode},
        purpose,
      });
      return;
    }

    onChange({
      ...value,
      content: songDraftRef.current ?? {
        lyricsLanguage: capabilities.lyrics.languages[0] ?? 'ru',
        mode,
        sections: [{
          label: t('musicStudio.lyrics.defaultVerse'),
          text: '',
          type: 'verse',
        }],
        vocalStyle: {
          delivery: capabilities.briefFields.vocalStyles.deliveries[0] ?? 'soft',
          timbre: capabilities.briefFields.vocalStyles.timbres[0] ?? 'warm',
        },
      },
      purpose,
    });
  };

  return (
    <section className="music-card music-format-card" aria-labelledby="music-format-title">
      <div className="music-section-heading">
        <div>
          <h2 id="music-format-title">{t('musicStudio.format.title')}</h2>
          <p id="music-format-helper">{t('musicStudio.format.helper')}</p>
        </div>
      </div>
      <div
        aria-describedby="music-format-helper"
        aria-labelledby="music-format-title"
        className="music-format-options"
        role="radiogroup"
      >
        {capabilities.contentModes.map((mode) => {
          const selected = value.content.mode === mode;
          return (
            <button
              aria-checked={selected}
              className={`music-format-option${selected ? ' music-format-option--selected' : ''}`}
              disabled={disabled}
              key={mode}
              role="radio"
              type="button"
              onClick={() => changeMode(mode)}
            >
              <span aria-hidden="true" className="music-format-option__icon">
                {mode === 'instrumental' ? '♪' : <AudioOutlined />}
              </span>
              <span className="music-format-option__copy">
                <strong>{t(`musicStudio.brief.mode.${mode}`)}</strong>
                <small>{t(`musicStudio.format.description.${mode}`)}</small>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
