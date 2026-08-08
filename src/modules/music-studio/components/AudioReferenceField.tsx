import React, {useEffect, useRef, useState} from 'react';
import {Alert, Button, Checkbox, Spin} from 'antd';
import {DeleteOutlined, UploadOutlined} from '@ant-design/icons';
import {useTranslation} from 'react-i18next';

import {backendAssetUrl} from '../../../api/http';
import {musicApi} from '../api/musicApi';
import {musicErrorDescriptor} from '../errors';
import type {MusicCapabilities, MusicReferenceAsset} from '../types';

interface AudioReferenceFieldProps {
  capabilities: MusicCapabilities['audioReference'];
  disabled?: boolean;
  onChange: (asset: MusicReferenceAsset | null) => void;
  projectId: string;
  value: MusicReferenceAsset | null;
}

export default function AudioReferenceField({
  capabilities,
  disabled = false,
  onChange,
  projectId,
  value,
}: AudioReferenceFieldProps) {
  const {t} = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const controllerRef = useRef<AbortController>();
  const [file, setFile] = useState<File | null>(null);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const upload = async () => {
    if (!file || !rightsConfirmed) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setUploading(true);
    setError(null);
    try {
      const response = await musicApi.uploadReference(projectId, file, controller.signal);
      onChange(response.data);
      setFile(null);
    } catch (requestError: unknown) {
      if (!controller.signal.aborted) setError(musicErrorDescriptor(requestError).message);
    } finally {
      if (!controller.signal.aborted) setUploading(false);
    }
  };

  const remove = async () => {
    if (!value) {
      setFile(null);
      return;
    }
    setUploading(true);
    setError(null);
    try {
      await musicApi.deleteReference(projectId, value.assetId);
      onChange(null);
      setRightsConfirmed(false);
    } catch (requestError: unknown) {
      setError(musicErrorDescriptor(requestError).message);
    } finally {
      setUploading(false);
    }
  };

  const accept = capabilities.formats.map((format) => `audio/${format}`).join(',');
  return (
    <section className="music-card" aria-labelledby="music-reference-title">
      <div className="music-section-heading">
        <div>
          <h2 id="music-reference-title">{t('musicStudio.reference.title')}</h2>
          <p>{t('musicStudio.reference.helper')}</p>
        </div>
        <span className="music-private-badge">{t('musicStudio.reference.private')}</span>
      </div>

      {value ? (
        <div className="music-reference__preview">
          <div>
            <strong>{value.name}</strong>
            <span>{Math.round(value.durationSeconds ?? 0)} {t('musicStudio.units.seconds')}</span>
          </div>
          <audio controls preload="metadata" src={backendAssetUrl(value.audioUrl)}>
            {t('musicStudio.player.unsupported')}
          </audio>
          <div className="music-reference__status">
            <span>{t(`musicStudio.reference.localStatus.${value.localVerificationStatus}`)}</span>
            <span>{t(`musicStudio.reference.moderationStatus.${value.providerModerationStatus}`)}</span>
          </div>
        </div>
      ) : (
        <>
          <input
            ref={inputRef}
            className="music-visually-hidden"
            type="file"
            accept={accept}
            disabled={disabled || uploading}
            onChange={(event) => {
              const nextFile = event.target.files?.[0] ?? null;
              setFile(nextFile);
              setError(null);
            }}
          />
          <Button
            icon={<UploadOutlined />}
            disabled={disabled || uploading}
            onClick={() => inputRef.current?.click()}
          >
            {file?.name || t('musicStudio.reference.choose')}
          </Button>
        </>
      )}

      <Checkbox
        checked={rightsConfirmed}
        disabled={disabled || uploading || Boolean(value)}
        onChange={(event) => setRightsConfirmed(event.target.checked)}
      >
        {t('musicStudio.reference.rights')}
      </Checkbox>
      <p className="music-field-hint">
        {t('musicStudio.reference.limits', {
          formats: capabilities.formats.join(', ').toUpperCase(),
          maxMb: Math.round(capabilities.maxBytes / 1024 / 1024),
        })}
      </p>

      {uploading && <Spin size="small" tip={t('musicStudio.reference.checking')} />}
      {error && <Alert type="error" showIcon message={error} />}
      <div className="music-inline-actions">
        {!value && (
          <Button
            type="primary"
            disabled={!file || !rightsConfirmed || disabled}
            loading={uploading}
            onClick={() => void upload()}
          >
            {t('musicStudio.reference.upload')}
          </Button>
        )}
        {(file || value) && (
          <Button
            danger
            icon={<DeleteOutlined />}
            disabled={disabled}
            loading={uploading}
            onClick={() => void remove()}
          >
            {t('musicStudio.reference.remove')}
          </Button>
        )}
      </div>
    </section>
  );
}
