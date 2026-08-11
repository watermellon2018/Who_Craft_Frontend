import React, {useEffect, useId, useRef, useState} from 'react';
import type {DragEvent, KeyboardEvent} from 'react';
import {DeleteOutlined, EditOutlined, UploadOutlined} from '@ant-design/icons';
import {Alert, Button, Input, Tag} from 'antd';
import {useTranslation} from 'react-i18next';

import type {MusicCapabilities} from '../types';

const DESCRIPTION_MAX_LENGTH = 1000;
const TITLE_MAX_LENGTH = 255;

interface AudioUploadError {
  key:
    | 'musicStudio.upload.errors.duration'
    | 'musicStudio.upload.errors.format'
    | 'musicStudio.upload.errors.metadata'
    | 'musicStudio.upload.errors.size';
  values: Record<string, string>;
}

export interface AudioUploadDraft {
  description: string;
  durationSeconds: number | null;
  edited?: boolean;
  file: File | null;
  originalFile?: File | null;
  status: 'checking' | 'empty' | 'invalid' | 'ready';
  title: string;
}

interface AudioUploadFormProps {
  capabilities: MusicCapabilities['audioReference'];
  disabled?: boolean;
  onAudioPlay: (audio: HTMLAudioElement) => void;
  onChange: (draft: AudioUploadDraft) => void;
  onEdit?: () => void;
  value: AudioUploadDraft;
}

function normalizeFormat(format: string) {
  return format.trim().toLowerCase().replace(/^\./, '');
}

function getFileExtension(fileName: string) {
  const separatorIndex = fileName.lastIndexOf('.');
  return separatorIndex >= 0 ? fileName.slice(separatorIndex + 1).toLowerCase() : '';
}

