import React, {useEffect, useState} from 'react';
import {Button, Collapse, Modal, message} from 'antd';
import {ArrowLeftOutlined, DeleteOutlined, EditOutlined, MoreOutlined, ReloadOutlined, SaveOutlined} from '@ant-design/icons';
import {useLocation, useNavigate, useParams} from 'react-router-dom';
import {characterApi} from '../api/characterApi';
import CharacterCategorySidebar from '../components/CharacterCategorySidebar';
import CharacterEditorLayout from '../components/CharacterEditorLayout';
import CharacterPreview, {viewModeToImageType} from '../components/CharacterPreview';
import CharacterSettingsPanel from '../components/CharacterSettingsPanel';
import IdentityLockButton from '../components/IdentityLockButton';
import OutfitSettingsPanel from '../components/OutfitSettingsPanel';
import PersonalityEditorPanel from '../components/PersonalityEditorPanel';
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
import {useGenerationJob} from '../hooks/useGenerationJob';
import {CharacterImageType, CharacterRegion, CharacterVariant, CharacterViewMode, GenerationJob, StudioCharacter} from '../types/character.types';
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
  'hair_details',
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
    hair_details: Array.isArray(appearance.hair_details) ? appearance.hair_details : undefined,
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

const POLL_DELAY_MS = 3000;

async function pollUntilDone(jobId: string): Promise<GenerationJob> {
  for (;;) {
    const response = await characterApi.getJob(jobId);
    const job = response.data as GenerationJob;
    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
      return job;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, POLL_DELAY_MS));
  }
}

const SCENE_LOCATION_LABELS: Record<string, string> = {
  studio: 'studio environment',
  city: 'urban city street',
  room: 'indoor room',
  street: 'outdoor street',
};
const SCENE_TIME_LABELS: Record<string, string> = {
  day: 'daytime lighting',
  night: 'night lighting',
  sunset: 'sunset golden hour',
  dawn: 'dawn soft light',
};
const SCENE_WEATHER_LABELS: Record<string, string> = {
  clear: 'clear weather',
  rain: 'rainy atmosphere',
  snow: 'snowy environment',
  fog: 'foggy atmosphere',
};

function buildSceneRefinement(settings: {location: string; time: string; weather: string}) {
  const parts = [
    SCENE_LOCATION_LABELS[settings.location],
    SCENE_TIME_LABELS[settings.time],
    SCENE_WEATHER_LABELS[settings.weather],
  ].filter(Boolean);
  return parts.length ? parts.join(', ') + '.' : '';
}

