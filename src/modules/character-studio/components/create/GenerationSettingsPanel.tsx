import React from 'react';
import {Input} from 'antd';
import {ControlOutlined} from '@ant-design/icons';

export type GenerationCreativity = 'strict' | 'balanced' | 'creative';

export interface GenerationOptions {
  count: 1 | 2 | 4;
  creativity: GenerationCreativity;
  lockSeed: boolean;
  seed?: string;
}

interface GenerationSettingsPanelProps {
  value: GenerationOptions;
  onChange: (value: GenerationOptions) => void;
}

const countOptions: Array<GenerationOptions['count']> = [1, 2, 4];

const creativityOptions: Array<{value: GenerationCreativity; label: string; description: string}> = [
  {value: 'strict', label: 'Строго', description: 'Максимально близко к описанию'},
  {value: 'balanced', label: 'Сбалансировано', description: 'Точный образ с небольшой вариативностью'},
  {value: 'creative', label: 'Креативно', description: 'Больше художественных решений'},
];

export const defaultGenerationOptions: GenerationOptions = {
  count: 1,
  creativity: 'balanced',
  lockSeed: false,
  seed: '',
};

export default function GenerationSettingsPanel({value, onChange}: GenerationSettingsPanelProps) {
  const update = (changes: Partial<GenerationOptions>) => onChange({...value, ...changes});

  return (
    <section className="create-side-card generation-settings-panel">
      <div className="create-side-card__header generation-settings-panel__header">
        <span className="generation-settings-panel__icon">
          <ControlOutlined />
        </span>
        <div>
          <h2>Параметры генерации</h2>
          <p>Настройте количество вариантов и поведение генерации перед созданием персонажа.</p>
        </div>
      </div>

      <div className="generation-settings-panel__body">
        <GenerationSettingGroup title="Количество вариантов">
          <div className="generation-segmented" role="group" aria-label="Количество вариантов">
            {countOptions.map((count) => (
              <button
                key={count}
                type="button"
                className={value.count === count ? 'is-active' : ''}
                onClick={() => update({count})}
              >
                {count}
              </button>
            ))}
          </div>
        </GenerationSettingGroup>

        <GenerationSettingGroup title="Точность следования описанию">
          <div className="generation-creativity-options" role="group" aria-label="Точность следования описанию">
            {creativityOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={value.creativity === option.value ? 'is-active' : ''}
                onClick={() => update({creativity: option.value})}
              >
                <strong>{option.label}</strong>
                <span>{option.description}</span>
              </button>
            ))}
          </div>
        </GenerationSettingGroup>

        <GenerationSettingGroup title="Seed">
          <label className="generation-toggle">
            <input
              type="checkbox"
              checked={value.lockSeed}
              onChange={(event) => update({lockSeed: event.target.checked, seed: event.target.checked ? value.seed : ''})}
            />
            <span />
            <strong>Зафиксировать результат</strong>
          </label>

          {value.lockSeed && (
            <div className="generation-seed-field">
              <label htmlFor="generation-seed-input">Seed</label>
              <Input
                id="generation-seed-input"
                className="generation-seed-input"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                value={value.seed || ''}
                placeholder="Например: 184205"
                onChange={(event) => update({seed: event.target.value.replace(/\D/g, '')})}
              />
            </div>
          )}
        </GenerationSettingGroup>
      </div>
    </section>
  );
}

function GenerationSettingGroup({title, children}: {title: string; children: React.ReactNode}) {
  return (
    <section className="generation-setting-group">
      <h3>{title}</h3>
      {children}
    </section>
  );
}
