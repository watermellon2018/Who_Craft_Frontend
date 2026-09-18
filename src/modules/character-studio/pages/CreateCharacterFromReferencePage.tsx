import React, {useEffect, useMemo, useRef, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {Button, Input, Select, message} from 'antd';
import {useTranslation} from 'react-i18next';
import {
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  IdcardOutlined,
  SafetyCertificateOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import CharacterCreateHeader from '../components/create/CharacterCreateHeader';
import GenerationSettingsPanel, {defaultGenerationOptions} from '../components/create/GenerationSettingsPanel';
import type {GenerationOptions} from '../components/create/GenerationSettingsPanel';
import VisualStyleSelector from '../components/create/VisualStyleSelector';
import type {VisualStyleValue} from '../components/create/VisualStyleSelector';
import {getCharacterTypeOptions, getGenderApplicabilityOptions, getRoleOptions} from '../components/create/characterCreateOptions';
import {characterApi} from '../api/characterApi';
import {characterVariantsPath} from '../../../routes/pathConstant';
import {useProjectIdFromRoute} from '../hooks/useProjectIdFromRoute';
import './CharacterCreatePage.css';
import './CreateCharacterFromReferencePage.css';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png'];

const tipKeys = ['clearFace', 'avoidBlur', 'portraitOrFullBody', 'preserveFace', 'editAfter'] as const;

type CharacterTypeValue = 'human' | 'animal' | 'creature' | 'robot' | 'object' | 'other';
type GenderValue = 'female' | 'male' | 'other';
type CharacterStyle = VisualStyleValue;

interface ReferenceUploadCardProps {
  file: File | null;
  previewUrl: string;
  onFileSelect: (file: File) => void;
  onRemove: () => void;
}

interface IdentityInfoPanelProps {
  preserveIdentity: boolean;
}

interface OptionalRefinementBoxProps {
  value: string;
  onChange: (value: string) => void;
}

interface ReferenceParametersCardProps {
  name: string;
  characterType: CharacterTypeValue;
  lifecycleStage: string;
  gender?: GenderValue;
  role: string;
  preserveIdentity: boolean;
  showNameError: boolean;
  onNameChange: (value: string) => void;
  onNameBlur: () => void;
  onCharacterTypeChange: (value: CharacterTypeValue) => void;
  onLifecycleStageChange: (value: string) => void;
  onGenderChange: (value?: GenderValue) => void;
  onRoleChange: (value: string) => void;
  onPreserveIdentityChange: (checked: boolean) => void;
}

interface FormFieldProps {
  children: React.ReactNode;
  error?: string;
  htmlFor: string;
  label: string;
  required?: boolean;
}

interface TextInputWithCounterProps {
  error?: boolean;
  id: string;
  maxLength: number;
  placeholder: string;
  value: string;
  onBlur?: () => void;
  onChange: (value: string) => void;
}

interface SelectFieldProps {
  id: string;
  options: Array<{value: string; label: string}>;
  placeholder: string;
  value?: string;
  onChange: (value?: string) => void;
}

interface ToggleOptionProps {
  checked: boolean;
  description: string;
  title: string;
  onChange: (checked: boolean) => void;
}

export default function CreateCharacterFromReferencePage() {
  const {t} = useTranslation();
  return (
    <div className="character-create-page">
      <div className="character-create-page__inner">
        <CharacterCreateHeader
          activeMode="reference"
          subtitle={t('characterStudio.referenceCreate.subtitle')}
        />
        <div className="character-create-content">
          <CreateCharacterFromReferenceContent />
        </div>
      </div>
    </div>
  );
}

export function CreateCharacterFromReferenceContent() {
  const {t} = useTranslation();
  const projectId = useProjectIdFromRoute();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [name, setName] = useState('');
  const [characterType, setCharacterType] = useState<CharacterTypeValue>('human');
  const [lifecycleStage, setLifecycleStage] = useState('');
  const [gender, setGender] = useState<GenderValue | undefined>();
  const [role, setRole] = useState('main');
  const [preserveIdentity, setPreserveIdentity] = useState(true);
  const [style, setStyle] = useState<CharacterStyle>('cinematic_realism');
  const [refinement, setRefinement] = useState('');
  const [generationOptions, setGenerationOptions] = useState<GenerationOptions>(defaultGenerationOptions);
  const [nameTouched, setNameTouched] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreviewUrl('');
      return undefined;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  const canGenerate = useMemo(() => Boolean(file && name.trim() && characterType), [characterType, file, name]);
  const showNameError = !name.trim() && (nameTouched || submitAttempted);

  const handleFileSelect = (nextFile: File) => {
    if (!ACCEPTED_IMAGE_TYPES.includes(nextFile.type)) {
      message.warning(t('characterStudio.referenceCreate.fileFormatError'));
      return;
    }

    if (nextFile.size > MAX_FILE_SIZE) {
      message.warning(t('characterStudio.referenceCreate.fileSizeError'));
      return;
    }

    setFile(nextFile);
  };

  const handleGenerate = async () => {
    if (!canGenerate || !file) {
      setSubmitAttempted(true);
      return;
    }
    if (!projectId) {
      message.error(t('characterStudio.referenceCreate.projectMissing'));
      return;
    }
    try {
      setIsGenerating(true);
      const response = await characterApi.createFromReference(projectId, {
        name: name.trim(),
        entityType: characterType,
        role,
        lifecycleStage,
        gender,
        visualStyle: style,
        refinement,
        variantsCount: generationOptions.count,
        preserveIdentity,
        imageModel: generationOptions.imageModel,
        referenceImage: file,
      });
      const {character, generation_job: job} = response.data;
      if (job?.status === 'failed') {
        message.error(job.error_message || t('characterStudio.referenceCreate.variantsFailed'));
        return;
      }
      if (!job?.job_id) {
        message.error(t('characterStudio.referenceCreate.jobIdMissing'));
        return;
      }
      message.success(t('characterStudio.referenceCreate.started'));
      navigate(characterVariantsPath(projectId, character.character_id, job.job_id), {
        state: {
          characterName: character.name,
          generationOptions,
        },
      });
    } catch (error) {
      const data = (error as {response?: {data?: {message?: string}}})?.response?.data;
      message.error(data?.message || t('characterStudio.referenceCreate.createFailed'));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="character-reference-layout">
      <div className="character-reference-main">
        <ReferenceUploadCard
          file={file}
          previewUrl={previewUrl}
          onFileSelect={handleFileSelect}
          onRemove={() => setFile(null)}
        />

        <ReferenceParametersCard
          name={name}
          characterType={characterType}
          lifecycleStage={lifecycleStage}
          gender={gender}
          role={role}
          preserveIdentity={preserveIdentity}
          showNameError={showNameError}
          onNameChange={setName}
          onNameBlur={() => setNameTouched(true)}
          onCharacterTypeChange={setCharacterType}
          onLifecycleStageChange={setLifecycleStage}
          onGenderChange={setGender}
          onRoleChange={setRole}
          onPreserveIdentityChange={setPreserveIdentity}
        />

        <VisualStyleSelector value={style} onChange={setStyle} />
        <OptionalRefinementBox value={refinement} onChange={setRefinement} />

        <div className="character-create-actions">
          <div>
            <Button
              className="character-create-button character-create-button--primary"
              htmlType="button"
              disabled={!canGenerate || isGenerating}
              loading={isGenerating}
              onClick={handleGenerate}
            >
              {isGenerating
                ? t('characterStudio.referenceCreate.creating')
                : t('characterStudio.referenceCreate.generate')}
            </Button>
          </div>
          <p>{t('characterStudio.referenceCreate.afterGeneration')}</p>
        </div>
      </div>

      <aside className="character-reference-side">
        <GenerationSettingsPanel
          operation="reference"
          projectId={projectId}
          value={generationOptions}
          onChange={setGenerationOptions}
        />
        <IdentityInfoPanel preserveIdentity={preserveIdentity} />
        <TipsPanel />
      </aside>
    </div>
  );
}

function ReferenceUploadCard({file, previewUrl, onFileSelect, onRemove}: ReferenceUploadCardProps) {
  const {t} = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const openFileDialog = () => {
    inputRef.current?.click();
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0];
    if (nextFile) {
      onFileSelect(nextFile);
    }
    event.target.value = '';
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);

    const nextFile = event.dataTransfer.files?.[0];
    if (nextFile) {
      onFileSelect(nextFile);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openFileDialog();
    }
  };

  return (
    <section className="character-create-section">
      <div className="character-create-section__header">
        <span className="character-create-section__icon">
          <UploadOutlined />
        </span>
        <div>
          <h2>{t('characterStudio.referenceCreate.upload.title')}</h2>
          <p>{t('characterStudio.referenceCreate.upload.subtitle')}</p>
        </div>
      </div>

      <div className="character-create-section__content">
        <input
          ref={inputRef}
          className="reference-upload-input"
          type="file"
          accept="image/jpeg,image/png"
          onChange={handleFileInputChange}
        />

        <div
          className={`reference-upload-dropzone ${dragging ? 'reference-upload-dropzone--dragging' : ''} ${
            previewUrl ? 'reference-upload-dropzone--filled' : ''
          }`}
          role="button"
          tabIndex={0}
          aria-label={t('characterStudio.referenceCreate.upload.ariaLabel')}
          onClick={openFileDialog}
          onKeyDown={handleKeyDown}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          {previewUrl ? (
            <>
              <img className="reference-upload-dropzone__image" src={previewUrl} alt={file?.name || t('characterStudio.referenceCreate.upload.previewAlt')} />
              <div className="reference-upload-dropzone__actions">
                <Button
                  className="reference-upload-action"
                  htmlType="button"
                  icon={<UploadOutlined />}
                  onClick={(event) => {
                    event.stopPropagation();
                    openFileDialog();
                  }}
                >
                  {t('characterStudio.referenceCreate.upload.replace')}
                </Button>
                <Button
                  className="reference-upload-action"
                  htmlType="button"
                  icon={<DeleteOutlined />}
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemove();
                  }}
                >
                  {t('characterStudio.referenceCreate.upload.remove')}
                </Button>
              </div>
            </>
          ) : (
            <div className="reference-upload-empty">
              <span className="reference-upload-empty__icon">
                <UploadOutlined />
              </span>
              <strong>{t('characterStudio.referenceCreate.upload.dropTitle')}</strong>
              <span>{t('characterStudio.referenceCreate.upload.dropHint')}</span>
              <small>{t('characterStudio.referenceCreate.upload.formats')}</small>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ReferenceParametersCard({
  name,
  characterType,
  lifecycleStage,
  gender,
  role,
  preserveIdentity,
  showNameError,
  onNameChange,
  onNameBlur,
  onCharacterTypeChange,
  onLifecycleStageChange,
  onGenderChange,
  onRoleChange,
  onPreserveIdentityChange,
}: ReferenceParametersCardProps) {
  const {t} = useTranslation();
  return (
    <section className="reference-parameters-card">
      <div className="reference-parameters-card__header">
        <span className="reference-parameters-card__icon">
          <IdcardOutlined />
        </span>
        <div>
          <h2>{t('characterStudio.referenceCreate.parameters.title')}</h2>
          <p>{t('characterStudio.referenceCreate.parameters.subtitle')}</p>
        </div>
      </div>

      <div className="reference-parameters-card__body">
        <FormField
          htmlFor="reference-character-name"
          label={t('characterStudio.create.basicInfo.name')}
          required
          error={showNameError ? t('characterStudio.create.basicInfo.nameRequired') : undefined}
        >
          <TextInputWithCounter
            id="reference-character-name"
            value={name}
            maxLength={80}
            placeholder={t('characterStudio.create.basicInfo.namePlaceholder')}
            error={showNameError}
            onBlur={onNameBlur}
            onChange={onNameChange}
          />
        </FormField>

        <div className="reference-parameters-grid reference-parameters-grid--two">
          <FormField htmlFor="reference-character-type" label={t('characterStudio.create.basicInfo.type')} required>
            <SelectField
              id="reference-character-type"
              value={characterType}
              placeholder={t('characterStudio.create.basicInfo.typePlaceholder')}
              options={getCharacterTypeOptions(t)}
              onChange={(value) => onCharacterTypeChange((value || 'human') as CharacterTypeValue)}
            />
          </FormField>

          <FormField htmlFor="reference-character-role" label={t('characterStudio.create.basicInfo.role')}>
            <SelectField
              id="reference-character-role"
              value={role}
              placeholder={t('characterStudio.create.basicInfo.rolePlaceholder')}
              options={getRoleOptions(t)}
              onChange={(value) => onRoleChange(value ?? 'main')}
            />
          </FormField>
        </div>

        <div className="reference-parameters-grid reference-parameters-grid--two">
          <FormField htmlFor="reference-character-lifecycle-stage" label={t('characterStudio.referenceCreate.parameters.lifecycle')}>
            <Input
              id="reference-character-lifecycle-stage"
              className="reference-form-control"
              value={lifecycleStage}
              maxLength={128}
              placeholder={t('characterStudio.referenceCreate.parameters.lifecyclePlaceholder')}
              onChange={(event) => onLifecycleStageChange(event.target.value)}
            />
          </FormField>

          <FormField htmlFor="reference-character-gender" label={t('characterStudio.create.basicInfo.gender')}>
            <SelectField
              id="reference-character-gender"
              value={gender}
              placeholder={t('characterStudio.create.basicInfo.genderPlaceholder')}
              options={getGenderApplicabilityOptions(t)}
              onChange={(value) => onGenderChange(value as GenderValue | undefined)}
            />
          </FormField>
        </div>

        <div className="reference-toggle-options">
          <ToggleOption
            checked={preserveIdentity}
            title={t('characterStudio.referenceCreate.parameters.identityTitle')}
            description={t('characterStudio.referenceCreate.parameters.identityDescription')}
            onChange={onPreserveIdentityChange}
          />
        </div>
      </div>
    </section>
  );
}

function FormField({children, error, htmlFor, label, required}: FormFieldProps) {
  return (
    <div className="reference-form-field">
      <label className="reference-form-field__label" htmlFor={htmlFor}>
        {label}
        {required && <span aria-hidden="true">*</span>}
      </label>
      {children}
      {error && <p className="reference-form-field__error">{error}</p>}
    </div>
  );
}

function TextInputWithCounter({
  error,
  id,
  maxLength,
  placeholder,
  value,
  onBlur,
  onChange,
}: TextInputWithCounterProps) {
  return (
    <div className={`reference-text-counter-input ${error ? 'reference-text-counter-input--error' : ''}`}>
      <Input
        id={id}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onBlur={onBlur}
        onChange={(event) => onChange(event.target.value)}
      />
      <span className="reference-text-counter-input__counter">
        {value.length} / {maxLength}
      </span>
    </div>
  );
}

function SelectField({id, options, placeholder, value, onChange}: SelectFieldProps) {
  return (
    <Select<string>
      id={id}
      className="reference-form-control reference-form-control--select"
      allowClear
      value={value}
      placeholder={placeholder}
      options={options.map((option) => ({...option}))}
      onChange={(nextValue) => onChange(nextValue)}
      popupClassName="character-studio-dropdown"
    />
  );
}

function ToggleOption({checked, title, description, onChange}: ToggleOptionProps) {
  return (
    <button
      className={`reference-toggle-option ${checked ? 'reference-toggle-option--checked' : ''}`}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={title}
      onClick={() => onChange(!checked)}
    >
      <span className="reference-toggle-option__switch" aria-hidden="true">
        <span />
      </span>
      <span className="reference-toggle-option__copy">
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
    </button>
  );
}

function OptionalRefinementBox({value, onChange}: OptionalRefinementBoxProps) {
  const {t} = useTranslation();
  return (
    <section className="character-create-section reference-refinement-section">
      <div className="character-create-section__header">
        <span className="character-create-section__icon">
          <EditOutlined />
        </span>
        <div>
          <h2>{t('characterStudio.referenceCreate.refinement.title')}</h2>
        </div>
      </div>

      <div className="reference-refinement-field">
        <Input.TextArea
          className="reference-refinement-textarea"
          value={value}
          rows={4}
          maxLength={300}
          placeholder={t('characterStudio.referenceCreate.refinement.placeholder')}
          onChange={(event) => onChange(event.target.value)}
        />
        <div className="reference-refinement-counter">
          {value.length} / 300
        </div>
      </div>
    </section>
  );
}

function IdentityInfoPanel({preserveIdentity}: IdentityInfoPanelProps) {
  const {t} = useTranslation();
  return (
    <section className="create-side-card">
      <div className="create-side-card__header">
        <h2>{t('characterStudio.referenceCreate.identity.title')}</h2>
      </div>

      <div className="identity-info-copy">
        <SafetyCertificateOutlined />
        <p>
          {t('characterStudio.referenceCreate.identity.description')}
        </p>
      </div>

      {!preserveIdentity && (
        <div className="identity-warning" role="alert">
          <ExclamationCircleOutlined />
          <span>{t('characterStudio.referenceCreate.identity.warning')}</span>
        </div>
      )}
    </section>
  );
}

function TipsPanel() {
  const {t} = useTranslation();
  return (
    <section className="create-side-card">
      <div className="create-side-card__header">
        <h2>{t('characterStudio.referenceCreate.tips.title')}</h2>
      </div>

      <ul className="tips-list">
        {tipKeys.map((key) => (
          <li key={key}>
            <CheckCircleOutlined />
            <span>{t(`characterStudio.referenceCreate.tips.${key}`)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