export default function CharacterEditorPage() {
  const {projectId = '', characterId = ''} = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const {character, refresh, setCharacter} = useCharacter(projectId, characterId);
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
  const [personalityEdits, setPersonalityEdits] = useState<Partial<StudioCharacter>>({});
  const [outfitDescription, setOutfitDescription] = useState('');
  const [outfitSource, setOutfitSource] = useState<'reference' | 'text'>('text');
  const [sceneSettings, setSceneSettings] = useState({location: 'studio', time: 'night', weather: 'clear'});
  const [generatingImageType, setGeneratingImageType] = useState<CharacterImageType | null>(null);
  const [sequentialRunning, setSequentialRunning] = useState(false);
  const editor = useCharacterEditor(!!character?.identity_locked);
  const {jobs: secondaryJobs, retry: retrySecondaryJob} = useCharacterAssetJobs(projectId, characterId, character, refresh, sequentialRunning);

  useEffect(() => {
    const state = location.state as {jobId?: string} | null;
    if (state?.jobId && !jobId) {
      setJobId(state.jobId);
    }
  }, [jobId, location.state]);

  useEffect(() => {
    if (!character || hydratedCharacterId === character.character_id) return;
    editor.setControls(controlsFromCharacter(character));
    setPersonalityEdits({
      role: character.role,
      personality: character.personality,
      speech_style: character.speech_style,
    });
    setOutfitDescription(character.clothing_description || '');
    setOutfitSource(character.clothing_source || 'text');
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

  const persistControlsAndRefreshRef = React.useRef<() => Promise<void>>();

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
      persistControlsAndRefreshRef.current?.();
      if (process.env.NODE_ENV === 'development') {
        console.debug('[CharacterEditor] generation completed', {jobId: job.job_id, variants: job.variants?.length ?? 0});
      }
    }
    if (job.status === 'cancelled') {
      setGeneratingImageType(null);
    }
  }, [job, notifiedFailedJobId, previewedJobId]);

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

    // Save current controls to DB before generation so the backend prompt compiler
    // reads up-to-date appearance fields (skin_tone, eye_color, face_shape, etc.).
    const savePayload = updatePayloadFromControls(editor.controls);
    if (Object.keys(savePayload).length > 0) {
      try {
        const saved = await characterApi.update(projectId, character.character_id, savePayload);
        if (saved?.data) {
          setCharacter(saved.data);
          editor.setControls(controlsFromCharacter(saved.data));
          setHydratedCharacterId(saved.data.character_id);
          setHasUnsavedChanges(false);
        }
      } catch {
        // non-critical: proceed with generation using controls in payload
      }
    }

    const baseControls = controlsFromCharacter(character);
    const diff = diffControls(baseControls, editor.controls);
    const activeImage = character.images?.[imageType];
    editor.setRegion(region);
    const sceneTextRefinement = imageType === 'scene' ? buildSceneRefinement(sceneSettings) : '';
    const effectiveTextRefinement = [editor.textRefinement, sceneTextRefinement].filter(Boolean).join(' ');
    try {
      const response = await characterApi.generateEdit(projectId, character.character_id, {
        ...editor.request,
        region,
        image_type: imageType,
        text_refinement: effectiveTextRefinement,
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
    await refreshAndResync();
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
    const payload = {
      ...updatePayloadFromControls(editor.controls),
      ...personalityEdits,
      clothing_source: outfitSource,
      clothing_description: outfitDescription,
    };

    if (Object.keys(payload).length === 0) {
      message.info('Нет изменений, которые нужно отправить в карточку персонажа');
      return;
    }

    setSaving(true);
    try {
      const response = await characterApi.update(projectId, character.character_id, payload);
      if (response?.data) {
        setCharacter(response.data);
        editor.setControls(controlsFromCharacter(response.data));
        setPersonalityEdits({
          role: response.data.role,
          personality: response.data.personality,
          speech_style: response.data.speech_style,
        });
        setHydratedCharacterId(response.data.character_id);
      }

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

  const updatePersonality = (updates: Partial<StudioCharacter>) => {
    setPersonalityEdits((prev) => ({...prev, ...updates}));
    setHasUnsavedChanges(true);
  };

  const handleOutfitDescriptionChange = (value: string) => {
    setOutfitDescription(value);
    setHasUnsavedChanges(true);
  };

  const handleOutfitSourceChange = (value: 'reference' | 'text') => {
    setOutfitSource(value);
    setHasUnsavedChanges(true);
  };

  // Refresh character from backend and re-hydrate controls from the response.
  const refreshAndResync = async () => {
    if (!character?.character_id) return;
    const response = await characterApi.get(projectId, character.character_id);
    if (response?.data) {
      setCharacter(response.data);
      editor.setControls(controlsFromCharacter(response.data));
      setHydratedCharacterId(response.data.character_id);
    }
  };
  persistControlsAndRefreshRef.current = refreshAndResync;

  const generateSequential = async () => {
    if (!character || generatingImageType || sequentialRunning) return;
    setSequentialRunning(true);

    const STEPS: Array<{type: CharacterImageType; region: CharacterRegion; label: string}> = [
      {type: 'portrait',  region: 'face',  label: 'Генерация портрета…'},
      {type: 'full_body', region: 'body',  label: 'Генерация full body…'},
      {type: 'scene',     region: 'style', label: 'Генерация сцены…'},
    ];

    const msgKey = 'seq-gen';

    // Save controls to DB once before starting all steps so appearance is up-to-date.
    const savePayload = updatePayloadFromControls(editor.controls);
    if (Object.keys(savePayload).length > 0) {
      try {
        const saved = await characterApi.update(projectId, character.character_id, savePayload);
        if (saved?.data) {
          setCharacter(saved.data);
          editor.setControls(controlsFromCharacter(saved.data));
          setHydratedCharacterId(saved.data.character_id);
          setHasUnsavedChanges(false);
        }
      } catch {
        // non-critical: proceed anyway
      }
    }

    const baseControls = controlsFromCharacter(character);
    const diff = diffControls(baseControls, editor.controls);
    let currentCharacter = character;

    for (const step of STEPS) {
      message.loading({content: step.label, key: msgKey, duration: 0});
      setGeneratingImageType(step.type);
      try {
        const activeImage = currentCharacter.images?.[step.type];
        const response = await characterApi.generateEdit(projectId, currentCharacter.character_id, {
          ...editor.request,
          region: step.region,
          image_type: step.type,
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

        if (response.data?.status === 'failed') {
          throw new Error(response.data?.error_message || 'Генерация не удалась');
        }

        let variants: GenerationJob['variants'] = response.data?.variants ?? [];

        if (response.data?.status !== 'completed') {
          const finalJob = await pollUntilDone(response.data.job_id);
          if (finalJob.status !== 'completed') {
            throw new Error(finalJob.error_message || 'Генерация не удалась');
          }
          variants = finalJob.variants ?? [];
        }

        if (variants.length) {
          await characterApi.applyVariant(
            projectId, characterId, variants[0].variant_id,
            `Обновить: ${step.type}`, step.type,
          );
        }

        const refreshed = await characterApi.get(projectId, characterId);
        currentCharacter = refreshed.data;
        setGeneratingImageType(null);
      } catch (e) {
        message.destroy(msgKey);
        message.error(
          `Ошибка "${step.label}": ${e instanceof Error ? e.message : 'Попробуйте ещё раз'}`,
        );
        setGeneratingImageType(null);
        setSequentialRunning(false);
        return;
      }
    }

    message.destroy(msgKey);
    message.success('Все изображения обновлены');
    setSequentialRunning(false);
    refresh();
  };

  const selectCategory = (key: string) => {
    setActiveTab(key);
    if (key === 'face' || key === 'hair') {
      setActiveViewMode('portrait');
    } else if (key === 'body' || key === 'outfit') {
      setActiveViewMode('fullBody');
    } else {
      setActiveViewMode('portrait');
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

  const effectiveCharacter = character ? {...character, ...personalityEdits} : character;

  const right = activeViewMode === 'fullBody' && activeTab === 'outfit'
    ? <OutfitSettingsPanel
        projectId={projectId}
        characterId={characterId}
        clothingReferences={character?.clothing_references || []}
        onReferencesChange={(refs) => {
          if (!character) return;
          setCharacter({...character, clothing_references: refs});
        }}
        outfitDescription={outfitDescription}
        onDescriptionChange={handleOutfitDescriptionChange}
        outfitSource={outfitSource}
        onSourceChange={handleOutfitSourceChange}
      />
    : activeViewMode === 'fullBody'
    ? <FullBodySettingsPanel />
    : activeViewMode === 'scene'
      ? <SceneSettingsPanel settings={sceneSettings} onChange={setSceneSettings} />
      : activeViewMode === 'sheet'
        ? <ReferenceSheetSettingsPanel />
        : activeTab === 'personality'
              ? effectiveCharacter
                ? <PersonalityEditorPanel character={effectiveCharacter} onChange={updatePersonality} />
                : null
              : <CharacterSettingsPanel region={(['face', 'hair', 'body', 'style'].includes(activeTab) ? activeTab : 'face') as CharacterRegion} controls={editor.controls} onControlsChange={updateControls} textRefinement={editor.textRefinement} onTextRefinementChange={editor.setTextRefinement} />;

  return <CharacterEditorLayout
    topBar={<EditorTopBar characterName={character?.name || 'Персонаж'} onBack={() => navigate(`/project/${projectId}/characters`)} onRename={() => message.info('Переименование доступно через дерево персонажей слева')} onRefresh={generateSequential} sequentialRunning={sequentialRunning} generatingImageType={generatingImageType} onSave={save} onDelete={deleteCurrentCharacter} saving={saving} hasUnsavedChanges={hasUnsavedChanges} locked={!!character?.identity_locked} onLock={lock} />}
    sidebar={<CharacterCategorySidebar active={activeTab} onSelect={selectCategory} />}
    center={<div className="character-editor-center"><CharacterPreview character={character} selectedVariant={previewVariant} activeViewMode={activeViewMode} onViewModeChange={selectViewMode} onGenerateImage={generate} generatingImageType={generatingImageType} jobProgress={job?.progress} secondaryJobs={secondaryJobs} onRetrySecondary={retrySecondaryJob} /><EditorLowerDeck activeViewMode={activeViewMode} />{job?.variants && (!jobImageType || jobImageType === currentImageType) && <div className="character-side-card"><VariantGrid variants={job.variants} selectedVariantId={selectedVariant?.variant_id} onSelect={setSelectedVariant} onApply={apply} /></div>}</div>}
    right={right}
  />;
}

function EditorTopBar({characterName, onBack, onRename, onRefresh, sequentialRunning, generatingImageType, onSave, onDelete, saving, hasUnsavedChanges, locked, onLock}: {characterName: string; onBack: () => void; onRename: () => void; onRefresh: () => void; sequentialRunning: boolean; generatingImageType: CharacterImageType | null; onSave: () => void; onDelete: () => void; saving: boolean; hasUnsavedChanges: boolean; locked: boolean; onLock: () => void}) {
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
        <Button className="character-editor-button character-editor-button--outline" icon={<ReloadOutlined />} loading={sequentialRunning} disabled={!!generatingImageType && !sequentialRunning} onClick={onRefresh}>Обновить</Button>
        <Button className="character-editor-button character-editor-button--danger" icon={<DeleteOutlined />} onClick={onDelete}>Удалить</Button>
        <Button className="character-editor-button character-editor-button--primary" icon={<SaveOutlined />} loading={saving} onClick={onSave}>Сохранить</Button>
        <Button className="character-editor-icon-button" icon={<MoreOutlined />} />
      </div>
    </>
  );
}

function EditorLowerDeck({activeViewMode}: {activeViewMode: CharacterViewMode}) {
  if (activeViewMode === 'sheet') return <ReferenceSheetStatus />;
  return null;
}

function ReferenceSheetStatus() {
  return (
    <section className="character-editor-panel reference-status-panel">
      <div className="character-editor-panel__header">
        <h2>Статус ракурсов</h2>
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
        ]}
      />
    </ModeSettingsPanel>
  );
}

const SCENE_LOCATIONS = [
  {value: 'studio', label: 'Студия'},
  {value: 'city', label: 'Город'},
  {value: 'room', label: 'Комната'},
  {value: 'street', label: 'Улица'},
];
const SCENE_TIMES = [
  {value: 'day', label: 'День'},
  {value: 'night', label: 'Ночь'},
  {value: 'sunset', label: 'Закат'},
  {value: 'dawn', label: 'Рассвет'},
];
const SCENE_WEATHERS = [
  {value: 'clear', label: 'Ясно'},
  {value: 'rain', label: 'Дождь'},
  {value: 'snow', label: 'Снег'},
  {value: 'fog', label: 'Туман'},
];

function SceneSettingsPanel({settings, onChange}: {settings: {location: string; time: string; weather: string}; onChange: (s: {location: string; time: string; weather: string}) => void}) {
  return (
    <ModeSettingsPanel eyebrow="Контекстная панель" title="Настройки: Сцена">
      <SettingsSection title="Окружение" primary>
        <div className="mode-preset-grid">
          {SCENE_LOCATIONS.map(({value, label}) => (
            <button key={value} type="button" className={settings.location === value ? 'is-active' : ''} onClick={() => onChange({...settings, location: value})}>{label}</button>
          ))}
        </div>
      </SettingsSection>
      <Collapse
        className="character-settings-collapse"
        ghost
        items={[
          {
            key: 'time',
            label: 'Время суток',
            children: (
              <div className="mode-preset-grid">
                {SCENE_TIMES.map(({value, label}) => (
                  <button key={value} type="button" className={settings.time === value ? 'is-active' : ''} onClick={() => onChange({...settings, time: value})}>{label}</button>
                ))}
              </div>
            ),
          },
          {
            key: 'weather',
            label: 'Погода / атмосфера',
            children: (
              <div className="mode-preset-grid">
                {SCENE_WEATHERS.map(({value, label}) => (
                  <button key={value} type="button" className={settings.weather === value ? 'is-active' : ''} onClick={() => onChange({...settings, weather: value})}>{label}</button>
                ))}
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
    <ModeSettingsPanel eyebrow="Контекстная панель" title="Настройки: Ракурсы">
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
