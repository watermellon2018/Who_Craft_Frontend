import React, {useRef, useState} from 'react';
import {Button, Input, Modal, message} from 'antd';
import {useTranslation} from 'react-i18next';
import {CharacterReference, ReferenceType} from '../../types/character.types';
import {REFERENCE_LABEL_KEYS} from './referenceLabels';

const ACCEPTED_MIME = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

// --- Correction modal --------------------------------------------------------

export const ReferenceCorrectionModal: React.FC<{
  open: boolean;
  reference: CharacterReference;
  onCancel: () => void;
  onSubmit: (prompt: string) => Promise<void>;
}> = ({open, reference, onCancel, onSubmit}) => {
  const {t} = useTranslation();
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    if (!open) setValue('');
  }, [open]);

  const handleSubmit = async () => {
    const prompt = value.trim();
    if (!prompt) {
      message.warning(t('characterStudio.references.correctionWarning'));
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(prompt);
      onCancel();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title={(
        <div>
          <div style={{fontWeight: 800}}>{t('characterStudio.references.correctionTitle')}</div>
          <div style={{marginTop: 4, fontSize: 12, color: '#8f98a7', fontWeight: 600}}>
            {t(REFERENCE_LABEL_KEYS[reference.reference_type].title)}
          </div>
        </div>
      )}
      onCancel={onCancel}
      destroyOnClose
      centered
      footer={[
        <Button
          key="cancel"
          className="character-editor-button character-editor-button--outline"
          onClick={onCancel}
          disabled={submitting}
        >
          {t('characterStudio.editor.cancelButton')}
        </Button>,
        <Button
          key="submit"
          className="character-editor-button character-editor-button--primary"
          loading={submitting}
          onClick={handleSubmit}
        >
          {t('characterStudio.references.generateCorrection')}
        </Button>,
      ]}
    >
      <p style={{marginTop: 0, color: '#8f98a7'}}>
        {t('characterStudio.references.correctionHint')}
      </p>
      <Input.TextArea
        autoFocus
        rows={4}
        value={value}
        maxLength={500}
        onChange={(event) => setValue(event.target.value)}
        placeholder={t('characterStudio.references.correctionPlaceholder')}
      />
    </Modal>
  );
};

// --- Upload modal ------------------------------------------------------------

