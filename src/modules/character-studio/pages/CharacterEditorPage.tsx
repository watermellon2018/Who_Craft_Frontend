import React, {useEffect, useState} from 'react';
import {Button, Collapse, Modal, message} from 'antd';
import {
  ArrowLeftOutlined,
  BulbOutlined,
  CameraOutlined,
  DeleteOutlined,
  EditOutlined,
  MoreOutlined,
  ReloadOutlined,
  SaveOutlined,
  StarOutlined,
  ThunderboltOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import {useLocation, useNavigate, useParams} from 'react-router-dom';
import {characterApi} from '../api/characterApi';
import CharacterCategorySidebar from '../components/CharacterCategorySidebar';
import CharacterEditorLayout from '../components/CharacterEditorLayout';
import CharacterPreview, {viewModeToImageType} from '../components/CharacterPreview';
import CharacterSettingsPanel from '../components/CharacterSettingsPanel';
import ExpressionList from '../components/ExpressionList';
import IdentityLockButton from '../components/IdentityLockButton';
import OutfitList from '../components/OutfitList';
import RevisionHistory from '../components/RevisionHistory';
import VariantGrid from '../components/VariantGrid';
import {
  CHARACTER_DELETED_EVENT,
  CHARACTER_RENAMED_EVENT,
  notifyCharacterDeleted,
  notifyCharacterListUpdated,
  notifyCharacterTreeUpdated,
} from '../events';
import {useCharacter} from '../hooks/useCharacter';
import {useCharacterAssetJobs} from '../hooks/useCharacterAssetJobs';
import {useCharacterEditor} from '../hooks/useCharacterEditor';
import {useCharacterRevisions} from '../hooks/useCharacterRevisions';
import {useGenerationJob} from '../hooks/useGenerationJob';
import {CharacterImageType, CharacterRegion, CharacterVariant, CharacterViewMode, StudioCharacter} from '../types/character.types';
import './CharacterEditorPage.css';

const APPEARANCE_CONTROL_FIELDS = [
  'face_shape',
  'skin_tone',
  'eye_shape',
  'eye_color',
  'eyebrow_shape',
  'nose_shape',
  'lips_shape',
  'jawline',
  'hair_length',
  'hair_style',
  'hair_color',
  'height',
  'body_type',
  'body_structure',
  'surface_material',
  'special_features',
  'posture',
  'distinctive_features',
  'appearance_description',
];

function controlsFromCharacter(character: StudioCharacter) {
  const appearance = character.appearance || {};
  const controls: Record<string, unknown> = {
    gender: character.gender || undefined,
    visual_style: character.visual_style || undefined,
    face_shape: appearance.face_shape || undefined,
    skin_tone: appearance.skin_tone || undefined,
    eye_shape: appearance.eye_shape || undefined,
    eye_color: appearance.eye_color || undefined,
    eyebrow_shape: appearance.eyebrow_shape || undefined,
    nose_shape: appearance.nose_shape || undefined,
    lips_shape: appearance.lips_shape || undefined,
    jawline: appearance.jawline || undefined,
    hair_length: appearance.hair_length || undefined,
    hair_style: appearance.hair_style || undefined,
    hair_color: appearance.hair_color || undefined,
    height: appearance.height || undefined,
    body_type: appearance.body_type || undefined,
    body_structure: appearance.body_structure || undefined,
    surface_material: appearance.surface_material || undefined,
    special_features: appearance.special_features || undefined,
    posture: appearance.posture || undefined,
    distinctive_features: appearance.distinctive_features || undefined,
    appearance_description: appearance.appearance_prompt || undefined,
  };

  if (typeof character.age === 'number') {
    controls.age = character.age;
  }

  return controls;
}

function updatePayloadFromControls(controls: Record<string, unknown>) {
  const payload: Record<string, unknown> = {};

  if (typeof controls.age === 'number') {
    payload.age = controls.age;
  }
  if (typeof controls.age === 'string' && controls.age.trim()) {
    payload.age = Number(controls.age);
  }
  if (typeof controls.gender === 'string') {
    payload.gender = controls.gender;
  }
  if (typeof controls.visual_style === 'string') {
    payload.visual_style = controls.visual_style;
  }

  APPEARANCE_CONTROL_FIELDS.forEach((field) => {
    if (controls[field] !== undefined) {
      payload[field] = controls[field];
    }
  });

  return payload;
}

function diffControls(previous: Record<string, unknown>, next: Record<string, unknown>) {
  const changedFields = Array.from(new Set([...Object.keys(previous), ...Object.keys(next)])).filter((key) => {
    const prevValue = previous[key];
    const nextValue = next[key];
    return JSON.stringify(prevValue ?? null) !== JSON.stringify(nextValue ?? null);
  });
  return {
    changedFields,
    previousValues: Object.fromEntries(changedFields.map((key) => [key, previous[key] ?? null])),
    newValues: Object.fromEntries(changedFields.map((key) => [key, next[key] ?? null])),
  };
}

function regionForImageType(imageType: CharacterImageType, activeTab: string): CharacterRegion {
  if (imageType === 'portrait') {
    return (['face', 'hair', 'style'].includes(activeTab) ? activeTab : 'face') as CharacterRegion;
  }
  if (imageType === 'full_body') {
    return (['hair', 'body', 'outfit', 'style'].includes(activeTab) ? activeTab : 'body') as CharacterRegion;
  }
  if (imageType === 'scene') return 'style';
  return 'full_character';
}

function confirmDeleteCharacter(name: string) {
  return new Promise<boolean>((resolve) => {
    Modal.confirm({
      title: `Вы точно уверены в удалении персонажа «${name}»?`,
      okText: 'Удалить',
      cancelText: 'Отмена',
      okButtonProps: {danger: true},
      className: 'character-delete-confirm-modal',
      centered: true,
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    });
  });
}

export default function CharacterEditorPage() {
  const {projectId = '', characterId = ''} = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const {character, refresh, setCharacter} = useCharacter(projectId, characterId);
  const {revisions, refresh: refreshRevisions} = useCharacterRevisions(projectId, characterId);
  const [activeTab, setActiveTab] = useState<string>('face');
  const [activeViewMode, setActiveViewMode] = useState<CharacterViewMode>('portrait');
  const [jobId, setJobId] = useState<string>();
  const {job} = useGenerationJob(jobId);
  const [selectedVariant, setSelectedVariant] = useState<CharacterVariant | null>(null);
  const [previewedJobId, setPreviewedJobId] = useState<string>();
  const [notifiedFailedJobId, setNotifiedFailedJobId] = useState<string>();
  const [hydratedCharacterId, setHydratedCharacterId] = useState<string>();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingImageType, setGeneratingImageType] = useState<CharacterImageType | null>(null);
  const editor = useCharacterEditor(!!character?.identity_locked);
  const {jobs: secondaryJobs, retry: retrySecondaryJob} = useCharacterAssetJobs(projectId, characterId, character, refresh);

  useEffect(() => {
    const state = location.state as {jobId?: string} | null;
    if (state?.jobId && !jobId) {
      setJobId(state.jobId);
    }
  }, [jobId, location.state]);

  useEffect(() => {
    if (!character || hydratedCharacterId === character.character_id) return;
    editor.setControls(controlsFromCharacter(character));
    setHydratedCharacterId(character.character_id);
    setHasUnsavedChanges(false);
  }, [character, editor, hydratedCharacterId]);

  useEffect(() => {
    const handleDeleted = (event: Event) => {
      const deletedCharacterId = (event as CustomEvent<{characterId?: string}>).detail?.characterId;
      if (deletedCharacterId === characterId) {
        setCharacter(null);
        navigate(`/project/${projectId}/characters`, {replace: true});
      }
    };

    window.addEventListener(CHARACTER_DELETED_EVENT, handleDeleted);
    return () => window.removeEventListener(CHARACTER_DELETED_EVENT, handleDeleted);
  }, [characterId, navigate, projectId, setCharacter]);

  useEffect(() => {
    const handleRenamed = (event: Event) => {
      const detail = (event as CustomEvent<{characterId?: string; name?: string}>).detail;
      if (detail?.characterId === characterId && detail.name) {
        setCharacter((current) => current ? {...current, name: detail.name || current.name} : current);
      }
    };

    window.addEventListener(CHARACTER_RENAMED_EVENT, handleRenamed);
    return () => window.removeEventListener(CHARACTER_RENAMED_EVENT, handleRenamed);
  }, [characterId, setCharacter]);

  useEffect(() => {
    if (!job) return;
    if (job.status === 'failed' && notifiedFailedJobId !== job.job_id) {
      message.error(job.error_message || 'Генерация не удалась (backend вернул FAILED)');
      setNotifiedFailedJobId(job.job_id);
      setGeneratingImageType(null);
      if (process.env.NODE_ENV === 'development') {
        console.debug('[CharacterEditor] generation failed', {jobId: job.job_id, error: job.error_message});
      }
    }
    if (job.status === 'completed' && previewedJobId !== job.job_id) {
      if (job.variants?.length) {
        setSelectedVariant((current) => current || job.variants[0]);
      }
      setPreviewedJobId(job.job_id);
      setGeneratingImageType(null);
      refresh();
      if (process.env.NODE_ENV === 'development') {
        console.debug('[CharacterEditor] generation completed', {jobId: job.job_id, variants: job.variants?.length ?? 0});
      }
    }
    if (job.status === 'cancelled') {
      setGeneratingImageType(null);
    }
  }, [job, notifiedFailedJobId, previewedJobId, refresh]);

  const generate = async () => {
    if (!character || generatingImageType) return;
    const imageType = viewModeToImageType(activeViewMode);
    const region = regionForImageType(imageType, activeTab);
    if (character.identity_locked && region === 'full_character') {
      message.warning('Это может изменить идентичность персонажа. Создайте новую версию перед генерацией.');
      return;
    }
    setGeneratingImageType(imageType);
    if (process.env.NODE_ENV === 'development') {
      console.debug('[CharacterEditor] starting generation', {imageType, region});
    }
    const baseControls = controlsFromCharacter(character);
    const diff = diffControls(baseControls, editor.controls);
    const activeImage = character.images?.[imageType];
    editor.setRegion(region);
    try {
      const response = await characterApi.generateEdit(projectId, character.character_id, {
        ...editor.request,
        region,
        image_type: imageType,
        controls: {
          ...editor.controls,
          changed_fields: diff.changedFields,
          previous_values: diff.previousValues,
          new_values: diff.newValues,
        },
        changed_fields: diff.changedFields,
        previous_values: diff.previousValues,
        new_values: diff.newValues,
        current_image_url: activeImage?.image_url || null,
        current_asset_id: activeImage?.asset_id || null,
      });
      if (process.env.NODE_ENV === 'development') {
        console.debug('[CharacterEditor] generation job created', {jobId: response.data?.job_id, status: response.data?.status});
      }
      setSelectedVariant(null);
      setPreviewedJobId(undefined);
      setNotifiedFailedJobId(undefined);
      setJobId(response.data.job_id);
      if (response.data?.status === 'failed') {
        message.error(response.data?.error_message || 'Генерация не удалась');
        setNotifiedFailedJobId(response.data.job_id);
        setGeneratingImageType(null);
      }
    } catch {
      message.error('Ошибка при запуске генерации. Попробуйте ещё раз.');
      setGeneratingImageType(null);
    }
  };

  const apply = async (variant: CharacterVariant) => {
    if (!character) return;
    const imageType = viewModeToImageType(activeViewMode);
    await characterApi.applyVariant(projectId, character.character_id, variant.variant_id, `Применен вариант ${variant.region}`, imageType);
    message.success('Вариант применен');
    setSelectedVariant(null);
    await refresh();
    await refreshRevisions();
  };

  const deleteCurrentCharacter = async () => {
    if (!character) return;
    const confirmed = await confirmDeleteCharacter(character.name);
    if (!confirmed) return;

    await characterApi.delete(projectId, character.character_id);
    notifyCharacterDeleted(character.character_id);
    notifyCharacterListUpdated();
    notifyCharacterTreeUpdated();
    message.success('Персонаж удален');
    setCharacter(null);
    navigate(`/project/${projectId}/characters`, {replace: true});
  };

  const lock = async () => {
    if (!character) return;
    await characterApi.lockIdentity(projectId, character.character_id, {reference_image_id: character.canonical_reference_image_id, appearance_id: character.appearance?.appearance_id});
    await refresh();
  };

  const save = async () => {
    if (!character) return;
    const payload = updatePayloadFromControls(editor.controls);

    if (Object.keys(payload).length === 0) {
      message.info('Нет изменений, которые нужно отправить в карточку персонажа');
      return;
    }

    setSaving(true);
    try {
      const response = await characterApi.update(projectId, character.character_id, payload);
      setCharacter(response?.data || character);
      setHasUnsavedChanges(false);
      notifyCharacterListUpdated();
      notifyCharacterTreeUpdated();
      message.success('Изменения сохранены');
    } finally {
      setSaving(false);
    }
  };

  const updateControls = (value: Record<string, unknown>) => {
    editor.setControls(value);
    setHasUnsavedChanges(true);
  };

  const handleQuickAction = (action: string) => {
    if (action === 'generate') {
      generate();
      return;
    }

    message.info('Действие добавлено как UI-заготовка и не меняет backend');
  };

  const selectCategory = (key: string) => {
    setActiveTab(key);
    if (key === 'face') {
      setActiveViewMode('portrait');
    }
    if (key === 'body') {
      setActiveViewMode('fullBody');
    }
    if (['face', 'hair', 'body', 'outfit', 'style'].includes(key)) {
      editor.setRegion(key as CharacterRegion);
    }
    if (key === 'personality') {
      editor.setRegion('full_character');
    }
  };

  const selectViewMode = (mode: CharacterViewMode) => {
    setActiveViewMode(mode);
    if (mode === 'portrait') {
      setActiveTab('face');
      editor.setRegion('face');
    }
    if (mode === 'fullBody') {
      setActiveTab('body');
      editor.setRegion('body');
    }
    if (mode === 'scene') {
      setActiveTab('style');
      editor.setRegion('style');
    }
    if (mode === 'sheet') {
      setActiveTab('style');
      editor.setRegion('style');
    }
  };

  const currentImageType = viewModeToImageType(activeViewMode);
  const jobImageType = job?.request_payload?.image_type as CharacterImageType | undefined;
  const previewVariant = !jobImageType || jobImageType === currentImageType ? selectedVariant : null;

  const right = activeViewMode === 'fullBody'
    ? <FullBodySettingsPanel />
    : activeViewMode === 'scene'
      ? <SceneSettingsPanel />
      : activeViewMode === 'sheet'
        ? <ReferenceSheetSettingsPanel />
        : activeTab === 'history'
    ? <div className="character-side-card"><RevisionHistory revisions={revisions} onRestore={async (revision) => { await characterApi.restoreRevision(projectId, characterId, revision.revision_id); await refresh(); await refreshRevisions(); }} /></div>
    : activeTab === 'outfit'
      ? <><CharacterSettingsPanel region="outfit" controls={editor.controls} onControlsChange={updateControls} textRefinement={editor.textRefinement} onTextRefinementChange={editor.setTextRefinement} preserve={editor.preserve} identityLocked={!!character?.identity_locked} onGenerate={generate} /><div className="character-side-card"><OutfitList outfits={character?.outfits || []} onSetDefault={async (outfit) => { await characterApi.setDefaultOutfit(projectId, characterId, outfit.outfit_id); await refresh(); }} /></div></>
      : activeTab === 'expressions'
        ? <div className="character-side-card"><ExpressionList /></div>
        : activeTab === 'personality'
          ? <CharacterSettingsPanel region="full_character" controls={editor.controls} onControlsChange={updateControls} textRefinement={editor.textRefinement} onTextRefinementChange={editor.setTextRefinement} preserve={editor.preserve} identityLocked={!!character?.identity_locked} onGenerate={generate} />
          : <CharacterSettingsPanel region="face" controls={editor.controls} onControlsChange={updateControls} textRefinement={editor.textRefinement} onTextRefinementChange={editor.setTextRefinement} preserve={editor.preserve} identityLocked={!!character?.identity_locked} onGenerate={generate} />;

  return <CharacterEditorLayout
    topBar={<EditorTopBar characterName={character?.name || 'Персонаж'} onBack={() => navigate(`/project/${projectId}/characters`)} onRename={() => message.info('Переименование доступно через дерево персонажей слева')} onRefresh={refresh} onSave={save} onDelete={deleteCurrentCharacter} saving={saving} hasUnsavedChanges={hasUnsavedChanges} locked={!!character?.identity_locked} onLock={lock} />}
    sidebar={<CharacterCategorySidebar active={activeTab} onSelect={selectCategory} />}
    center={<div className="character-editor-center"><CharacterPreview character={character} selectedVariant={previewVariant} activeViewMode={activeViewMode} onViewModeChange={selectViewMode} onGenerateImage={generate} generatingImageType={generatingImageType} jobProgress={job?.progress} secondaryJobs={secondaryJobs} onRetrySecondary={retrySecondaryJob} /><EditorLowerDeck activeViewMode={activeViewMode} character={character} onAction={handleQuickAction} />{job?.variants && (!jobImageType || jobImageType === currentImageType) && <div className="character-side-card"><VariantGrid variants={job.variants} selectedVariantId={selectedVariant?.variant_id} onSelect={setSelectedVariant} onApply={apply} /></div>}</div>}
    right={right}
  />;
}

