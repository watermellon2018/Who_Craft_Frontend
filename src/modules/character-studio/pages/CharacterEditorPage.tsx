import React, {useEffect, useRef, useState} from 'react';
import {Button, Collapse, Modal, message} from 'antd';
import {ArrowLeftOutlined, DeleteOutlined, EditOutlined, MoreOutlined, ReloadOutlined, SaveOutlined} from '@ant-design/icons';
import {useTranslation} from 'react-i18next';
import {useLocation, useNavigate, useParams} from 'react-router-dom';
import {characterApi} from '../api/characterApi';
import type {CharacterGenerationPreview} from '../api/characterApi';
import CharacterCategorySidebar from '../components/CharacterCategorySidebar';
import CharacterEditorLayout from '../components/CharacterEditorLayout';
import CharacterPreview, {viewModeToImageType} from '../components/CharacterPreview';
import type {ZoneEditState} from '../components/CharacterPreview';
import CharacterSettingsPanel from '../components/CharacterSettingsPanel';
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
import {dependentImageTypes, useCharacterAssetJobs} from '../hooks/useCharacterAssetJobs';
import {useCharacterEditor} from '../hooks/useCharacterEditor';
import {useGenerationJob} from '../hooks/useGenerationJob';
import type {CharacterImageType, CharacterRegion, CharacterVariant, CharacterViewMode, GenerationJob, StudioCharacter, ZoneEditResponse} from '../types/character.types';
import './CharacterEditorPage.css';

const APPEARANCE_CONTROL_FIELDS = [
  'skin_tone',
  'hair_length',
  'hair_color',
  'posture',
  'appearance_description',
];

