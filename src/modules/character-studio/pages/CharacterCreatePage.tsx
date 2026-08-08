import React, {useEffect, useMemo, useState} from 'react';
import {Button, Form, message} from 'antd';
import {useTranslation} from 'react-i18next';
import {useLocation, useNavigate, useSearchParams} from 'react-router-dom';
import {v4 as uuidv4} from 'uuid';
import {characterApi} from '../api/characterApi';
import AppearanceDescriptionSection from '../components/create/AppearanceDescriptionSection';
import BasicInformationSection from '../components/create/BasicInformationSection';
import CharacterCreateHeader from '../components/create/CharacterCreateHeader';
import {CharacterCreateMode} from '../components/create/CharacterCreateTabs';
import GenerationSettingsPanel, {defaultGenerationOptions, GenerationOptions} from '../components/create/GenerationSettingsPanel';
import PersonalitySection from '../components/create/PersonalitySection';
import TipsPanel from '../components/create/TipsPanel';
import VisualStyleSelector, {VisualStyleValue} from '../components/create/VisualStyleSelector';
import {useProjectIdFromRoute} from '../hooks/useProjectIdFromRoute';
import {characterVariantsPath} from '../../../routes/pathConstant';
import {characterToFormValues, CharacterCreateFormValues} from '../types/characterForm';
import {CreateCharacterFromReferenceContent} from './CreateCharacterFromReferencePage';
import './CharacterCreatePage.css';


interface CharacterCreatePageProps {
  activeMode?: CharacterCreateMode;
}

interface GenerationRetryContext {
  formValues: CharacterCreateFormValues;
  generationPayload: Record<string, unknown>;
  sourceTreeNodeId: string;
  characterName: string;
}

// State passed back from CharacterVariantsPage when user clicks "Изменить параметры"
interface CharacterCreateReturnState {
  formValues?: CharacterCreateFormValues;
  characterId?: string;
  sourceTreeNodeId?: string;
  generationOptions?: GenerationOptions;
}

export default function CharacterCreatePage({activeMode = 'description'}: CharacterCreatePageProps) {
  const {t} = useTranslation();
  const subtitle = activeMode === 'description'
    ? t('characterStudio.create.descriptionMode')
    : t('characterStudio.create.referenceMode');
  return (
    <div className="character-create-page">
      <div className="character-create-page__inner">
        <CharacterCreateHeader activeMode={activeMode} subtitle={subtitle} />
        <div className="character-create-content">
          {activeMode === 'description' ? <CreateCharacterFromDescriptionContent /> : <CreateCharacterFromReferenceContent />}
        </div>
      </div>
    </div>
  );
}

