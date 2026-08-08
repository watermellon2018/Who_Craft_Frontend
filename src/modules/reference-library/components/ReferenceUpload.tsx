import React, {useState} from 'react';
import {Button, Checkbox} from 'antd';
import {UploadOutlined} from '@ant-design/icons';
import {useTranslation} from 'react-i18next';

interface ReferenceUploadProps {
  accept: string;
  disabled?: boolean;
  loading?: boolean;
  maxBytes: number;
  onUpload: (file: File) => void;
}

export default function ReferenceUpload({
  accept,
  disabled = false,
  loading = false,
  maxBytes,
  onUpload,
}: ReferenceUploadProps) {
  const {t} = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const maxMb = Math.round(maxBytes / 1024 / 1024);

  return (
    <section className="reference-card-panel reference-upload">
      <div className="reference-section-heading">
        <div>
          <h2>{t('referenceLibrary.upload.title')}</h2>
          <p>{t('referenceLibrary.upload.helper', {maxMb})}</p>
        </div>
      </div>
      <label className="reference-upload__picker">
        <UploadOutlined aria-hidden="true" />
        <span>{file?.name ?? t('referenceLibrary.upload.choose')}</span>
        <input
          type="file"
          accept={accept}
          disabled={disabled || loading}
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
      </label>
      <Checkbox
        checked={rightsConfirmed}
        disabled={disabled || loading}
        onChange={(event) => setRightsConfirmed(event.target.checked)}
      >
        {t('referenceLibrary.upload.rights')}
      </Checkbox>
      <Button
        type="primary"
        icon={<UploadOutlined />}
        disabled={disabled || !file || !rightsConfirmed}
        loading={loading}
        onClick={() => file && onUpload(file)}
      >
        {t('referenceLibrary.upload.action')}
      </Button>
    </section>
  );
}
