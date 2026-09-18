import React, {useEffect} from 'react';
import {Input, Select} from 'antd';
import {ControlOutlined} from '@ant-design/icons';
import {useTranslation} from 'react-i18next';
import type {TFunction} from 'i18next';
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

const creativityOptions: Array<{value: GenerationCreativity; labelKey: string; descriptionKey: string}> = [
  {value: 'strict', labelKey: 'characterStudio.create.generation.strictLabel', descriptionKey: 'characterStudio.create.generation.strictDesc'},
  {value: 'balanced', labelKey: 'characterStudio.create.generation.balancedLabel', descriptionKey: 'characterStudio.create.generation.balancedDesc'},
  {value: 'creative', labelKey: 'characterStudio.create.generation.creativeLabel', descriptionKey: 'characterStudio.create.generation.creativeDesc'},
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

function getUnavailableReason(model: ImageModelCatalogEntry, operation: 'generate' | 'reference', t: TFunction) {
  if (!model.configured) return t('characterStudio.create.generation.providerNotConfigured');
  if (!model.supports_generate) return t('characterStudio.create.generation.generateUnsupported');
  if (operation === 'reference' && !model.supports_reference) {
    return t('characterStudio.create.generation.referenceUnsupported');
  }
  return null;
}

function getCapabilityHint(model: ImageModelCatalogEntry, t: TFunction) {
  const capabilities = [t('characterStudio.create.generation.capabilities.generate')];
  if (model.supports_reference) capabilities.push(t('characterStudio.create.generation.capabilities.reference'));
  if (model.supports_edit) capabilities.push(t('characterStudio.create.generation.capabilities.edit'));
  if (supportsSeed(model)) capabilities.push('seed');
  return capabilities.join(' · ');
}

export default function GenerationSettingsPanel({
  value,
  onChange,
  operation = 'generate',
  projectId,
}: GenerationSettingsPanelProps) {
  const {t} = useTranslation();
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
    ? t('characterStudio.create.generation.seedUnsupported')
    : catalogLoading
      ? t('characterStudio.create.generation.seedLoading')
      : t('characterStudio.create.generation.seedUnknown');

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
          <h2>{t('characterStudio.create.generation.title')}</h2>
        </div>
      </div>

      <div className="generation-settings-panel__body">
        <GenerationSettingGroup title={t('characterStudio.create.generation.modelLabel')}>
          <Select<string>
            aria-label={t('characterStudio.create.generation.modelLabel')}
            className="generation-model-select"
            loading={catalogLoading}
            optionFilterProp="label"
            optionLabelProp="label"
            popupClassName="character-studio-dropdown generation-model-dropdown"
            showSearch
            value={value.imageModel}
            onChange={handleModelChange}
          >
            <Select.Option value="" label={t('characterStudio.create.generation.autoModel')}>
              <div className="generation-model-option">
                <strong>{t('characterStudio.create.generation.autoModel')}</strong>
                <span>{t('characterStudio.create.generation.autoModelHint')}</span>
              </div>
            </Select.Option>
            {catalog?.available.map((model) => {
              const unavailableReason = getUnavailableReason(model, operation, t);
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
                      {unavailableReason ?? `${getProviderLabel(model)} · ${getCapabilityHint(model, t)}`}
                    </span>
                  </div>
                </Select.Option>
              );
            })}
          </Select>

          {catalogLoading && (
            <p className="generation-model-status" role="status">{t('characterStudio.create.generation.modelsLoading')}</p>
          )}
          {catalogError && (
            <p className="generation-model-status generation-model-status--warning" role="status">
              {t('characterStudio.create.generation.modelsUnavailable')}
            </p>
          )}
        </GenerationSettingGroup>

        <GenerationSettingGroup title={t('characterStudio.create.generation.countLabel')}>
          <div className="generation-segmented" role="group" aria-label={t('characterStudio.create.generation.countLabel')}>
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

        <GenerationSettingGroup title={t('characterStudio.create.generation.accuracyLabel')}>
          <div className="generation-creativity-options" role="group" aria-label={t('characterStudio.create.generation.accuracyLabel')}>
            {creativityOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={value.creativity === option.value ? 'is-active' : ''}
                onClick={() => update({creativity: option.value})}
              >
                <strong>{t(option.labelKey)}</strong>
                <span>{t(option.descriptionKey)}</span>
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
            <strong>{t('characterStudio.create.generation.seedLock')}</strong>
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
                placeholder={t('characterStudio.create.generation.seedPlaceholder')}
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