function CreateCharacterFromDescriptionContent() {
  const projectId = useProjectIdFromRoute();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const {t} = useTranslation();

  const routeState = location.state as (CharacterCreateReturnState & {initialCharacterName?: string; sourceTreeNodeId?: string}) | null;

  // URL values survive refresh; navigation state only accelerates the normal in-app flow.
  const returnFormValues = routeState?.formValues;
  const returnedCharacterId = searchParams.get('draftId') ?? routeState?.characterId ?? undefined;
  const initialSourceTreeNodeId = searchParams.get('treeNodeId') ?? routeState?.sourceTreeNodeId ?? null;
  const initialCharacterName = returnFormValues?.name ?? routeState?.initialCharacterName;

  const [form] = Form.useForm<CharacterCreateFormValues>();
  const [saving, setSaving] = useState(false);
  const [draftCharacterId, setDraftCharacterId] = useState<string | undefined>(returnedCharacterId);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [retryContext, setRetryContext] = useState<GenerationRetryContext | null>(null);
  const [generationOptions, setGenerationOptions] = useState<GenerationOptions>(
    routeState?.generationOptions ?? defaultGenerationOptions,
  );
  const [visualStyle, setVisualStyle] = useState<VisualStyleValue>(
    (returnFormValues?.visual_style as VisualStyleValue | undefined) ?? 'cinematic_realism',
  );
  const characterName = Form.useWatch('name', form);
  const characterType = Form.useWatch('character_type', form);
  const appearanceDescription = Form.useWatch('appearance_description', form);
  const canGenerate = useMemo(
    () => Boolean((characterName || '').trim() && characterType && (appearanceDescription || '').trim()),
    [appearanceDescription, characterName, characterType],
  );

  // Restore either navigation-state values or a durable draft referenced by the URL.
  useEffect(() => {
    let cancelled = false;
    if (returnFormValues) {
      form.setFieldsValue(returnFormValues);
      if (returnFormValues.visual_style) {
        setVisualStyle(returnFormValues.visual_style as VisualStyleValue);
      }
      return () => { cancelled = true; };
    }
    if (returnedCharacterId) {
      if (form.getFieldValue('name')) return () => { cancelled = true; };
      characterApi.get(projectId, returnedCharacterId)
        .then((response) => {
          if (cancelled) return;
          const recoveredValues = characterToFormValues(response.data);
          form.setFieldsValue(recoveredValues);
          if (recoveredValues.visual_style) {
            setVisualStyle(recoveredValues.visual_style as VisualStyleValue);
          }
        })
        .catch(() => {
          if (!cancelled) message.error(t('characterStudio.create.draftLoadError'));
        });
    } else if (initialCharacterName) {
      form.setFieldValue('name', initialCharacterName);
    }
    return () => { cancelled = true; };
  }, [form, initialCharacterName, projectId, returnFormValues, returnedCharacterId, t]);

  const handleVisualStyleChange = (value: VisualStyleValue) => {
    setVisualStyle(value);
    form.setFieldsValue({visual_style: value});
  };

  const launchGeneration = async (characterId: string, context: GenerationRetryContext) => {
    const jobResponse = await characterApi.generateInitial(
      projectId,
      characterId,
      context.generationPayload,
      `character:${characterId}:portrait:attempt:${uuidv4()}`,
    );
    const jobId = jobResponse.data?.job_id;
    if (jobResponse.data?.status === 'failed') {
      throw new Error(jobResponse.data?.error_message || t('characterStudio.create.generationError'));
    }
    if (!jobId) {
      throw new Error(t('characterStudio.variants.noJobId'));
    }
    message.success(t('characterStudio.create.generatingPortraits'));
    navigate(characterVariantsPath(projectId, characterId, jobId, context.sourceTreeNodeId), {
      state: {
        formValues: context.formValues,
        sourceTreeNodeId: context.sourceTreeNodeId,
        characterName: context.characterName,
        generationOptions,
      },
    });
  };

  const save = async () => {
    let activeCharacterId = draftCharacterId;
    try {
      setSaving(true);
      setGenerationError(null);
      await form.validateFields(['name', 'character_type', 'appearance_description']);
      const values = form.getFieldsValue(true);
      const parsedAge = typeof values.age === 'number'
        ? values.age
        : typeof values.lifecycle_stage === 'string' && /^\d+$/.test(values.lifecycle_stage.trim())
          ? Number(values.lifecycle_stage.trim())
          : undefined;
      const payload = {
        ...values,
        name: values.name?.trim(),
        age: parsedAge,
        species: values.character_type || 'human',
        visual_style: values.visual_style || 'cinematic_realism',
      };

      if (activeCharacterId) {
        await characterApi.update(projectId, activeCharacterId, payload);
      } else {
        const response = await characterApi.create(projectId, payload);
        activeCharacterId = response.data.character_id;
        setDraftCharacterId(activeCharacterId);
      }

      if (!activeCharacterId) {
        throw new Error(t('characterStudio.create.draftIdMissing'));
      }

      const sourceTreeNodeId = initialSourceTreeNodeId || uuidv4();
      const durableContext = new URLSearchParams(searchParams);
      durableContext.set('draftId', activeCharacterId);
      durableContext.set('treeNodeId', sourceTreeNodeId);
      setSearchParams(durableContext, {replace: true, state: location.state});

      const context: GenerationRetryContext = {
        formValues: values,
        generationPayload: {
          variant_count: generationOptions.count,
          image_type: 'portrait',
          creativity: generationOptions.creativity,
          seed: generationOptions.lockSeed && generationOptions.seed ? Number(generationOptions.seed) : undefined,
          lock_seed: generationOptions.lockSeed,
          visual_style: payload.visual_style,
          text_refinement: payload.appearance_description,
          character_type: payload.character_type,
          age: payload.age,
          lifecycle_stage: payload.lifecycle_stage,
          body_structure: payload.body_structure,
          surface_material: payload.surface_material,
          special_features: payload.special_features,
          appearance_description: payload.appearance_description,
        },
        sourceTreeNodeId,
        characterName: payload.name || '',
      };
      setRetryContext(context);
      await launchGeneration(activeCharacterId, context);
    } catch (error) {
      const errorText = error instanceof Error && error.message
        ? error.message
        : t('characterStudio.create.generationError');
      if (activeCharacterId) {
        setGenerationError(errorText);
      } else {
        message.error(errorText);
      }
    } finally {
      setSaving(false);
    }
  };

  const retryGeneration = async () => {
    if (!draftCharacterId || !retryContext || saving) return;
    try {
      setSaving(true);
      setGenerationError(null);
      await launchGeneration(draftCharacterId, retryContext);
    } catch (error) {
      setGenerationError(error instanceof Error && error.message
        ? error.message
        : t('characterStudio.create.generationError'));
    } finally {
      setSaving(false);
    }
  };

  const continueWithDraft = () => {
    if (draftCharacterId) {
      navigate(`/project/${projectId}/characters/${draftCharacterId}/edit`);
    }
  };

  const deleteDraft = async () => {
    if (!draftCharacterId || saving) return;
    try {
      setSaving(true);
      await characterApi.delete(projectId, draftCharacterId);
      setDraftCharacterId(undefined);
      setRetryContext(null);
      setGenerationError(null);
      const durableContext = new URLSearchParams(searchParams);
      durableContext.delete('draftId');
      const retainedState = routeState ? {...routeState} : null;
      if (retainedState) delete retainedState.characterId;
      setSearchParams(durableContext, {replace: true, state: retainedState});
      message.success(t('characterStudio.create.draftDeleted'));
    } catch {
      message.error(t('characterStudio.create.draftDeleteError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      requiredMark={false}
      initialValues={{
        character_type: 'human',
        visual_style: 'cinematic_realism',
        role: 'main',
        gender: 'female',
        ...returnFormValues,
        name: initialCharacterName,
      }}
      className="character-create-form"
    >
      <div className="character-create-layout">
        <div className="character-create-main">
          <BasicInformationSection />
          <AppearanceDescriptionSection />
          <PersonalitySection />
          <Form.Item name="visual_style" hidden>
            <input type="hidden" />
          </Form.Item>
          <VisualStyleSelector value={visualStyle} onChange={handleVisualStyleChange} />

          {generationError && draftCharacterId && (
            <div className="character-create-generation-error" role="alert">
              <strong>{t('characterStudio.create.generationError')}</strong>
              <p>{generationError}</p>
              <div className="character-create-generation-error__actions">
                <Button onClick={retryGeneration} loading={saving}>
                  {t('characterStudio.create.retryGeneration')}
                </Button>
                <Button onClick={continueWithDraft} disabled={saving}>
                  {t('characterStudio.create.continueDraft')}
                </Button>
                <Button danger onClick={deleteDraft} disabled={saving}>
                  {t('characterStudio.create.deleteDraft')}
                </Button>
              </div>
            </div>
          )}

          <div className="character-create-actions">
            <div>
              <Button
                className="character-create-button character-create-button--primary"
                onClick={save}
                loading={saving}
                disabled={!canGenerate || saving}
              >
                {t('characterStudio.create.generateButton')}
              </Button>
            </div>
            <p>{t('characterStudio.create.afterGenerationHint')}</p>
          </div>
        </div>

        <aside className="character-create-side">
          <GenerationSettingsPanel value={generationOptions} onChange={setGenerationOptions} />
          <TipsPanel />
        </aside>
      </div>
    </Form>
  );
}
