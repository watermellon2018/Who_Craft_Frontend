import React, {useEffect, useId, useRef, useState} from 'react';
import type {DragEvent, KeyboardEvent} from 'react';
import {DeleteOutlined, UploadOutlined} from '@ant-design/icons';
import {Alert, Button, Spin} from 'antd';
import {useTranslation} from 'react-i18next';

import {backendAssetUrl} from '../../../api/http';
import {musicApi} from '../api/musicApi';
import {musicErrorDescriptor} from '../errors';
import type {MusicCapabilities, MusicReferenceAsset} from '../types';
import AudioPlayer from './AudioPlayer';

interface AudioReferenceFieldProps {
  capabilities: MusicCapabilities['audioReference'];
  disabled?: boolean;
  onAudioPlay: (audio: HTMLAudioElement) => void;
  onChange: (asset: MusicReferenceAsset | null) => void;
  projectId: string;
  value: MusicReferenceAsset | null;
}

interface ClientValidationError {
  key: 'musicStudio.upload.errors.format' | 'musicStudio.upload.errors.size';
  values: Record<string, string>;
}

function normalizeFormat(format: string) {
  return format.trim().toLowerCase().replace(/^\./, '');
}

function getFileExtension(fileName: string) {
  const separatorIndex = fileName.lastIndexOf('.');
  return separatorIndex >= 0 ? fileName.slice(separatorIndex + 1).toLowerCase() : '';
}

export default function AudioReferenceField({
  capabilities,
  disabled = false,
  onAudioPlay,
  onChange,
  projectId,
  value,
}: AudioReferenceFieldProps) {
  const {t} = useTranslation();
  const headingId = useId();
  const attestationId = `${headingId}-attestation`;
  const inputRef = useRef<HTMLInputElement>(null);
  const controllerRef = useRef<AbortController>();
  const mountedRef = useRef(true);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [clientError, setClientError] = useState<ClientValidationError | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  const supportedFormats = capabilities.formats.map(normalizeFormat).filter(Boolean);
  const formattedFormats = supportedFormats.map((format) => format.toUpperCase()).join(', ');
  const accept = supportedFormats.map((format) => `.${format}`).join(',');
  const effectiveDisabled = disabled || uploading;

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return t('musicStudio.upload.size.bytes', {size: bytes});
    if (bytes < 1024 * 1024) {
      return t('musicStudio.upload.size.kilobytes', {size: (bytes / 1024).toFixed(1)});
    }
    return t('musicStudio.upload.size.megabytes', {
      size: (bytes / 1024 / 1024).toFixed(1),
    });
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, []);

  const upload = async (file: File) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setUploading(true);
    setClientError(null);
    setRequestError(null);

    try {
      const response = await musicApi.uploadReference(projectId, file, controller.signal);
      if (!controller.signal.aborted && mountedRef.current) onChange(response.data);
    } catch (error: unknown) {
      if (!controller.signal.aborted && mountedRef.current) {
        setRequestError(musicErrorDescriptor(error).message);
      }
    } finally {
      if (controllerRef.current === controller) controllerRef.current = undefined;
      if (!controller.signal.aborted && mountedRef.current) setUploading(false);
    }
  };

  const selectFile = (file: File) => {
    const extension = getFileExtension(file.name);
    if (!supportedFormats.includes(extension)) {
      setRequestError(null);
      setClientError({
        key: 'musicStudio.upload.errors.format',
        values: {formats: formattedFormats},
      });
      return;
    }
    if (file.size > capabilities.maxBytes) {
      setRequestError(null);
      setClientError({
        key: 'musicStudio.upload.errors.size',
        values: {maxSize: formatFileSize(capabilities.maxBytes)},
      });
      return;
    }

    void upload(file);
  };

  const openFilePicker = () => {
    if (!effectiveDisabled) inputRef.current?.click();
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

  const remove = async () => {
    if (!value) return;
    setUploading(true);
    setClientError(null);
    setRequestError(null);
    try {
      await musicApi.deleteReference(projectId, value.assetId);
      if (mountedRef.current) onChange(null);
    } catch (error: unknown) {
      if (mountedRef.current) setRequestError(musicErrorDescriptor(error).message);
    } finally {
      if (mountedRef.current) setUploading(false);
    }
  };

  const errorMessage = clientError ? t(clientError.key, clientError.values) : requestError;

  return (
    <section className="music-card" aria-labelledby={headingId}>
      <div className="music-section-heading">
        <div>
          <h2 id={headingId}>{t('musicStudio.reference.title')}</h2>
          <p>{t('musicStudio.reference.helper')}</p>
        </div>
      </div>

      <input
        ref={inputRef}
        hidden
        aria-label={t('musicStudio.reference.choose')}
        className="music-reference__input"
        type="file"
        accept={accept}
        disabled={effectiveDisabled || Boolean(value)}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) selectFile(file);
        }}
      />

      {value ? (
        <div className="music-reference__preview">
          <strong>{value.name}</strong>
          <AudioPlayer
            durationSeconds={value.durationSeconds}
            label={t('musicStudio.player.reference', {title: value.name})}
            src={backendAssetUrl(value.audioUrl)}
            onPlay={onAudioPlay}
          />
          <Button
            danger
            aria-label={t('musicStudio.reference.remove')}
            icon={<DeleteOutlined />}
            disabled={effectiveDisabled}
            loading={uploading}
            onClick={() => void remove()}
          >
            {t('musicStudio.reference.remove')}
          </Button>
        </div>
      ) : (
        <div
          role="button"
          aria-describedby={attestationId}
          aria-disabled={effectiveDisabled}
          aria-label={t('musicStudio.reference.dropzoneLabel')}
          className={`music-reference__dropzone${
            dragging ? ' music-reference__dropzone--dragging' : ''
          }`}
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
          <UploadOutlined aria-hidden="true" className="music-reference__dropzone-icon" />
          <strong>{t('musicStudio.reference.dropzoneTitle')}</strong>
          <span className="music-reference__limits">
            {t('musicStudio.reference.limits', {
              formats: formattedFormats,
              maxMb: Math.round(capabilities.maxBytes / 1024 / 1024),
            })}
          </span>
          <small className="music-reference__attestation" id={attestationId}>
            {t('musicStudio.reference.rights')}
          </small>
          {uploading && (
            <span className="music-reference__uploading">
              <Spin size="small" />
              {t('musicStudio.reference.checking')}
            </span>
          )}
        </div>
      )}

      {errorMessage && (
        <Alert
          showIcon
          className="music-reference__error"
          message={errorMessage}
          type="error"
        />
      )}
    </section>
  );
}
