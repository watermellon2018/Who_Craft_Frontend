import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Button, Input, Select, message} from 'antd';
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
import GenerationSettingsPanel, {defaultGenerationOptions, GenerationOptions} from '../components/create/GenerationSettingsPanel';
import VisualStyleSelector, {VisualStyleValue} from '../components/create/VisualStyleSelector';
import {characterTypeOptions, genderApplicabilityOptions, roleOptions} from '../components/create/characterCreateOptions';
import './CharacterCreatePage.css';
import './CreateCharacterFromReferencePage.css';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png'];

const extractedFeatures = [
  {label: 'Форма лица', value: 'oval'},
  {label: 'Цвет кожи', value: 'fair'},
  {label: 'Цвет глаз', value: 'green'},
  {label: 'Волосы', value: 'brown long'},
  {label: 'Возраст (оценка)', value: '~20'},
];

const tips = [
  'Используйте фото с чётким лицом',
  'Избегайте размытых изображений',
  'Лучше работают портреты или фото в полный рост',
  'Система сохранит черты лица при генерации',
  'После генерации можно будет редактировать персонажа',
];

type CharacterTypeValue = 'human' | 'animal' | 'creature' | 'robot' | 'object' | 'other';
type GenderValue = 'female' | 'male' | 'other';
type CharacterStyle = VisualStyleValue;

interface ReferenceUploadCardProps {
  file: File | null;
  previewUrl: string;
  onFileSelect: (file: File) => void;
  onRemove: () => void;
}

interface ExtractedFeaturesPanelProps {
  visible: boolean;
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
  autoExtractFeatures: boolean;
  showNameError: boolean;
  onNameChange: (value: string) => void;
  onNameBlur: () => void;
  onCharacterTypeChange: (value: CharacterTypeValue) => void;
  onLifecycleStageChange: (value: string) => void;
  onGenderChange: (value?: GenderValue) => void;
  onRoleChange: (value: string) => void;
  onPreserveIdentityChange: (checked: boolean) => void;
  onAutoExtractFeaturesChange: (checked: boolean) => void;
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
  return (
    <div className="character-create-page">
      <div className="character-create-page__inner">
        <CharacterCreateHeader
          activeMode="reference"
          subtitle="Создайте персонажа на основе референс-изображения. Мы извлечём ключевые черты и сохраним идентичность."
        />
        <div className="character-create-content">
          <CreateCharacterFromReferenceContent />
        </div>
      </div>
    </div>
  );
}

export function CreateCharacterFromReferenceContent() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [name, setName] = useState('');
  const [characterType, setCharacterType] = useState<CharacterTypeValue>('human');
  const [lifecycleStage, setLifecycleStage] = useState('');
  const [gender, setGender] = useState<GenderValue | undefined>();
  const [role, setRole] = useState('main');
  const [preserveIdentity, setPreserveIdentity] = useState(true);
  const [autoExtractFeatures, setAutoExtractFeatures] = useState(true);
  const [style, setStyle] = useState<CharacterStyle>('cinematic_realism');
  const [refinement, setRefinement] = useState('');
  const [generationOptions, setGenerationOptions] = useState<GenerationOptions>(defaultGenerationOptions);
  const [nameTouched, setNameTouched] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);

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
      message.warning('Поддерживаются только JPG и PNG изображения');
      return;
    }

    if (nextFile.size > MAX_FILE_SIZE) {
      message.warning('Максимальный размер файла — 10MB');
      return;
    }

    setFile(nextFile);
  };

  const handleGenerate = () => {
    if (!canGenerate) {
      setSubmitAttempted(true);
      return;
    }

    message.info(`Генерация ${generationOptions.count} вариант(ов) по референсу будет подключена на этапе интеграции API`);
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
          autoExtractFeatures={autoExtractFeatures}
          showNameError={showNameError}
          onNameChange={setName}
          onNameBlur={() => setNameTouched(true)}
          onCharacterTypeChange={setCharacterType}
          onLifecycleStageChange={setLifecycleStage}
          onGenderChange={setGender}
          onRoleChange={setRole}
          onPreserveIdentityChange={setPreserveIdentity}
          onAutoExtractFeaturesChange={setAutoExtractFeatures}
        />

        <VisualStyleSelector value={style} onChange={setStyle} />
        <OptionalRefinementBox value={refinement} onChange={setRefinement} />

        <div className="character-create-actions">
          <div>
            <Button
              className="character-create-button character-create-button--primary"
              htmlType="button"
              disabled={!canGenerate}
              onClick={handleGenerate}
            >
              Сгенерировать
            </Button>
          </div>
          <p>После генерации вы сможете доработать персонажа в редакторе.</p>
        </div>
      </div>

      <aside className="character-reference-side">
        <GenerationSettingsPanel value={generationOptions} onChange={setGenerationOptions} />
        <ExtractedFeaturesPanel visible={Boolean(file)} />
        <IdentityInfoPanel preserveIdentity={preserveIdentity} />
        <TipsPanel />
      </aside>
    </div>
  );
}

