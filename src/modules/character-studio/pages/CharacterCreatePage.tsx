import React, {useEffect, useMemo, useState} from 'react';
import {Button, Form, message} from 'antd';
import {useLocation, useNavigate} from 'react-router-dom';
import {v4 as uuidv4} from 'uuid';
import {createCharacterFromTreeAPI} from '../../../api/generation/characters/tree_structure';
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
import {CreateCharacterFromReferenceContent} from './CreateCharacterFromReferencePage';
import './CharacterCreatePage.css';

interface CharacterCreateFormValues {
  name?: string;
  character_type?: string;
  age?: number;
  lifecycle_stage?: string;
  gender?: string;
  role?: string;
  appearance_description?: string;
  body_structure?: string;
  surface_material?: string;
  special_features?: string;
  short_description?: string;
  personality_description?: string;
  backstory?: string;
  visual_style?: string;
}

interface CharacterCreatePageProps {
  activeMode?: CharacterCreateMode;
}

// State passed back from CharacterVariantsPage when user clicks "Изменить параметры"
interface CharacterCreateReturnState {
  formValues?: CharacterCreateFormValues;
  characterId?: string;
  sourceTreeNodeId?: string;
  generationOptions?: GenerationOptions;
}

const createModeSubtitles: Record<CharacterCreateMode, string> = {
  description: 'Опишите персонажа и сгенерируйте уникальные визуальные варианты.',
  reference: 'Создайте персонажа на основе референс-изображения. Мы извлечём ключевые черты и сохраним идентичность.',
};

export default function CharacterCreatePage({activeMode = 'description'}: CharacterCreatePageProps) {
  return (
    <div className="character-create-page">
      <div className="character-create-page__inner">
        <CharacterCreateHeader activeMode={activeMode} subtitle={createModeSubtitles[activeMode]} />
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

  const routeState = location.state as (CharacterCreateReturnState & {initialCharacterName?: string; sourceTreeNodeId?: string}) | null;

  // When navigating back from variants page, these carry the previous form values and draft character id
  const returnFormValues = routeState?.formValues;
  const existingCharacterId = routeState?.characterId;
  // sourceTreeNodeId from initial navigation OR preserved from a re-edit return
  const initialSourceTreeNodeId = routeState?.sourceTreeNodeId ?? null;
  const initialCharacterName = returnFormValues?.name ?? routeState?.initialCharacterName;

  const [form] = Form.useForm<CharacterCreateFormValues>();
  const [saving, setSaving] = useState(false);
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

  // Pre-fill form when returning from the variants page ("Изменить параметры" flow)
  useEffect(() => {
    if (returnFormValues) {
      form.setFieldsValue(returnFormValues);
      if (returnFormValues.visual_style) {
        setVisualStyle(returnFormValues.visual_style as VisualStyleValue);
      }
    } else if (initialCharacterName) {
      form.setFieldValue('name', initialCharacterName);
    }
  }, []); // intentionally runs only on mount to restore form state once

  const handleVisualStyleChange = (value: VisualStyleValue) => {
    setVisualStyle(value);
    form.setFieldsValue({visual_style: value});
  };

  const save = async () => {
    try {
      setSaving(true);
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

      let characterId: string;
      if (existingCharacterId) {
        // Re-edit flow: update the existing draft character instead of creating a new one
        await characterApi.update(projectId, existingCharacterId, payload);
        characterId = existingCharacterId;
      } else {
        const response = await characterApi.create(projectId, payload);
        characterId = response.data.character_id;
      }

      // Tree node creation and list notifications are deferred to handleContinue in CharacterVariantsPage
      // so that draft characters never appear in lists before the user confirms a variant.
      const sourceTreeNodeId = initialSourceTreeNodeId || uuidv4();

      const jobResponse = await characterApi.generateInitial(projectId, characterId, {
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
      });
      const jobId = jobResponse.data?.job_id;
      if (jobResponse.data?.status === 'failed') {
        message.error(jobResponse.data?.error_message || 'Персонаж создан, но генерация портретных вариантов не удалась');
        return;
      }
      message.success('Генерируем портретные варианты…');
      navigate(`/project/${projectId}/characters/${characterId}/variants`, {
        state: {
          jobId,
          formValues: values,
          characterId,
          sourceTreeNodeId,
          characterName: payload.name,
          generationOptions,
        },
      });
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

          <div className="character-create-actions">
            <div>
              <Button
                className="character-create-button character-create-button--primary"
                onClick={save}
                loading={saving}
                disabled={!canGenerate}
              >
                Сгенерировать
              </Button>
            </div>
            <p>После генерации вы сможете доработать персонажа в редакторе.</p>
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
