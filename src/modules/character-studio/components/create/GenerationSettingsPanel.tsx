import React, {useEffect} from 'react';
import {Input, Select} from 'antd';
import {ControlOutlined} from '@ant-design/icons';
import {useImageModelCatalog} from '../../hooks/useImageModelCatalog';
import type {ImageModelCatalogEntry} from '../../types/character.types';

export type GenerationCreativity = 'strict' | 'balanced' | 'creative';

export interface GenerationOptions {
  count: 1 | 2 | 4;
  creativity: GenerationCreativity;
  imageModel: string;
  lockSeed: boolean;
  seed?: string;
}

interface GenerationSettingsPanelProps {
  value: GenerationOptions;
  onChange: (value: GenerationOptions) => void;
  operation?: 'generate' | 'reference';
  projectId: string | number;
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
  imageModel: '',
  lockSeed: false,
  seed: '',
};

const providerLabels: Record<string, string> = {
  'gemini-native': 'Google',
  google: 'Google',
  openai: 'OpenAI',
  openrouter: 'OpenRouter',
};

function supportsSeed(model: ImageModelCatalogEntry) {
  return 'seed' in model.supported_parameters;
}

function getProviderLabel(model: ImageModelCatalogEntry) {
  if (model.key.startsWith('openrouter-images:') || model.model_id.startsWith('openrouter/')) {
    return 'OpenRouter';
  }
  if (model.model_id.startsWith('gemini/') || model.model_id.startsWith('imagen-')) {
    return 'Google';
  }
  return providerLabels[model.backend] ?? model.backend;
}

function getUnavailableReason(model: ImageModelCatalogEntry, operation: 'generate' | 'reference') {
  if (!model.configured) return 'Провайдер не настроен';
  if (!model.supports_generate) return 'Не поддерживает генерацию';
  if (operation === 'reference' && !model.supports_reference) {
    return 'Не поддерживает работу с референсом';
  }
  return null;
}

function getCapabilityHint(model: ImageModelCatalogEntry) {
  const capabilities = ['генерация'];
  if (model.supports_reference) capabilities.push('референсы');
  if (model.supports_edit) capabilities.push('редактирование');
  if (supportsSeed(model)) capabilities.push('seed');
  return capabilities.join(' · ');
}

export default function GenerationSettingsPanel({
  value,
  onChange,
  operation = 'generate',
  projectId,
}: GenerationSettingsPanelProps) {
  const {catalog, error: catalogError, loading: catalogLoading} = useImageModelCatalog(projectId);
  const update = (changes: Partial<GenerationOptions>) => onChange({...value, ...changes});
  const explicitModel = value.imageModel
    ? catalog?.available.find((model) => model.key === value.imageModel)
    : undefined;
  const selectedModel = explicitModel ?? (
    value.imageModel ? undefined : catalog?.available.find((model) => model.key === catalog.current)
  );
  const selectedModelSupportsSeed = Boolean(selectedModel && supportsSeed(selectedModel));
  const seedUnavailableHint = selectedModel
    ? 'Выбранная модель не поддерживает seed.'
    : catalogLoading
      ? 'Seed будет доступен после загрузки каталога моделей.'
      : 'Не удалось определить поддержку seed для выбранной модели.';

  useEffect(() => {
    if (!selectedModelSupportsSeed && (value.lockSeed || value.seed)) {
      onChange({...value, lockSeed: false, seed: ''});
    }
  }, [onChange, selectedModelSupportsSeed, value]);

  const handleModelChange = (imageModel: string) => {
    const nextModel = imageModel
      ? catalog?.available.find((model) => model.key === imageModel)
      : catalog?.available.find((model) => model.key === catalog.current);
    if (!nextModel || !supportsSeed(nextModel)) {
      update({imageModel, lockSeed: false, seed: ''});
      return;
    }
    update({imageModel});
  };

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
        <GenerationSettingGroup title="Модель изображения">
          <Select<string>
            aria-label="Модель изображения"
            className="generation-model-select"
            loading={catalogLoading}
            optionFilterProp="label"
            optionLabelProp="label"
            popupClassName="character-studio-dropdown generation-model-dropdown"
            showSearch
            value={value.imageModel}
            onChange={handleModelChange}
          >
            <Select.Option value="" label="Авто — настройки проекта">
              <div className="generation-model-option">
                <strong>Авто — настройки проекта</strong>
                <span>Использовать модель, выбранную для проекта или профиля</span>
              </div>
            </Select.Option>
            {catalog?.available.map((model) => {
              const unavailableReason = getUnavailableReason(model, operation);
              return (
                <Select.Option
                  key={model.key}
                  value={model.key}
                  label={model.label}
                  disabled={Boolean(unavailableReason)}
                >
                  <div className="generation-model-option">
                    <strong>{model.label}</strong>
                    <span>
                      {unavailableReason ?? `${getProviderLabel(model)} · ${getCapabilityHint(model)}`}
                    </span>
                  </div>
                </Select.Option>
              );
            })}
          </Select>

          {catalogLoading && (
            <p className="generation-model-status" role="status">Загружаем доступные модели…</p>
          )}
          {catalogError && (
            <p className="generation-model-status generation-model-status--warning" role="status">
              Каталог моделей временно недоступен. Автовыбор продолжит работать.
            </p>
          )}
          {selectedModel && (
            <div className="generation-model-details">
              <strong>
                {value.imageModel ? selectedModel.label : `Авто: ${selectedModel.label}`}
              </strong>
              {selectedModel.description && <p>{selectedModel.description}</p>}
              <span>
                {getProviderLabel(selectedModel)} · {getCapabilityHint(selectedModel)}
              </span>
            </div>
          )}
        </GenerationSettingGroup>

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
          <label className={`generation-toggle ${selectedModelSupportsSeed ? '' : 'is-disabled'}`}>
            <input
              type="checkbox"
              checked={value.lockSeed}
              disabled={!selectedModelSupportsSeed}
              onChange={(event) => update({lockSeed: event.target.checked, seed: event.target.checked ? value.seed : ''})}
            />
            <span />
            <strong>Зафиксировать результат</strong>
          </label>

          {!selectedModelSupportsSeed && (
            <p className="generation-seed-hint">{seedUnavailableHint}</p>
          )}

          {value.lockSeed && selectedModelSupportsSeed && (
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