function formatDuration(seconds: number | null) {
  if (seconds === null) return null;
  const rounded = Math.max(0, Math.round(seconds));
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`;
}

export default function AudioUploadForm({
  capabilities,
  disabled = false,
  onAudioPlay,
  onChange,
  onEdit,
  value,
}: AudioUploadFormProps) {
  const {t} = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const previewAudioRef = useRef<HTMLAudioElement>(null);
  const headingId = useId();
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<AudioUploadError | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const supportedFormats = capabilities.formats.map(normalizeFormat).filter(Boolean);
  const formattedFormats = supportedFormats.map((format) => format.toUpperCase()).join(', ');
  const effectiveDisabled = disabled;
  const accept = supportedFormats.map((format) => `.${format}`).join(',');

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) {
      return t('musicStudio.upload.size.bytes', {size: bytes});
    }
    if (bytes < 1024 * 1024) {
      return t('musicStudio.upload.size.kilobytes', {size: (bytes / 1024).toFixed(1)});
    }
    return t('musicStudio.upload.size.megabytes', {
      size: (bytes / 1024 / 1024).toFixed(1),
    });
  };

  useEffect(() => {
    if (!value.file || typeof URL.createObjectURL !== 'function') {
      setPreviewUrl(null);
      return undefined;
    }

    const objectUrl = URL.createObjectURL(value.file);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [value.file]);

  useEffect(() => {
    const audio = previewAudioRef.current;
    return () => audio?.pause();
  }, [previewUrl]);

  const openFilePicker = () => {
    if (!effectiveDisabled) inputRef.current?.click();
  };

  const selectFile = (file: File) => {
    const extension = getFileExtension(file.name);
    if (!supportedFormats.includes(extension)) {
      setError({
        key: 'musicStudio.upload.errors.format',
        values: {formats: formattedFormats},
      });
      return;
    }
    if (file.size > capabilities.maxBytes) {
      setError({
        key: 'musicStudio.upload.errors.size',
        values: {maxSize: formatFileSize(capabilities.maxBytes)},
      });
      return;
    }

    setError(null);
    onChange({
      ...value,
      durationSeconds: null,
      edited: false,
      file,
      originalFile: file,
      status: 'checking',
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    openFilePicker();
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (effectiveDisabled) return;
    const file = event.dataTransfer.files[0];
    if (file) selectFile(file);
  };

  const removeFile = () => {
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
    onChange({
      ...value,
      durationSeconds: null,
      edited: false,
      file: null,
      originalFile: null,
      status: 'empty',
    });
  };

  const duration = formatDuration(value.durationSeconds);
  return (
    <section className="music-upload" aria-labelledby={headingId}>
      <div className="music-upload__heading">
        <div>
          <h2 id={headingId}>{t('musicStudio.upload.title')}</h2>
          <p>{t('musicStudio.upload.helper')}</p>
        </div>
      </div>

      <input
        ref={inputRef}
        hidden
        aria-label={t('musicStudio.upload.fileInputLabel')}
        className="music-upload__input"
        type="file"
        accept={accept}
        disabled={effectiveDisabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) selectFile(file);
        }}
      />

      <div className="music-upload__fields">
        <label className="music-upload__field">
          <span>{t('musicStudio.upload.titleLabel')}</span>
          <Input
            maxLength={TITLE_MAX_LENGTH}
            placeholder={t('musicStudio.upload.titlePlaceholder')}
            value={value.title}
            disabled={effectiveDisabled}
            onChange={(event) => onChange({...value, title: event.target.value})}
          />
        </label>
        <label className="music-upload__field">
          <span>{t('musicStudio.upload.descriptionLabel')}</span>
          <Input.TextArea
            maxLength={DESCRIPTION_MAX_LENGTH}
            placeholder={t('musicStudio.upload.descriptionPlaceholder')}
            value={value.description}
            disabled={effectiveDisabled}
            onChange={(event) => onChange({...value, description: event.target.value})}
          />
        </label>
      </div>

      {!value.file && (
        <div
          role="button"
          aria-disabled={effectiveDisabled}
          aria-label={t('musicStudio.upload.dropzoneLabel')}
          className={`music-upload__dropzone${dragging ? ' music-upload__dropzone--dragging' : ''}`}
          tabIndex={effectiveDisabled ? -1 : 0}
          onClick={openFilePicker}
          onDragEnter={(event) => {
            event.preventDefault();
            if (!effectiveDisabled) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
          onKeyDown={handleKeyDown}
        >
          <UploadOutlined aria-hidden="true" className="music-upload__dropzone-icon" />
          <strong>{t('musicStudio.upload.dropzoneTitle')}</strong>
          <span>{t('musicStudio.upload.dropzoneHint')}</span>
          <span className="music-upload__limits">
            {t('musicStudio.upload.limits', {
              formats: formattedFormats,
              maxSize: formatFileSize(capabilities.maxBytes),
            })}
          </span>
        </div>
      )}

      {error && (
        <Alert
          showIcon
          className="music-upload__error"
          message={t(error.key, error.values)}
          type="error"
        />
      )}

      {value.file && (
        <div className="music-upload__preview">
          <dl className="music-upload__metadata">
            <div>
              <dt>{t('musicStudio.upload.meta.name')}</dt>
              <dd>
                {value.file.name}
                {' · '}
                {value.edited && <Tag color="#fbbf24" style={{ color: '#000000' }}>{t('musicStudio.upload.edited')}</Tag>}
              </dd>
            </div>
            <div>
              <dt>{t('musicStudio.upload.meta.format')}</dt>
              <dd>{getFileExtension(value.file.name).toUpperCase()}</dd>
            </div>
            <div>
              <dt>{t('musicStudio.upload.meta.size')}</dt>
              <dd>{formatFileSize(value.file.size)}</dd>
            </div>
            <div>
              <dt>{t('musicStudio.upload.meta.duration')}</dt>
              <dd>{duration ?? t('musicStudio.upload.durationUnknown')}</dd>
            </div>
          </dl>

          {previewUrl && (
            <audio
              ref={previewAudioRef}
              controls
              preload="metadata"
              aria-label={t('musicStudio.upload.previewLabel')}
              className="music-upload__audio"
              src={previewUrl}
              onLoadedMetadata={(event) => {
                const nextDuration = event.currentTarget.duration;
                if (!Number.isFinite(nextDuration) || nextDuration < 0) {
                  setError({key: 'musicStudio.upload.errors.metadata', values: {}});
                  onChange({...value, durationSeconds: null, status: 'invalid'});
                  return;
                }
                if (
                  nextDuration < capabilities.minSeconds
                  || nextDuration > capabilities.maxSeconds
                ) {
                  setError({
                    key: 'musicStudio.upload.errors.duration',
                    values: {
                      max: String(capabilities.maxSeconds),
                      min: String(capabilities.minSeconds),
                    },
                  });
                  onChange({...value, durationSeconds: null, status: 'invalid'});
                  return;
                }
                setError(null);
                onChange({
                  ...value,
                  durationSeconds: nextDuration,
                  status: 'ready',
                });
              }}
              onError={() => {
                setError({key: 'musicStudio.upload.errors.metadata', values: {}});
                onChange({...value, durationSeconds: null, status: 'invalid'});
              }}
              onPlay={(event) => onAudioPlay(event.currentTarget)}
            >
              {t('musicStudio.upload.playerUnsupported')}
            </audio>
          )}

          <div className="music-upload__actions">
            {onEdit && (value.status === 'checking' || value.status === 'ready') && (
              <Button
                aria-label={t(value.status === 'checking'
                  ? 'musicStudio.upload.editPreparing'
                  : 'musicStudio.upload.editAria', {name: value.file.name})}
                className="music-upload__edit"
                disabled={effectiveDisabled || value.status !== 'ready'}
                icon={<EditOutlined />}
                loading={value.status === 'checking'}
                onClick={onEdit}
              >
                {t('musicStudio.upload.edit')}
              </Button>
            )}
            <Button
              aria-label={t('musicStudio.upload.replace')}
              icon={<UploadOutlined />}
              disabled={effectiveDisabled}
              onClick={openFilePicker}
            >
              {t('musicStudio.upload.replace')}
            </Button>
            <Button
              danger
              aria-label={t('musicStudio.upload.remove')}
              icon={<DeleteOutlined />}
              disabled={effectiveDisabled}
              onClick={removeFile}
            >
              {t('musicStudio.upload.remove')}
            </Button>
          </div>
        </div>
      )}

    </section>
  );
}
