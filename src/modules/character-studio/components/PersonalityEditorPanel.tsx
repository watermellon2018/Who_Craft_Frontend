import React, {useState} from 'react';
import {Collapse, Form, Input, Select} from 'antd';
import {PlusOutlined, CloseOutlined} from '@ant-design/icons';
import {StudioCharacter} from '../types/character.types';

const ROLE_OPTIONS = [
  {value: 'main', label: 'Главный герой'},
  {value: 'secondary', label: 'Второстепенный персонаж'},
  {value: 'antagonist', label: 'Антагонист'},
  {value: 'episodic', label: 'Эпизодический персонаж'},
  {value: 'cameo', label: 'Камео'},
];

const BEHAVIOR_TYPE_OPTIONS = [
  {value: 'calm', label: 'Спокойный, уверенный'},
  {value: 'aggressive', label: 'Агрессивный'},
  {value: 'charismatic', label: 'Харизматичный'},
  {value: 'introverted', label: 'Замкнутый'},
  {value: 'impulsive', label: 'Импульсивный'},
  {value: 'cautious', label: 'Осторожный'},
  {value: 'ironic', label: 'Ироничный'},
  {value: 'cold', label: 'Хладнокровный'},
];

const SPEECH_STYLE_OPTIONS = [
  {value: 'neutral', label: 'Нейтральный'},
  {value: 'formal', label: 'Формальный'},
  {value: 'soft', label: 'Мягкий'},
  {value: 'sharp', label: 'Резкий'},
  {value: 'sarcastic', label: 'Саркастичный'},
  {value: 'reserved', label: 'Сдержанный'},
  {value: 'emotional', label: 'Эмоциональный'},
];

interface PersonalityEditorPanelProps {
  character: StudioCharacter;
  onChange: (updates: Partial<StudioCharacter>) => void;
}

export default function PersonalityEditorPanel({character, onChange}: PersonalityEditorPanelProps) {
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
        <p>Контекстная панель</p>
        <h2>Настройки: Характер</h2>
      </div>
      <div className="character-settings-panel__body">

        {/* Блок 1: Основное */}
        <section className="character-settings-section character-settings-section--primary">
          <h3>Основное</h3>
          <Form layout="vertical">
            <Form.Item label="Роль персонажа">
              <Select
                value={character.role || undefined}
                options={ROLE_OPTIONS}
                onChange={(v) => onChange({role: v})}
                placeholder="Выберите роль"
                popupClassName="character-editor-select-dropdown"
              />
            </Form.Item>
            <Form.Item label="Тип поведения">
              <Select
                value={(personality.behavior_type as string) || undefined}
                options={BEHAVIOR_TYPE_OPTIONS}
                onChange={(v) => updatePersonality('behavior_type', v)}
                placeholder="Выберите тип поведения"
                popupClassName="character-editor-select-dropdown"
              />
            </Form.Item>
          </Form>
        </section>

        {/* Блок 2: Черты характера */}
        <section className="character-settings-section">
          <h3>Черты характера</h3>
          <div className="feature-chip-grid personality-traits-grid">
            {traits.map((trait, index) => (
              <span key={index} className="personality-trait-chip">
                {trait}
                <button
                  type="button"
                  className="personality-trait-chip__remove"
                  onClick={() => removeTrait(index)}
                  aria-label={`Удалить черту "${trait}"`}
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
                placeholder="Введите черту..."
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
                <PlusOutlined /> Добавить
              </button>
            )}
          </div>
        </section>

        {/* Блок 3: Манера общения */}
        <section className="character-settings-section">
          <h3>Манера общения</h3>
          <Form layout="vertical">
            <Form.Item label="Стиль речи">
              <Select
                value={(personality.speech_style_type as string) || undefined}
                options={SPEECH_STYLE_OPTIONS}
                onChange={(v) => updatePersonality('speech_style_type', v)}
                placeholder="Выберите стиль речи"
                popupClassName="character-editor-select-dropdown"
              />
            </Form.Item>
            <Form.Item label="Описание стиля речи">
              <Input.TextArea
                value={character.speech_style || ''}
                onChange={(e) => onChange({speech_style: e.target.value})}
                placeholder="Например: говорит короткими фразами, редко показывает эмоции, использует сухой юмор."
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
              label: 'Поведение в сценах',
              children: (
                <div className="character-collapse-content">
                  <Form layout="vertical">
                    <Form.Item label="Реакция на конфликт">
                      <Input.TextArea
                        value={(personality.conflict_reaction as string) || ''}
                        onChange={(e) => updatePersonality('conflict_reaction', e.target.value)}
                        placeholder="Например: сохраняет спокойствие, анализирует ситуацию, избегает ненужной агрессии."
                        rows={3}
                        maxLength={500}
                      />
                    </Form.Item>
                    <Form.Item label="Реакция на опасность">
                      <Input.TextArea
                        value={(personality.danger_reaction as string) || ''}
                        onChange={(e) => updatePersonality('danger_reaction', e.target.value)}
                        placeholder="Например: быстро оценивает угрозу, действует хладнокровно и расчетливо."
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