function EditorTopBar({characterName, onBack, onRename, onRefresh, onSave, onDelete, saving, hasUnsavedChanges, locked, onLock}: {characterName: string; onBack: () => void; onRename: () => void; onRefresh: () => void; onSave: () => void; onDelete: () => void; saving: boolean; hasUnsavedChanges: boolean; locked: boolean; onLock: () => void}) {
  const saveLabel = saving ? 'Сохраняем' : hasUnsavedChanges ? 'Есть изменения' : 'Сохранено';

  return (
    <>
      <div className="character-editor-title">
        <button type="button" className="character-editor-back-button" onClick={onBack}>
          <ArrowLeftOutlined />
          <span>Назад</span>
        </button>
        <div>
          <h1>{characterName}</h1>
          <div className="character-editor-save-state">
            <span />
            <strong>{saveLabel}</strong>
          </div>
        </div>
        <button type="button" className="character-editor-icon-button" onClick={onRename} aria-label="Редактировать имя">
          <EditOutlined />
        </button>
      </div>
      <div className="character-editor-actions">
        <IdentityLockButton locked={locked} onLock={onLock} />
        <Button className="character-editor-button character-editor-button--outline" icon={<ReloadOutlined />} onClick={onRefresh}>Обновить</Button>
        <Button className="character-editor-button character-editor-button--danger" icon={<DeleteOutlined />} onClick={onDelete}>Удалить</Button>
        <Button className="character-editor-button character-editor-button--primary" icon={<SaveOutlined />} loading={saving} onClick={onSave}>Сохранить</Button>
        <Button className="character-editor-icon-button" icon={<MoreOutlined />} />
      </div>
    </>
  );
}