export const ReferenceUploadModal: React.FC<{
  open: boolean;
  referenceType: ReferenceType;
  onCancel: () => void;
  onUpload: (file: File) => Promise<unknown>;
}> = ({open, referenceType, onCancel, onUpload}) => {
  const {t} = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  React.useEffect(() => {
    if (open) return;
    setFile(null);
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  }, [open]);

  const acceptFile = (candidate: File | undefined | null) => {
    if (!candidate) return;
    if (!ACCEPTED_MIME.includes(candidate.type)) {
      message.error(t('characterStudio.references.uploadFormatError'));
      return;
    }
    if (candidate.size > 10 * 1024 * 1024) {
      message.error(t('characterStudio.references.uploadSizeError'));
      return;
    }
    setFile(candidate);
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(candidate);
    });
  };

  const handleSubmit = async () => {
    if (!file) {
      message.warning(t('characterStudio.references.uploadEmpty'));
      return;
    }
    setSubmitting(true);
    try {
      await onUpload(file);
      onCancel();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title={t('characterStudio.references.uploadTitle', {label: t(REFERENCE_LABEL_KEYS[referenceType].title)})}
      onCancel={onCancel}
      destroyOnClose
      centered
      footer={[
        <Button
          key="cancel"
          className="character-editor-button character-editor-button--outline"
          onClick={onCancel}
          disabled={submitting}
        >
          {t('characterStudio.editor.cancelButton')}
        </Button>,
        <Button
          key="submit"
          className="character-editor-button character-editor-button--primary"
          loading={submitting}
          disabled={!file}
          onClick={handleSubmit}
        >
          {t('characterStudio.references.replaceButton')}
        </Button>,
      ]}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_MIME.join(',')}
        style={{display: 'none'}}
        onChange={(event) => {
          const candidate = event.target.files?.[0];
          acceptFile(candidate);
          event.target.value = '';
        }}
      />
      <div
        className={`references-drop ${dragOver ? 'references-drop--active' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          acceptFile(event.dataTransfer.files?.[0]);
        }}
      >
        {previewUrl ? (
          <img src={previewUrl} alt={t('characterStudio.references.previewAlt')} className="references-drop__preview" />
        ) : (
          <div className="references-drop__hint">
            {t('characterStudio.references.uploadHint')}<br />
            {t('characterStudio.references.uploadFormats')}
          </div>
        )}
      </div>
    </Modal>
  );
};

// --- Compare modal -----------------------------------------------------------

export const CompareReferenceModal: React.FC<{
  open: boolean;
  primary: CharacterReference | null;
  selected: CharacterReference;
  onCancel: () => void;
}> = ({open, primary, selected, onCancel}) => {
  const {t} = useTranslation();
  return (
    <Modal
      open={open}
      title={t('characterStudio.references.compareTitle')}
      onCancel={onCancel}
      destroyOnClose
      centered
      width={920}
      footer={[
        <Button
          key="ok"
          className="character-editor-button character-editor-button--primary"
          onClick={onCancel}
        >
          {t('characterStudio.references.fullscreenClose')}
        </Button>,
      ]}
    >
      <div className="references-compare">
        <div className="references-compare__pane">
          <div className="references-compare__caption">{t('characterStudio.references.primaryLabel')}</div>
          {primary?.image_url ? (
            <img src={primary.image_url} alt={t('characterStudio.references.primaryLabel')} />
          ) : (
            <div className="references-compare__empty">{t('characterStudio.references.primaryEmpty')}</div>
          )}
        </div>
        <div className="references-compare__pane">
          <div className="references-compare__caption">
            {t('characterStudio.references.selectedLabel', {label: t(REFERENCE_LABEL_KEYS[selected.reference_type].title)})}
          </div>
          {selected.image_url ? (
            <img src={selected.image_url} alt={t('characterStudio.references.selectedAlt')} />
          ) : (
            <div className="references-compare__empty">{t('characterStudio.references.imageNotReady')}</div>
          )}
        </div>
      </div>
    </Modal>
  );
};

// --- Fullscreen image modal --------------------------------------------------

export const FullscreenReferenceModal: React.FC<{
  open: boolean;
  reference: CharacterReference;
  onCancel: () => void;
}> = ({open, reference, onCancel}) => {
  const {t} = useTranslation();
  // Cap by the viewport so the image always fits without page scrolling:
  //   - 100vw minus modal horizontal padding for width
  //   - 100vh minus header / footer / padding for height
  // `object-fit: contain` keeps the aspect ratio intact.
  return (
    <Modal
      open={open}
      onCancel={onCancel}
      destroyOnClose
      centered
      width="auto"
      footer={null}
      title={t(REFERENCE_LABEL_KEYS[reference.reference_type].title)}
      styles={{
        body: {
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          maxHeight: 'calc(100vh - 160px)',
          maxWidth: 'calc(100vw - 80px)',
        },
        content: {maxHeight: '100vh'},
      }}
    >
      {reference.image_url ? (
        <img
          src={reference.image_url}
          alt={t(REFERENCE_LABEL_KEYS[reference.reference_type].title)}
          style={{
            display: 'block',
            maxWidth: 'calc(100vw - 80px)',
            maxHeight: 'calc(100vh - 160px)',
            width: 'auto',
            height: 'auto',
            objectFit: 'contain',
            borderRadius: 12,
          }}
        />
      ) : (
        <div style={{padding: 40, textAlign: 'center', color: '#8f98a7'}}>
          {t('characterStudio.references.imageNotReady')}
        </div>
      )}
    </Modal>
  );
};