function ReferenceUploadCard({file, previewUrl, onFileSelect, onRemove}: ReferenceUploadCardProps) {
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
          <h2>Референс-изображение</h2>
          <p>Загрузите изображение, на основе которого будет создан персонаж</p>
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
          aria-label="Загрузить референс-изображение"
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
              <img className="reference-upload-dropzone__image" src={previewUrl} alt={file?.name || 'Референс'} />
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
                  Заменить
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
                  Удалить
                </Button>
              </div>
            </>
          ) : (
            <div className="reference-upload-empty">
              <span className="reference-upload-empty__icon">
                <UploadOutlined />
              </span>
              <strong>Перетащите изображение сюда</strong>
              <span>или нажмите для выбора файла</span>
              <small>JPG, PNG • Макс. размер 10MB</small>
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
  autoExtractFeatures,
  showNameError,
  onNameChange,
  onNameBlur,
  onCharacterTypeChange,
  onLifecycleStageChange,
  onGenderChange,
  onRoleChange,
  onPreserveIdentityChange,
  onAutoExtractFeaturesChange,
}: ReferenceParametersCardProps) {
  return (
    <section className="reference-parameters-card">
      <div className="reference-parameters-card__header">
        <span className="reference-parameters-card__icon">
          <IdcardOutlined />
        </span>
        <div>
          <h2>Параметры персонажа</h2>
          <p>Укажите базовые данные о персонаже</p>
        </div>
      </div>

      <div className="reference-parameters-card__body">
        <FormField
          htmlFor="reference-character-name"
          label="Имя персонажа"
          required
          error={showNameError ? 'Укажите имя персонажа' : undefined}
        >
          <TextInputWithCounter
            id="reference-character-name"
            value={name}
            maxLength={80}
            placeholder="Введите имя персонажа"
            error={showNameError}
            onBlur={onNameBlur}
            onChange={onNameChange}
          />
        </FormField>

        <div className="reference-parameters-grid reference-parameters-grid--two">
          <FormField htmlFor="reference-character-type" label="Тип сущности" required>
            <SelectField
              id="reference-character-type"
              value={characterType}
              placeholder="Выберите тип сущности"
              options={characterTypeOptions}
              onChange={(value) => onCharacterTypeChange((value || 'human') as CharacterTypeValue)}
            />
          </FormField>

          <FormField htmlFor="reference-character-role" label="Роль">
            <SelectField
              id="reference-character-role"
              value={role}
              placeholder="Выберите роль персонажа"
              options={roleOptions}
              onChange={(value) => onRoleChange(value ?? 'main')}
            />
          </FormField>
        </div>

        <div className="reference-parameters-grid reference-parameters-grid--two">
          <FormField htmlFor="reference-character-lifecycle-stage" label="Возраст / стадия жизни">
            <Input
              id="reference-character-lifecycle-stage"
              className="reference-form-control"
              value={lifecycleStage}
              maxLength={128}
              placeholder="Например: 17, взрослый, древний, неизвестно"
              onChange={(event) => onLifecycleStageChange(event.target.value)}
            />
          </FormField>

          <FormField htmlFor="reference-character-gender" label="Пол / применимость">
            <SelectField
              id="reference-character-gender"
              value={gender}
              placeholder="Выберите пол или применимость"
              options={genderApplicabilityOptions}
              onChange={(value) => onGenderChange(value as GenderValue | undefined)}
            />
          </FormField>
        </div>

        <div className="reference-toggle-options">
          <ToggleOption
            checked={preserveIdentity}
            title="Использовать изображение как основу идентичности"
            description="Лицо и ключевые черты будут сохранены при генерации и редактировании"
            onChange={onPreserveIdentityChange}
          />
          <ToggleOption
            checked={autoExtractFeatures}
            title="Автоматически извлечь характеристики внешности"
            description="AI проанализирует изображение и предложит параметры"
            onChange={onAutoExtractFeaturesChange}
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
  return (
    <section className="character-create-section reference-refinement-section">
      <div className="character-create-section__header">
        <span className="character-create-section__icon">
          <EditOutlined />
        </span>
        <div>
          <h2>Дополнительные уточнения (необязательно)</h2>
        </div>
      </div>

      <div className="reference-refinement-field">
        <Input.TextArea
          className="reference-refinement-textarea"
          value={value}
          rows={4}
          maxLength={300}
          placeholder={`Например:
Сохранить лицо, но изменить одежду на школьную форму
Сделать стиль более тёмным и кинематографичным`}
          onChange={(event) => onChange(event.target.value)}
        />
        <div className="reference-refinement-counter">
          {value.length} / 300
        </div>
      </div>
    </section>
  );
}

function ExtractedFeaturesPanel({visible}: ExtractedFeaturesPanelProps) {
  if (!visible) {
    return null;
  }

  return (
    <section className="create-side-card">
      <div className="create-side-card__header">
        <h2>Извлечённые характеристики</h2>
      </div>

      <dl className="extracted-features-list">
        {extractedFeatures.map((feature) => (
          <div className="extracted-features-list__row" key={feature.label}>
            <dt>{feature.label}</dt>
            <dd>{feature.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function IdentityInfoPanel({preserveIdentity}: IdentityInfoPanelProps) {
  return (
    <section className="create-side-card">
      <div className="create-side-card__header">
        <h2>Информация об идентичности</h2>
      </div>

      <div className="identity-info-copy">
        <SafetyCertificateOutlined />
        <p>
          Изображение будет использоваться как основа идентичности персонажа. Система сохранит ключевые
          черты внешности, тип сущности и особые признаки при генерации и редактировании.
        </p>
      </div>

      {!preserveIdentity && (
        <div className="identity-warning" role="alert">
          <ExclamationCircleOutlined />
          <span>Идентичность может сохраняться хуже без использования референса.</span>
        </div>
      )}
    </section>
  );
}

function TipsPanel() {
  return (
    <section className="create-side-card">
      <div className="create-side-card__header">
        <h2>Советы</h2>
      </div>

      <ul className="tips-list">
        {tips.map((tip) => (
          <li key={tip}>
            <CheckCircleOutlined />
            <span>{tip}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