function EditorLowerDeck({activeViewMode, character, onAction}: {activeViewMode: CharacterViewMode; character: {references?: Array<{asset_id: string; image_url: string}>} | null | undefined; onAction: (action: string) => void}) {
  if (activeViewMode === 'fullBody') {
    return <FullBodyLowerDeck onAction={onAction} />;
  }
  if (activeViewMode === 'scene') {
    return <SceneLowerDeck onAction={onAction} />;
  }
  if (activeViewMode === 'sheet') {
    return <ReferenceSheetStatus />;
  }

  const references = character?.references || [];
  const referenceCards = references.length > 0 ? references.slice(0, 3) : [null, null, null];
  return (
    <div className="character-editor-lower">
      <section className="character-editor-panel">
        <div className="character-editor-panel__header">
          <h2>Выражения</h2>
          <p>Быстрая проверка мимики портрета.</p>
        </div>
        <div className="expression-chip-grid">
          {['Нейтральное', 'Улыбка', 'Серьезный', 'Удивление', 'Злость', 'Грусть'].map((expression, index) => (
            <button key={expression} type="button" className={index === 0 ? 'is-active' : ''}>{expression}</button>
          ))}
        </div>
      </section>
      <section className="character-editor-panel">
        <div className="character-editor-panel__header">
          <h2>Быстрые действия</h2>
          <p>Команды для быстрых визуальных итераций.</p>
        </div>
        <div className="quick-actions-grid">
          {[
            {key: 'generate', icon: <ThunderboltOutlined />, title: 'Сгенерировать вариант', text: 'Новая версия текущей зоны'},
            {key: 'light', icon: <BulbOutlined />, title: 'Изменить освещение', text: 'Мягкий свет или контровой'},
            {key: 'angle', icon: <CameraOutlined />, title: 'Сменить ракурс', text: 'Новый угол камеры'},
            {key: 'quality', icon: <StarOutlined />, title: 'Улучшить качество', text: 'Чище детали и контуры'},
          ].map((item) => (
            <button key={item.key} type="button" className="quick-action-card" onClick={() => onAction(item.key)}>
              <span>{item.icon}</span>
              <strong>{item.title}</strong>
              <small>{item.text}</small>
            </button>
          ))}
        </div>
      </section>
      <section className="character-editor-panel character-editor-panel--wide">
        <div className="character-editor-panel__header character-editor-panel__header--inline">
          <div>
            <h2>Референсы</h2>
            <p>Выбранный референс влияет на визуальный фокус.</p>
          </div>
          <button type="button" className="reference-add-button">+ Добавить</button>
        </div>
        <div className="reference-card-grid">
          {referenceCards.map((reference, index) => (
            <div key={reference?.asset_id || index} className={`reference-card${index === 0 ? ' reference-card--selected' : ''}`}>
              {reference ? <img src={reference.image_url} alt={`Референс ${index + 1}`} /> : <ToolOutlined />}
            </div>
          ))}
        </div>
        <div className="reference-tags">
          <span>Молодой</span>
          <span>Атлетичное телосложение</span>
          <span>Серьезный</span>
          <button type="button">+</button>
        </div>
      </section>
    </div>
  );
}