function controlsFromCharacter(character: StudioCharacter) {
  const appearance = character.appearance || {};
  const controls: Record<string, unknown> = {
    gender: character.gender || undefined,
    visual_style: character.visual_style || undefined,
    skin_tone: appearance.skin_tone || undefined,
    hair_length: appearance.hair_length || undefined,
    hair_color: appearance.hair_color || undefined,
    posture: appearance.posture || undefined,
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
  return 'style';
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

function confirmGenerationPreview(preview: CharacterGenerationPreview) {
  const estimatedCost = preview.estimated_cost_usd === null
    ? 'not configured'
    : `$${preview.estimated_cost_usd}`;
  return new Promise<boolean>((resolve) => {
    Modal.confirm({
      title: 'Confirm generation',
      content: (
        <div>
          <p>Mode: {preview.mode === 'offline' ? 'mock / offline' : 'paid'}</p>
          <p>Provider: {preview.provider}</p>
          <p>Provider calls: {preview.provider_call_count}</p>
          <p>Estimated cost: {estimatedCost}</p>
          <p>
            Daily budget: user {preview.budgets.user.used}/{preview.budgets.user.limit},
            project {preview.budgets.project.used}/{preview.budgets.project.limit}
          </p>
          <p>
            Active jobs: global {preview.concurrency.global.active}/{preview.concurrency.global.limit},
            project {preview.concurrency.project.active}/{preview.concurrency.project.limit}
          </p>
        </div>
      ),
      okText: 'Start generation',
      cancelText: 'Cancel',
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
  return <CharacterEditorPageContent key={`${projectId}:${characterId}`} />;
}

function CharacterEditorPageContent() {
  const {projectId = '', characterId = ''} = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const {t} = useTranslation();
  const {character, refresh, setCharacter} = useCharacter(projectId, characterId);
  const [activeTab, setActiveTab] = useState<string>('face');
  const [activeViewMode, setActiveViewMode] = useState<CharacterViewMode>('portrait');
  const [jobId, setJobId] = useState<string>();
  const {job} = useGenerationJob(jobId, projectId, characterId);
  const [selectedVariant, setSelectedVariant] = useState<CharacterVariant | null>(null);
  const [previewedJobId, setPreviewedJobId] = useState<string>();
  const [notifiedFailedJobId, setNotifiedFailedJobId] = useState<string>();
  const [hydratedCharacterId, setHydratedCharacterId] = useState<string>();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const editRevisionRef = useRef(0);
  const [saving, setSaving] = useState(false);
  const [personalityEdits, setPersonalityEdits] = useState<Partial<StudioCharacter>>({});
  const [outfitDescription, setOutfitDescription] = useState('');
  const [outfitSource, setOutfitSource] = useState<'reference' | 'text'>('text');
  const [sceneSettings, setSceneSettings] = useState({location: 'studio', time: 'night', weather: 'clear'});
  const [generatingImageType, setGeneratingImageType] = useState<CharacterImageType | null>(null);
  const [sequentialRunning, setSequentialRunning] = useState(false);
  const applyingVariantRef = useRef(false);
  const [pendingPrimaryImageType, setPendingPrimaryImageType] = useState<CharacterImageType | null>(null);
  const [pendingSecondaryTypes, setPendingSecondaryTypes] = useState<CharacterImageType[]>([]);
  const [zoneEditOpen, setZoneEditOpen] = useState(false);
  const [zoneEditSubmitting, setZoneEditSubmitting] = useState(false);
  // Saved zone per image-type: one zone per format, independent state.
  const [savedZones, setSavedZones] = useState<Partial<Record<CharacterImageType, ZoneEditState>>>({});
  // Tracks which job was started by zone-edit so we can clear the zone on completion.
  const zoneEditJobRef = React.useRef<{jobId: string; imageType: CharacterImageType} | null>(null);
  const editor = useCharacterEditor(false);
  const {jobs: secondaryJobs, retry: retrySecondaryJob, launchJob: launchSecondaryJob} = useCharacterAssetJobs(projectId, characterId, character, refresh, sequentialRunning);

  const confirmGeneration = async (imageTypes: CharacterImageType[]) => {
    if (!character) return false;
    try {
      const response = await characterApi.getGenerationPreview(
        projectId, character.character_id, imageTypes,
      );
      return confirmGenerationPreview(response.data);
    } catch {
      message.error(t('characterStudio.editor.generationError'));
      return false;
    }
  };

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
    editRevisionRef.current = 0;
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

  const persistAllEdits = async () => {
    if (!character) return {character: null, fullySaved: false, saved: false};
    const savedEditRevision = editRevisionRef.current;
    const payload = {
      ...updatePayloadFromControls(editor.controls),
      ...personalityEdits,
      clothing_source: outfitSource,
      clothing_description: outfitDescription,
    };

    try {
      const response = await characterApi.update(projectId, character.character_id, payload);
      const savedCharacter = response?.data ?? character;
      const fullySaved = editRevisionRef.current === savedEditRevision;

      if (response?.data) {
        setCharacter(response.data);
      }
      if (fullySaved) {
        if (response?.data) {
          editor.setControls(controlsFromCharacter(response.data));
          setPersonalityEdits({
            role: response.data.role,
            personality: response.data.personality,
            speech_style: response.data.speech_style,
          });
          setOutfitDescription(response.data.clothing_description ?? outfitDescription);
          setOutfitSource(response.data.clothing_source ?? outfitSource);
          setHydratedCharacterId(response.data.character_id);
        }
        setHasUnsavedChanges(false);
      }

      return {character: savedCharacter, fullySaved, saved: true};
    } catch {
      return {character, fullySaved: false, saved: false};
    }
  };

  useEffect(() => {
    if (!job) return;
    if (job.status === 'failed' && notifiedFailedJobId !== job.job_id) {
      message.error(job.error_message || t('characterStudio.editor.generationFailed'));
      setNotifiedFailedJobId(job.job_id);
      setGeneratingImageType(null);
    }
    if (job.status === 'completed' && previewedJobId !== job.job_id) {
      if (job.variants?.length) {
        setSelectedVariant((current) => current || job.variants[0]);
      }
      setPreviewedJobId(job.job_id);
      setGeneratingImageType(null);
      // Clear the zone that triggered this job so the selection doesn't linger,
      // and close zone-edit mode so the UI returns to idle.
      if (zoneEditJobRef.current?.jobId === job.job_id) {
        setSavedZones((prev) => {
          const next = {...prev};
          delete next[zoneEditJobRef.current!.imageType];
          return next;
        });
        zoneEditJobRef.current = null;
        setZoneEditOpen(false);
      }
      persistControlsAndRefreshRef.current?.();
    }
    if (job.status === 'cancelled') {
      setGeneratingImageType(null);
    }
  }, [job, notifiedFailedJobId, previewedJobId]);

  const generate = async () => {
    if (!character || generatingImageType) return;
    const imageType = viewModeToImageType(activeViewMode);
    const region = regionForImageType(imageType, activeTab);
    const plannedTypes = dependentImageTypes(imageType);
    if (!(await confirmGeneration(plannedTypes))) return;
    setGeneratingImageType(imageType);
    const persisted = await persistAllEdits();
    const generationCharacter = persisted.character ?? character;

    const baseControls = controlsFromCharacter(generationCharacter);
    const diff = diffControls(baseControls, editor.controls);
    const activeImage = generationCharacter.images?.[imageType];
    editor.setRegion(region);
    const sceneTextRefinement = imageType === 'scene' ? buildSceneRefinement(sceneSettings) : '';
    const effectiveTextRefinement = [editor.textRefinement, sceneTextRefinement].filter(Boolean).join(' ');
    try {
      const response = await characterApi.generateEdit(projectId, generationCharacter.character_id, {
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
        activate_image: false,
      });
      setSelectedVariant(null);
      setPreviewedJobId(undefined);
      setNotifiedFailedJobId(undefined);
      setJobId(response.data.job_id);
      if (response.data?.status === 'failed') {
        message.error(response.data?.error_message || t('characterStudio.editor.saveGeneric'));
        setNotifiedFailedJobId(response.data.job_id);
        setGeneratingImageType(null);
      } else {
        // Remember dependents, but do not start them until the selected primary
        // variant has been explicitly applied and produced a new revision.
        const backendDeps = (response.data as {dependent_image_types?: string[]} | undefined)?.dependent_image_types;
        const deps = (backendDeps && backendDeps.length
          ? (backendDeps as CharacterImageType[])
          : dependentImageTypes(imageType)
        ).filter((t) => t !== imageType);
        setPendingPrimaryImageType(imageType);
        setPendingSecondaryTypes(deps);
      }
    } catch {
      message.error(t('characterStudio.editor.generationError'));
      setGeneratingImageType(null);
    }
  };

  const currentImageTypeForZone = viewModeToImageType(activeViewMode);

  const handleZoneSave = (state: ZoneEditState) => {
    setSavedZones((prev) => ({...prev, [currentImageTypeForZone]: state}));
  };

  const applyZoneEdit = async (zone: ZoneEditState) => {
    if (!character || zoneEditSubmitting) return;
    const imageType = currentImageTypeForZone;
    if (!(await confirmGeneration([imageType]))) return;
    setZoneEditSubmitting(true);
    setGeneratingImageType(imageType);
    try {
      const response = await characterApi.zoneEdit(projectId, character.character_id, {
        asset_type: imageType,
        instruction: zone.instruction,
        selection: zone.selection,
        variant_count: 1,
      });
      const data = response.data as ZoneEditResponse;
      setSelectedVariant(null);
      setPreviewedJobId(undefined);
      setNotifiedFailedJobId(undefined);
      setJobId(data.job_id);
      if (data.status === 'failed') {
        message.error(data.error_message || t('characterStudio.editor.zoneEditFailed'));
        setNotifiedFailedJobId(data.job_id);
        setGeneratingImageType(null);
      } else {
        // Track this job so the completion handler can clear the zone.
        zoneEditJobRef.current = {jobId: data.job_id, imageType};
        // If backend already completed synchronously, clear immediately.
        if (data.status === 'completed') {
          setSavedZones((prev) => {
            const next = {...prev};
            delete next[imageType];
            return next;
          });
          zoneEditJobRef.current = null;
          setZoneEditOpen(false);
        }
      }
    } catch {
      message.error(t('characterStudio.editor.zoneEditError'));
      setGeneratingImageType(null);
    } finally {
      setZoneEditSubmitting(false);
    }
  };

  const apply = async (variant: CharacterVariant) => {
    if (!character || applyingVariantRef.current) return;
    applyingVariantRef.current = true;
    try {
      const imageType = pendingPrimaryImageType ?? viewModeToImageType(activeViewMode);
      const secondaryTypes = [...pendingSecondaryTypes];
      const appliedRevision = await characterApi.applyVariant(
        projectId,
        character.character_id,
        variant.variant_id,
        `Применен вариант ${variant.region}`,
        imageType,
      );
      const revisionId = appliedRevision.data?.revision_id;
      message.success(t('characterStudio.editor.variantApplied'));
      if (revisionId) {
        for (const secondaryType of secondaryTypes) {
          await launchSecondaryJob(secondaryType, revisionId);
        }
      } else if (secondaryTypes.length) {
        message.error(t('characterStudio.editor.generationError'));
      }
      setPendingPrimaryImageType(null);
      setPendingSecondaryTypes([]);
      setSelectedVariant(null);
      try {
        await refreshAndResync();
      } catch {
        message.warning(t('characterStudio.editor.generationError'));
      }
    } catch {
      message.error(t('characterStudio.editor.generationError'));
    } finally {
      applyingVariantRef.current = false;
    }
  };

  const deleteCurrentCharacter = async () => {
    if (!character) return;
    const confirmed = await confirmDeleteCharacter(character.name);
    if (!confirmed) return;

    await characterApi.delete(projectId, character.character_id);
    notifyCharacterDeleted(character.character_id);
    notifyCharacterListUpdated();
    notifyCharacterTreeUpdated();
    message.success(t('characterStudio.editor.characterDeleted'));
    setCharacter(null);
    navigate(`/project/${projectId}/characters`, {replace: true});
  };

  const save = async () => {
    if (!character) return;

    setSaving(true);
    try {
      const persisted = await persistAllEdits();
      if (!persisted.saved) {
        message.error(t('characterStudio.editor.saveGeneric'));
        return;
      }
      notifyCharacterListUpdated();
      notifyCharacterTreeUpdated();
      if (persisted.fullySaved) {
        message.success(t('characterStudio.editor.changesSaved'));
      } else {
        message.info(t('characterStudio.editor.changesUnsaved'));
      }
    } finally {
      setSaving(false);
    }
  };

  const markDirty = () => {
    editRevisionRef.current += 1;
    setHasUnsavedChanges(true);
  };

  const updateControls = (value: Record<string, unknown>) => {
    editor.setControls(value);
    markDirty();
  };

  const updatePersonality = (updates: Partial<StudioCharacter>) => {
    setPersonalityEdits((prev) => ({...prev, ...updates}));
    markDirty();
  };

  const handleOutfitDescriptionChange = (value: string) => {
    setOutfitDescription(value);
    markDirty();
  };

  const handleOutfitSourceChange = (value: 'reference' | 'text') => {
    setOutfitSource(value);
    markDirty();
  };

  // Refresh character from backend and re-hydrate controls from the response.
  const refreshAndResync = async () => {
    if (!character?.character_id) return;
    const requestedEditRevision = editRevisionRef.current;
    const response = await characterApi.get(projectId, character.character_id);
    if (response?.data) {
      setCharacter(response.data);
      if (editRevisionRef.current === requestedEditRevision) {
        editor.setControls(controlsFromCharacter(response.data));
        setHydratedCharacterId(response.data.character_id);
      }
      return response.data as StudioCharacter;
    }
    return undefined;
  };
  persistControlsAndRefreshRef.current = async () => { await refreshAndResync(); };

  const generateSequential = async () => {
    if (!character || generatingImageType || sequentialRunning) return;
    if (!(await confirmGeneration(['portrait', 'full_body', 'scene']))) return;
    setSequentialRunning(true);

    const STEPS: Array<{type: CharacterImageType; region: CharacterRegion; label: string}> = [
      {type: 'portrait',  region: 'face',  label: 'Генерация портрета…'},
      {type: 'full_body', region: 'body',  label: 'Генерация full body…'},
      {type: 'scene',     region: 'style', label: 'Генерация сцены…'},
    ];

    const msgKey = 'seq-gen';

    const persisted = await persistAllEdits();
    let currentCharacter = persisted.character ?? character;

    const baseControls = controlsFromCharacter(currentCharacter);
    const diff = diffControls(baseControls, editor.controls);

    let appliedRevisionId: string | undefined;
    for (let stepIndex = 0; stepIndex < STEPS.length; stepIndex += 1) {
      const step = STEPS[stepIndex];
      message.loading({content: step.label, key: msgKey, duration: 0});
      setGeneratingImageType(step.type);
      try {
        const activeImage = currentCharacter.images?.[step.type];
        let idempotencyKey: string | undefined;
        if (stepIndex > 0) {
          if (!appliedRevisionId) {
            throw new Error('Applied revision is required for secondary generation.');
          }
          idempotencyKey = `${characterId}:${step.type}:${appliedRevisionId}`;
        }
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
          activate_image: false,
        }, idempotencyKey);

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

        if (!variants.length) {
          throw new Error('Generation completed without a variant to apply.');
        }
        const appliedRevision = await characterApi.applyVariant(
          projectId, characterId, variants[0].variant_id,
          `Обновить: ${step.type}`, step.type,
        );
        appliedRevisionId = appliedRevision.data?.revision_id;
        if (stepIndex < STEPS.length - 1 && !appliedRevisionId) {
          throw new Error('Apply response did not include a revision id.');
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
    message.success(t('characterStudio.editor.allImagesUpdated'));
    setSequentialRunning(false);
    refresh();
  };

  const selectCategory = (key: string) => {
    setActiveTab(key);
    if (key === 'face' || key === 'hair') {
      setActiveViewMode('portrait');
    } else if (key === 'body' || key === 'outfit') {
      setActiveViewMode('fullBody');
    }
    // 'style' (Настройки) and 'personality' are visual-mode-agnostic — keep current mode.
    if (['face', 'hair', 'body', 'outfit', 'style'].includes(key)) {
      editor.setRegion(key as CharacterRegion);
    }
    if (key === 'personality') {
      editor.setRegion('full_character');
    }
  };

  const selectViewMode = (mode: CharacterViewMode) => {
    setActiveViewMode(mode);
    // Scene is always paired with the settings category — the panel only makes
    // sense in that slot. For portrait/full_body, we keep whatever category the
    // user already had selected so toggling between portrait <-> full body
    // doesn't yank them away from "Настройки" if that's what they were on.
    if (mode === 'scene') {
      setActiveTab('style');
      editor.setRegion('style');
      return;
    }
    if (mode === 'portrait' && !['face', 'hair', 'style'].includes(activeTab)) {
      setActiveTab('face');
      editor.setRegion('face');
    }
    if (mode === 'fullBody' && !['body', 'outfit', 'style'].includes(activeTab)) {
      setActiveTab('body');
      editor.setRegion('body');
    }
  };

  const goToReferences = () => {
    if (!character?.character_id) {
      message.warning(t('characterStudio.editor.saveBeforeReferences'));
      return;
    }
    navigate(`/project/${projectId}/characters/${character.character_id}/references`);
  };

  const currentImageType = viewModeToImageType(activeViewMode);
  const jobImageType = job?.request_payload?.image_type as CharacterImageType | undefined;
  const previewVariant = !jobImageType || jobImageType === currentImageType ? selectedVariant : null;

  const effectiveCharacter = character ? {...character, ...personalityEdits} : character;

  // "Настройки" (left category 'style') has a single render path regardless of
  // the visual mode. Scene mode is also always rendered through this path,
  // because selectViewMode('scene') pins activeTab='style' — keeping the two
  // entry-points unified avoids the old desync where Scene tab and the
  // sidebar 'Настройки' opened different panels.
  const right = activeTab === 'style' || activeViewMode === 'scene'
    ? <SettingsPanel
        activeViewMode={activeViewMode}
        sceneSettings={sceneSettings}
        onSceneChange={setSceneSettings}
        styleControls={editor.controls}
        onStyleControlsChange={updateControls}
        textRefinement={editor.textRefinement}
        onTextRefinementChange={editor.setTextRefinement}
      />
    : activeViewMode === 'fullBody' && activeTab === 'outfit'
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
    : activeTab === 'personality'
      ? effectiveCharacter
        ? <PersonalityEditorPanel character={effectiveCharacter} onChange={updatePersonality} />
        : null
      : <CharacterSettingsPanel region={(['face', 'hair', 'body'].includes(activeTab) ? activeTab : 'face') as CharacterRegion} controls={editor.controls} onControlsChange={updateControls} textRefinement={editor.textRefinement} onTextRefinementChange={editor.setTextRefinement} />;

  return <CharacterEditorLayout
    topBar={<EditorTopBar characterName={character?.name || t('characterStudio.editor.tipsCharacter')} onBack={() => navigate(`/project/${projectId}/characters`)} onRename={() => message.info(t('characterStudio.editor.renameHint'))} onRefresh={generateSequential} sequentialRunning={sequentialRunning} generatingImageType={generatingImageType} onSave={save} onDelete={deleteCurrentCharacter} saving={saving} hasUnsavedChanges={hasUnsavedChanges} onGoToReferences={goToReferences} />}
    sidebar={<CharacterCategorySidebar active={activeTab} onSelect={selectCategory} />}
    center={<div className="character-editor-center"><CharacterPreview character={character} selectedVariant={previewVariant} activeViewMode={activeViewMode} onViewModeChange={selectViewMode} onGenerateImage={generate} generatingImageType={generatingImageType} jobProgress={job?.progress} secondaryJobs={secondaryJobs} onRetrySecondary={retrySecondaryJob} zoneEditOpen={zoneEditOpen} onZoneEditToggle={setZoneEditOpen} onZoneEditApply={applyZoneEdit} zoneEditSubmitting={zoneEditSubmitting} savedZone={savedZones[currentImageTypeForZone] ?? null} onZoneSave={handleZoneSave} pendingZoneCount={Object.keys(savedZones).length} />{job?.variants && (!jobImageType || jobImageType === currentImageType) && !zoneEditOpen && <div className="character-side-card"><VariantGrid variants={job.variants} selectedVariantId={selectedVariant?.variant_id} onSelect={setSelectedVariant} onApply={apply} /></div>}</div>}
    right={right}
  />;
}

function EditorTopBar({characterName, onBack, onRename, onRefresh, sequentialRunning, generatingImageType, onSave, onDelete, saving, hasUnsavedChanges, onGoToReferences}: {characterName: string; onBack: () => void; onRename: () => void; onRefresh: () => void; sequentialRunning: boolean; generatingImageType: CharacterImageType | null; onSave: () => void; onDelete: () => void; saving: boolean; hasUnsavedChanges: boolean; onGoToReferences: () => void}) {
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
        <Button className="character-editor-button character-editor-button--outline" icon={<ReloadOutlined />} loading={sequentialRunning} disabled={!!generatingImageType && !sequentialRunning} onClick={onRefresh}>Обновить</Button>
        <Button className="character-editor-button character-editor-button--danger" icon={<DeleteOutlined />} onClick={onDelete}>Удалить</Button>
        <Button className="character-editor-button character-editor-button--primary" icon={<SaveOutlined />} loading={saving} onClick={onSave}>Сохранить</Button>
        <Button className="character-editor-button character-editor-button--outline" onClick={onGoToReferences}>Перейти к референсам</Button>
      </div>
    </>
  );
}

function FullBodySettingsPanel() {
  return (
    <ModeSettingsPanel eyebrow="Контекстная панель" title="Настройки: Тело">
      <SettingsSection title="Поза" primary>
        <PresetGrid items={['Нейтральная', 'Уверенная', 'Расслабленная', 'Динамичная']} activeIndex={0} />
      </SettingsSection>
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

function SettingsPanel({
  activeViewMode,
  sceneSettings,
  onSceneChange,
  styleControls,
  onStyleControlsChange,
  textRefinement,
  onTextRefinementChange,
}: {
  activeViewMode: CharacterViewMode;
  sceneSettings: {location: string; time: string; weather: string};
  onSceneChange: (s: {location: string; time: string; weather: string}) => void;
  styleControls: Record<string, unknown>;
  onStyleControlsChange: (value: Record<string, unknown>) => void;
  textRefinement: string;
  onTextRefinementChange: (value: string) => void;
}) {
  if (activeViewMode === 'scene') {
    return <SceneSettingsPanel settings={sceneSettings} onChange={onSceneChange} />;
  }
  return (
    <CharacterSettingsPanel
      region="style"
      controls={styleControls}
      onControlsChange={onStyleControlsChange}
      textRefinement={textRefinement}
      onTextRefinementChange={onTextRefinementChange}
    />
  );
}

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

