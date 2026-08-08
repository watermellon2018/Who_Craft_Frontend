import React, {useEffect, useRef} from 'react';
import {
  Checkbox,
  Collapse,
  Form,
  Input,
  InputNumber,
  Segmented,
  Select,
} from 'antd';
import {useTranslation} from 'react-i18next';

import type {
  MusicBrief,
  MusicBriefContent,
  MusicCapabilities,
  MusicContentMode,
  MusicVocalStyle,
} from '../types';

type MusicSongContent = Extract<MusicBriefContent, {mode: 'song'}>;

interface MusicBriefFormProps {
  capabilities: MusicCapabilities;
  disabled?: boolean;
  onChange: (brief: MusicBrief) => void;
  onVariantCountChange: (count: number) => void;
  scenePrefilled?: boolean;
  value: MusicBrief;
  variantCount: number;
}

function translatedOptions(
  values: string[],
  prefix: string,
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  return values.map((value) => ({
    label: t(`${prefix}.${value}`, {defaultValue: value.replaceAll('_', ' ')}),
    value,
  }));
}

export default function MusicBriefForm({
  capabilities,
  disabled = false,
  onChange,
  onVariantCountChange,
  scenePrefilled = false,
  value,
  variantCount,
}: MusicBriefFormProps) {
  const {t} = useTranslation();
  const update = (patch: Partial<MusicBrief>) => onChange({...value, ...patch});
  const songContent = value.content.mode === 'song' ? value.content : null;
  const songDraftRef = useRef<MusicSongContent | null>(songContent);

  useEffect(() => {
    if (songContent) songDraftRef.current = songContent;
  }, [songContent]);

  const changeMode = (mode: MusicContentMode) => {
    if (mode === 'instrumental') {
      update({content: {mode}, purpose: value.purpose === 'song' ? 'underscore' : value.purpose});
      return;
    }
    update({
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
      purpose: 'song',
    });
  };

  const updateVocalStyle = (patch: Partial<MusicVocalStyle>) => {
    if (!songContent) return;
    update({content: {...songContent, vocalStyle: {...songContent.vocalStyle, ...patch}}});
  };

  const advanced = (
    <div className="music-form-grid">
      {value.tempo.mode === 'bpm' && (
        <Form.Item label={t('musicStudio.brief.bpm')}>
          <InputNumber
            aria-label={t('musicStudio.brief.bpm')}
            disabled={disabled}
            min={40}
            max={220}
            value={value.tempo.bpm}
            onChange={(bpm) => update({tempo: {bpm: bpm ?? 40, mode: 'bpm'}})}
          />
        </Form.Item>
      )}
      <Form.Item label={t('musicStudio.brief.exclude')}>
        <Select
          aria-label={t('musicStudio.brief.exclude')}
          disabled={disabled}
          mode="multiple"
          value={value.exclude}
          onChange={(exclude) => update({exclude: exclude.slice(0, 6)})}
          options={translatedOptions(
            capabilities.briefFields.instruments,
            'musicStudio.options.instrument',
            t,
          )}
        />
      </Form.Item>
      <Form.Item label={t('musicStudio.brief.variantCount')}>
        <Segmented
          aria-label={t('musicStudio.brief.variantCount')}
          disabled={disabled}
          options={capabilities.variantCounts}
          value={variantCount}
          onChange={(count) => onVariantCountChange(Number(count))}
        />
      </Form.Item>
      {capabilities.supportsSeed && (
        <Form.Item label={t('musicStudio.brief.seed')}>
          <InputNumber
            aria-label={t('musicStudio.brief.seed')}
            disabled={disabled}
            min={0}
            placeholder={t('musicStudio.brief.seedPlaceholder')}
            value={value.seed ?? undefined}
            onChange={(seed) => update({seed})}
          />
        </Form.Item>
      )}
      {songContent && (
        <>
          <Form.Item label={t('musicStudio.brief.vocalTimbre')}>
            <Select
              aria-label={t('musicStudio.brief.vocalTimbre')}
              disabled={disabled}
              value={songContent.vocalStyle.timbre}
              onChange={(timbre) => updateVocalStyle({timbre})}
              options={translatedOptions(
                capabilities.briefFields.vocalStyles.timbres,
                'musicStudio.options.vocalTimbre',
                t,
              )}
            />
          </Form.Item>
          <Form.Item label={t('musicStudio.brief.vocalDelivery')}>
            <Select
              aria-label={t('musicStudio.brief.vocalDelivery')}
              disabled={disabled}
              value={songContent.vocalStyle.delivery}
              onChange={(delivery) => updateVocalStyle({delivery})}
              options={translatedOptions(
                capabilities.briefFields.vocalStyles.deliveries,
                'musicStudio.options.vocalDelivery',
                t,
              )}
            />
          </Form.Item>
        </>
      )}
      <Form.Item className="music-form-grid__wide">
        <Checkbox
          checked={value.loopable}
          disabled={disabled}
          onChange={(event) => update({loopable: event.target.checked})}
        >
          {t('musicStudio.brief.loopable')}
        </Checkbox>
      </Form.Item>
    </div>
  );

  return (
    <>
      <section className="music-card" aria-labelledby="music-mode-title">
        <div className="music-section-heading">
          <div>
            <h2 id="music-mode-title">{t('musicStudio.brief.modeTitle')}</h2>
            <p>{t('musicStudio.brief.modeHelper')}</p>
          </div>
          {scenePrefilled && <span className="music-prefill-badge">{t('musicStudio.scene.prefilled')}</span>}
        </div>
        <Segmented
          block
          aria-label={t('musicStudio.brief.modeTitle')}
          disabled={disabled}
          options={capabilities.contentModes.map((mode) => ({
            label: t(`musicStudio.brief.mode.${mode}`),
            value: mode,
          }))}
          value={value.content.mode}
          onChange={(mode) => changeMode(mode as MusicContentMode)}
        />
      </section>

      <section className="music-card" aria-labelledby="music-sound-title">
        <div className="music-section-heading">
          <div>
            <h2 id="music-sound-title">{t('musicStudio.brief.soundTitle')}</h2>
            <p>{t('musicStudio.brief.soundHelper')}</p>
          </div>
        </div>
        <Form layout="vertical" requiredMark={false} component={false}>
          <div className="music-form-grid">
            <Form.Item label={t('musicStudio.brief.title')} required>
              <Input
                aria-label={t('musicStudio.brief.title')}
                disabled={disabled}
                maxLength={255}
                value={value.title}
                onChange={(event) => update({title: event.target.value})}
              />
            </Form.Item>
            <Form.Item label={t('musicStudio.brief.purpose')} required>
              <Select
                aria-label={t('musicStudio.brief.purpose')}
                disabled={disabled}
                value={value.purpose}
                onChange={(purpose) => update({purpose})}
                options={translatedOptions(
                  capabilities.briefFields.purposes,
                  'musicStudio.options.purpose',
                  t,
                )}
              />
            </Form.Item>
            <Form.Item label={t('musicStudio.brief.genre')} required>
              <Select
                aria-label={t('musicStudio.brief.genre')}
                disabled={disabled}
                value={value.genre}
                onChange={(genre) => update({genre})}
                options={translatedOptions(
                  capabilities.briefFields.genres,
                  'musicStudio.options.genre',
                  t,
                )}
              />
            </Form.Item>
            <Form.Item label={t('musicStudio.brief.duration')} required>
              <InputNumber
                aria-label={t('musicStudio.brief.duration')}
                addonAfter={t('musicStudio.units.seconds')}
                disabled={disabled}
                min={capabilities.duration.minSeconds}
                max={capabilities.duration.maxSeconds}
                value={value.durationSeconds}
                onChange={(durationSeconds) => update({
                  durationSeconds: durationSeconds ?? capabilities.duration.defaultSeconds,
                })}
              />
            </Form.Item>
            <Form.Item
              label={t('musicStudio.brief.moods')}
              required
              extra={t('musicStudio.brief.moodsHint')}
            >
              <Select
                aria-label={t('musicStudio.brief.moods')}
                disabled={disabled}
                mode="multiple"
                value={value.moods}
                onChange={(moods) => update({moods: moods.slice(0, 3)})}
                options={translatedOptions(
                  capabilities.briefFields.moods,
                  'musicStudio.options.mood',
                  t,
                )}
              />
            </Form.Item>
            <Form.Item
              label={t('musicStudio.brief.instruments')}
              extra={t('musicStudio.brief.instrumentsHint')}
            >
              <Select
                aria-label={t('musicStudio.brief.instruments')}
                disabled={disabled}
                mode="multiple"
                value={value.instruments}
                onChange={(instruments) => update({instruments: instruments.slice(0, 6)})}
                options={translatedOptions(
                  capabilities.briefFields.instruments,
                  'musicStudio.options.instrument',
                  t,
                )}
              />
            </Form.Item>
            <Form.Item label={t('musicStudio.brief.energy')}>
              <Select
                aria-label={t('musicStudio.brief.energy')}
                disabled={disabled}
                value={value.energyCurve}
                onChange={(energyCurve) => update({energyCurve})}
                options={translatedOptions(
                  capabilities.briefFields.energyCurves,
                  'musicStudio.options.energy',
                  t,
                )}
              />
            </Form.Item>
            <Form.Item label={t('musicStudio.brief.tempo')}>
              <Select
                aria-label={t('musicStudio.brief.tempo')}
                disabled={disabled}
                value={value.tempo.mode}
                onChange={(mode) => update({
                  tempo: mode === 'bpm' ? {bpm: value.tempo.bpm ?? 90, mode} : {mode},
                })}
                options={translatedOptions(
                  capabilities.briefFields.tempoModes,
                  'musicStudio.options.tempo',
                  t,
                )}
              />
            </Form.Item>
            <Form.Item className="music-form-grid__wide" label={t('musicStudio.brief.comment')}>
              <Input.TextArea
                aria-label={t('musicStudio.brief.comment')}
                autoSize={{minRows: 3, maxRows: 8}}
                disabled={disabled}
                maxLength={1000}
                showCount
                value={value.textRefinement}
                onChange={(event) => update({textRefinement: event.target.value})}
              />
            </Form.Item>
          </div>
          <Collapse
            ghost
            items={[{
              children: advanced,
              key: 'advanced',
              label: t('musicStudio.brief.advanced'),
            }]}
          />
        </Form>
      </section>
    </>
  );
}