function FullBodyLowerDeck({onAction}: {onAction: (action: string) => void}) {
  return (
    <div className="character-editor-lower">
      <section className="character-editor-panel">
        <div className="character-editor-panel__header">
          <h2>Позы</h2>
          <p>Миниатюры для проверки силуэта и осанки.</p>
        </div>
        <div className="pose-preset-grid">
          {['Нейтральная', 'Уверенная', 'Расслабленная', 'Динамичная'].map((pose, index) => (
            <button key={pose} type="button" className={index === 0 ? 'is-active' : ''}>
              <span />
              <strong>{pose}</strong>
            </button>
          ))}
        </div>
      </section>
      <section className="character-editor-panel">
        <div className="character-editor-panel__header">
          <h2>Быстрые действия</h2>
          <p>Итерации для полного роста.</p>
        </div>
        <div className="quick-actions-grid">
          {[
            {key: 'generate', icon: <ThunderboltOutlined />, title: 'Сгенерировать полный рост', text: 'Новый вариант полного роста'},
            {key: 'pose', icon: <CameraOutlined />, title: 'Изменить позу', text: 'Перестроить осанку'},
            {key: 'proportions', icon: <ToolOutlined />, title: 'Подогнать пропорции', text: 'Плечи, руки, ноги'},
            {key: 'quality', icon: <StarOutlined />, title: 'Улучшить детализацию', text: 'Чище силуэт и одежда'},
          ].map((item) => (
            <button key={item.key} type="button" className="quick-action-card" onClick={() => onAction(item.key)}>
              <span>{item.icon}</span>
              <strong>{item.title}</strong>
              <small>{item.text}</small>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function SceneLowerDeck({onAction}: {onAction: (action: string) => void}) {
  return (
    <div className="character-editor-lower">
      <section className="character-editor-panel">
        <div className="character-editor-panel__header">
          <h2>Камеры</h2>
          <p>Проверка персонажа в разных планах.</p>
        </div>
        <div className="camera-preset-grid">
          {['Крупный план', 'Средний план', 'Общий план', 'Со спины', 'Сбоку'].map((camera, index) => (
            <button key={camera} type="button" className={index === 1 ? 'is-active' : ''}>{camera}</button>
          ))}
        </div>
      </section>
      <section className="character-editor-panel">
        <div className="character-editor-panel__header character-editor-panel__header--inline">
          <div>
            <h2>Быстрые действия</h2>
            <p>Быстрые кинематографичные итерации.</p>
          </div>
        </div>
        <div className="quick-actions-grid">
          {[
            {key: 'generate', icon: <ThunderboltOutlined />, title: 'Сгенерировать сцену', text: 'Новый кадр с окружением'},
            {key: 'background', icon: <CameraOutlined />, title: 'Изменить фон', text: 'Студия, город, комната'},
            {key: 'light', icon: <BulbOutlined />, title: 'Изменить свет', text: 'Интенсивность и мягкость'},
            {key: 'quality', icon: <StarOutlined />, title: 'Улучшить кадр', text: 'Композиция и детали'},
          ].map((item) => (
            <button key={item.key} type="button" className="quick-action-card" onClick={() => onAction(item.key)}>
              <span>{item.icon}</span>
              <strong>{item.title}</strong>
              <small>{item.text}</small>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function ReferenceSheetStatus() {
  return (
    <section className="character-editor-panel reference-status-panel">
      <div className="character-editor-panel__header">
        <h2>Статус референсов</h2>
        <p>Какие виды уже готовы, а какие требуют обновления.</p>
      </div>
      <div className="reference-status-grid">
        {[
          ['Фронт', 'Готово'],
          ['Профиль слева', 'Готово'],
          ['Спина', 'Нужно обновить'],
          ['Профиль справа', 'Нужно обновить'],
          ['Детали лица', 'Готово'],
          ['Обувь', 'Не создано'],
        ].map(([label, status]) => (
          <div key={label} className={status === 'Готово' ? 'is-ready' : ''}>
            <span>{label}</span>
            <strong>{status}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function FullBodySettingsPanel() {
  return (
    <ModeSettingsPanel eyebrow="Контекстная панель" title="Настройки: Тело">
      <SettingsSection title="Основное" primary>
        <PresetGrid items={['Худощавое', 'Среднее', 'Атлетичное', 'Крупное']} activeIndex={2} />
        <RangeControl label="Рост" value="178 см" />
        <RangeControl label="Масса / объем" value="54%" />
        <RangeControl label="Мышечная масса" value="62%" />
      </SettingsSection>
      <Collapse
        className="character-settings-collapse"
        ghost
        items={[
          {
            key: 'proportions',
            label: 'Пропорции',
            children: (
              <div className="character-collapse-content">
                <RangeControl label="Плечи" value="58%" />
                <RangeControl label="Талия" value="44%" />
                <RangeControl label="Ноги" value="66%" />
                <RangeControl label="Руки" value="52%" />
              </div>
            ),
          },
          {
            key: 'pose',
            label: 'Поза',
            children: <PresetGrid items={['Нейтральная', 'Уверенная', 'Расслабленная', 'Динамичная']} activeIndex={0} />,
          },
          {
            key: 'outfit',
            label: 'Одежда',
            children: <SegmentList items={['Верх', 'Низ', 'Обувь', 'Аксессуары']} />,
          },
        ]}
      />
    </ModeSettingsPanel>
  );
}

function SceneSettingsPanel() {
  return (
    <ModeSettingsPanel eyebrow="Контекстная панель" title="Настройки: Сцена">
      <SettingsSection title="Основное" primary>
        <PresetGrid items={['Студия', 'Город', 'Комната', 'Улица', 'Добавить свой']} activeIndex={0} />
      </SettingsSection>
      <Collapse
        className="character-settings-collapse"
        ghost
        items={[
          {
            key: 'light',
            label: 'Освещение',
            children: (
              <div className="character-collapse-content">
                <div className="light-direction-control">
                  <span />
                  <strong>Направление света</strong>
                </div>
                <RangeControl label="Интенсивность света" value="68%" />
                <RangeControl label="Мягкость света" value="47%" />
              </div>
            ),
          },
          {key: 'time', label: 'Время суток', children: <PresetGrid items={['День', 'Закат', 'Ночь', 'Рассвет']} activeIndex={1} />},
          {key: 'weather', label: 'Погода / атмосфера', children: <PresetGrid items={['Ясно', 'Облачно', 'Дождь', 'Снег', 'Туман']} activeIndex={0} />},
          {
            key: 'camera',
            label: 'Камера',
            children: (
              <div className="character-collapse-content">
                <RangeControl label="Фокусное расстояние" value="50 мм" />
                <RangeControl label="Угол" value="24°" />
                <RangeControl label="Глубина резкости" value="38%" />
              </div>
            ),
          },
        ]}
      />
    </ModeSettingsPanel>
  );
}

function ReferenceSheetSettingsPanel() {
  return (
    <ModeSettingsPanel eyebrow="Контекстная панель" title="Настройки: Референс-лист">
      <SettingsSection title="Основное" primary>
        <PresetGrid items={['1:1', '4:5', '16:9', 'A4']} activeIndex={3} />
      </SettingsSection>
      <Collapse
        className="character-settings-collapse"
        defaultActiveKey={['export']}
        ghost
        items={[
          {key: 'display', label: 'Отображать', children: <ToggleList items={['Сетка', 'Подписи', 'Фон']} />},
          {key: 'style', label: 'Стиль', children: <PresetGrid items={['Чистый лист', 'Студийный', 'Технический']} activeIndex={2} />},
          {
            key: 'export',
            label: 'Экспорт',
            children: (
              <div className="export-action-grid">
                {['Экспортировать', 'Скачать PNG', 'Скачать JPG', 'Скачать PDF'].map((item) => (
                  <button key={item} type="button">{item}</button>
                ))}
              </div>
            ),
          },
        ]}
      />
    </ModeSettingsPanel>
  );
}

function ModeSettingsPanel({eyebrow, title, children}: {eyebrow: string; title: string; children: React.ReactNode}) {
  return (
    <div className="character-settings-panel mode-settings-panel">
      <div className="character-settings-panel__header">
        <p>{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      <div className="character-settings-panel__body">
        {children}
      </div>
    </div>
  );
}

function SettingsSection({title, children, primary = false}: {title: string; children: React.ReactNode; primary?: boolean}) {
  return (
    <section className={`character-settings-section${primary ? ' character-settings-section--primary' : ''}`}>
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function PresetGrid({items, activeIndex = 0}: {items: string[]; activeIndex?: number}) {
  return (
    <div className="mode-preset-grid">
      {items.map((item, index) => (
        <button key={item} type="button" className={index === activeIndex ? 'is-active' : ''}>
          {item}
        </button>
      ))}
    </div>
  );
}

function RangeControl({label, value}: {label: string; value: string}) {
  return (
    <div className="mode-range-control">
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <input type="range" min="0" max="100" defaultValue="58" aria-label={label} />
    </div>
  );
}

function SegmentList({items}: {items: string[]}) {
  return (
    <div className="segment-list">
      {items.map((item) => (
        <button key={item} type="button">
          <span>{item}</span>
          <strong>Настроить</strong>
        </button>
      ))}
    </div>
  );
}

function ToggleList({items}: {items: string[]}) {
  return (
    <div className="toggle-list">
      {items.map((item, index) => (
        <button key={item} type="button" className={index < 2 ? 'is-active' : ''}>
          {item}
        </button>
      ))}
    </div>
  );
}
