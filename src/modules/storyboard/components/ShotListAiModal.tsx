import {Alert, Button, Select} from 'antd';
import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';

import i18n from '../../../i18n';
import {craftModal} from '../../../theme/CraftModalHost';
import type {
  StoryboardShotListConfiguration,
  StoryboardShotListOptions,
} from '../model';

interface ShotListAiModalContentProps {
  options: StoryboardShotListOptions;
  onDecision: (configuration: StoryboardShotListConfiguration | null) => void;
}

function formatUsd(value: string): string {
  return new Intl.NumberFormat(i18n.language, {
    currency: 'USD',
    maximumFractionDigits: 6,
    minimumFractionDigits: 2,
    style: 'currency',
  }).format(Number(value));
}

function ShotListAiModalContent({
  onDecision,
  options,
}: ShotListAiModalContentProps) {
  const {t} = useTranslation();
  const firstAvailableModel = options.models.find(({available}) => available)?.id;
  const initialModel = options.models.some((model) => (
    model.id === options.defaultModel && model.available
  )) ? options.defaultModel : firstAvailableModel;
  const [modelId, setModelId] = useState(initialModel);
  const selectedModel = useMemo(
    () => options.models.find(({id}) => id === modelId),
    [modelId, options.models],
  );
  return (
    <div className="storyboard-ai-modal">
      <label className="storyboard-ai-modal__label" htmlFor="storyboard-shot-list-model">
        {t('storyboard.ai.modal.model')}
      </label>
      <Select
        aria-label={t('storyboard.ai.modal.model')}
        id="storyboard-shot-list-model"
        onChange={setModelId}
        options={options.models.map((model) => ({
          disabled: !model.available,
          label: model.available
            ? model.label
            : `${model.label} · ${model.unavailableReason
              ? t(`storyboard.ai.modal.unavailable.${model.unavailableReason}`)
              : t('storyboard.ai.modal.noModels')}`,
          value: model.id,
        }))}
        placeholder={t('storyboard.ai.modal.modelPlaceholder')}
        value={modelId}
      />

      {selectedModel ? (
        <div className="storyboard-ai-modal__estimate" aria-live="polite">
          <div>
            <span>{t('storyboard.ai.modal.estimatedCost')}</span>
            <strong>
              {selectedModel.estimatedCostUsd
                ? `≈ ${formatUsd(selectedModel.estimatedCostUsd)}`
                : t('storyboard.ai.modal.costUnavailable')}
            </strong>
          </div>
          <small>
            {t('storyboard.ai.modal.provider', {provider: selectedModel.provider})}
          </small>
          <small>
            {t('storyboard.ai.modal.tokenEstimate', {
              input: selectedModel.estimatedInputTokens,
              output: selectedModel.estimatedOutputTokens,
            })}
          </small>
          <small>{t('storyboard.ai.modal.costHint')}</small>
        </div>
      ) : (
        <Alert
          message={t('storyboard.ai.modal.noModels')}
          showIcon
          type="warning"
        />
      )}

      <div className="storyboard-ai-modal__actions">
        <Button
          className="craft-action-button craft-action-button--secondary"
          onClick={() => onDecision(null)}
        >
          {t('common.cancel')}
        </Button>
        <Button
          className="craft-action-button"
          disabled={!selectedModel?.available}
          onClick={() => selectedModel && onDecision({
            maxShots: options.maxShots,
            model: selectedModel.id,
          })}
          type="primary"
        >
          {t('storyboard.ai.modal.generate')}
        </Button>
      </div>
    </div>
  );
}

export function chooseShotListAiConfiguration(
  options: StoryboardShotListOptions,
  signal?: AbortSignal,
): Promise<StoryboardShotListConfiguration | null> {
  if (signal?.aborted) return Promise.resolve(null);

  return new Promise((resolve) => {
    let settled = false;
    let modal: ReturnType<typeof craftModal.confirm> | null = null;
    let removeAbortListener: () => void = () => undefined;
    const settle = (configuration: StoryboardShotListConfiguration | null) => {
      if (settled) return;
      settled = true;
      removeAbortListener();
      modal?.destroy();
      resolve(configuration);
    };
    const abort = () => settle(null);
    signal?.addEventListener('abort', abort, {once: true});
    removeAbortListener = () => {
      signal?.removeEventListener('abort', abort);
    };
    modal = craftModal.confirm({
      className: 'storyboard-ai-modal-shell',
      closable: true,
      content: (
        <ShotListAiModalContent
          onDecision={settle}
          options={options}
        />
      ),
      footer: null,
      icon: null,
      maskClosable: true,
      title: i18n.t('storyboard.ai.modal.title'),
      width: 640,
      onCancel: () => settle(null),
    });
    if (signal?.aborted) abort();
  });
}
