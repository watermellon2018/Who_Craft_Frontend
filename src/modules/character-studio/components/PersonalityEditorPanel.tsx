import React, {useState} from 'react';
import {Collapse, Form, Input, Select} from 'antd';
import {PlusOutlined, CloseOutlined} from '@ant-design/icons';
import {useTranslation} from 'react-i18next';
import {StudioCharacter} from '../types/character.types';

const ROLE_VALUES = ['main', 'secondary', 'antagonist', 'episodic', 'cameo'] as const;
const BEHAVIOR_VALUES = ['calm', 'aggressive', 'charismatic', 'introverted', 'impulsive', 'cautious', 'ironic', 'cold'] as const;
const SPEECH_STYLE_VALUES = ['neutral', 'formal', 'soft', 'sharp', 'sarcastic', 'reserved', 'emotional'] as const;

interface PersonalityEditorPanelProps {
  character: StudioCharacter;
  onChange: (updates: Partial<StudioCharacter>) => void;
}

export default function PersonalityEditorPanel({character, onChange}: PersonalityEditorPanelProps) {
  const {t} = useTranslation();
  const roleOptions = ROLE_VALUES.map((value) => ({value, label: t(`characterStudio.options.role.${value}`)}));
  const behaviorOptions = BEHAVIOR_VALUES.map((value) => ({value, label: t(`characterStudio.personality.behavior.${value}`)}));
  const speechStyleOptions = SPEECH_STYLE_VALUES.map((value) => ({value, label: t(`characterStudio.personality.speechStyle.${value}`)}));
  const personality = (character.personality || {}) as Record<string, unknown>;
  const traits = (personality.personality_traits as string[]) || [];
  const [newTrait, setNewTrait] = useState('');
  const [addingTrait, setAddingTrait] = useState(false);

  const updatePersonality = (key: string, value: unknown) => {
    onChange({
      personality: {
        ...personality,
        [key]: value,
      },
    });
  };

  const addTrait = () => {
    const trimmed = newTrait.trim();
    if (!trimmed) return;
    updatePersonality('personality_traits', [...traits, trimmed]);
    setNewTrait('');
    setAddingTrait(false);
  };

  const removeTrait = (index: number) => {
    updatePersonality('personality_traits', traits.filter((_, i) => i !== index));
  };

  return (
    <div className="character-settings-panel">
      <div className="character-settings-panel__header">
        <p>{t('characterStudio.editor.scenePanel.eyebrow')}</p>
        <h2>{t('characterStudio.personality.settingsTitle')}</h2>
      </div>
      <div className="character-settings-panel__body">

        {/* Блок 1: Основное */}
        <section className="character-settings-section character-settings-section--primary">
          <h3>{t('characterStudio.editor.bodyPanel.mainSection')}</h3>
          <Form layout="vertical">
            <Form.Item label={t('characterStudio.personality.role')}>
              <Select
                value={character.role || undefined}
                options={roleOptions}
                onChange={(v) => onChange({role: v})}
                placeholder={t('characterStudio.personality.rolePlaceholder')}
                popupClassName="character-editor-select-dropdown"
              />
            </Form.Item>
            <Form.Item label={t('characterStudio.personality.behaviorLabel')}>
              <Select
                value={(personality.behavior_type as string) || undefined}
                options={behaviorOptions}
                onChange={(v) => updatePersonality('behavior_type', v)}
                placeholder={t('characterStudio.personality.behaviorPlaceholder')}
                popupClassName="character-editor-select-dropdown"
              />
            </Form.Item>
          </Form>
        </section>

        {/* Блок 2: Черты характера */}
        <section className="character-settings-section">
          <h3>{t('characterStudio.personality.traits')}</h3>
          <div className="feature-chip-grid personality-traits-grid">
            {traits.map((trait, index) => (
              <span key={index} className="personality-trait-chip">
                {trait}
                <button
                  type="button"
                  className="personality-trait-chip__remove"
                  onClick={() => removeTrait(index)}
                  aria-label={t('characterStudio.personality.removeTrait', {trait})}
                >
                  <CloseOutlined />
                </button>
              </span>
            ))}
            {addingTrait ? (
              <Input
                size="small"
                value={newTrait}
                autoFocus
                placeholder={t('characterStudio.personality.traitPlaceholder')}
                onChange={(e) => setNewTrait(e.target.value)}
                onPressEnter={addTrait}
                onBlur={() => { addTrait(); if (!newTrait.trim()) setAddingTrait(false); }}
                style={{width: 140}}
              />
            ) : (
              <button
                type="button"
                className="personality-trait-add"
                onClick={() => setAddingTrait(true)}
              >
                <PlusOutlined /> {t('characterStudio.personality.addTrait')}
              </button>
            )}
          </div>
        </section>

        {/* Блок 3: Манера общения */}
        <section className="character-settings-section">
          <h3>{t('characterStudio.personality.communication')}</h3>
          <Form layout="vertical">
            <Form.Item label={t('characterStudio.personality.speechStyleLabel')}>
              <Select
                value={(personality.speech_style_type as string) || undefined}
                options={speechStyleOptions}
                onChange={(v) => updatePersonality('speech_style_type', v)}
                placeholder={t('characterStudio.personality.speechStylePlaceholder')}
                popupClassName="character-editor-select-dropdown"
              />
            </Form.Item>
            <Form.Item label={t('characterStudio.personality.speechDescription')}>
              <Input.TextArea
                value={character.speech_style || ''}
                onChange={(e) => onChange({speech_style: e.target.value})}
                placeholder={t('characterStudio.personality.speechDescriptionPlaceholder')}
                rows={3}
                maxLength={500}
              />
            </Form.Item>
          </Form>
        </section>

        {/* Блок 4: Поведение в сценах */}
        <Collapse
          className="character-settings-collapse"
          ghost
          items={[
            {
              key: 'scene_behavior',
              label: t('characterStudio.personality.sceneBehavior'),
              children: (
                <div className="character-collapse-content">
                  <Form layout="vertical">
                    <Form.Item label={t('characterStudio.personality.conflictReaction')}>
                      <Input.TextArea
                        value={(personality.conflict_reaction as string) || ''}
                        onChange={(e) => updatePersonality('conflict_reaction', e.target.value)}
                        placeholder={t('characterStudio.personality.conflictPlaceholder')}
                        rows={3}
                        maxLength={500}
                      />
                    </Form.Item>
                    <Form.Item label={t('characterStudio.personality.dangerReaction')}>
                      <Input.TextArea
                        value={(personality.danger_reaction as string) || ''}
                        onChange={(e) => updatePersonality('danger_reaction', e.target.value)}
                        placeholder={t('characterStudio.personality.dangerPlaceholder')}
                        rows={3}
                        maxLength={500}
                      />
                    </Form.Item>
                  </Form>
                </div>
              ),
            },
          ]}
        />

      </div>
    </div>
  );
}
