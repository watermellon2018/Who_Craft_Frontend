import React from 'react';

import i18n from '../../../i18n';
import {craftModal} from '../../../theme/CraftModalHost';
import {GenerationApproval} from '../../credits/components/GenerationCostGuard';
import {estimateGenerationSeconds, formatElapsedTime} from '../generationTiming';
import type {
  StoryboardShotListConfiguration,
  StoryboardShotListOptions,
} from '../model';

interface ShotListAiModalContentProps {
  options: StoryboardShotListOptions;
  onDecision: (configuration: StoryboardShotListConfiguration | null) => void;
}

function ShotListAiModalContent({onDecision, options}: ShotListAiModalContentProps) {
  return <GenerationApproval intent={{domain: 'text', operation: 'structured', modelKey: options.defaultModel}}
    platformModels={options.models.map((model) => ({value: model.id, label: model.label, disabled: !model.available}))}
    modelLabel={i18n.t('storyboard.ai.modal.model')} confirmLabel={i18n.t('storyboard.ai.modal.generate')}
    platformDetails={(estimate) => {
      const selected = options.models.find((model) => model.id === estimate.modelKey);
      if (!selected) return null;
      return <div className="storyboard-ai-modal__estimate" aria-live="polite">
        <div><span>{i18n.t('storyboard.ai.modal.estimatedCost')}</span><strong>
          {selected.estimatedCostUsd ? `≈ ${new Intl.NumberFormat(i18n.language, {
            currency: 'USD', maximumFractionDigits: 6, minimumFractionDigits: 2, style: 'currency',
          }).format(Number(selected.estimatedCostUsd))}` : i18n.t('storyboard.ai.modal.costUnavailable')}
        </strong></div>
        <small>{i18n.t('storyboard.ai.modal.provider', {provider: selected.provider})}</small>
        <small>{i18n.t('storyboard.ai.modal.tokenEstimate', {input: selected.estimatedInputTokens, output: selected.estimatedOutputTokens})}</small>
        <small>{i18n.t('storyboard.ai.modal.costHint')}</small>
        <small>{i18n.t('storyboard.ai.timing.estimate', {time: formatElapsedTime(estimateGenerationSeconds(selected))})}</small>
      </div>;
    }}
    onDecision={(estimate) => onDecision(estimate ? {
      maxShots: options.maxShots, model: estimate.modelKey, generationAccessToken: estimate.generationAccessToken, generationSource: estimate.generationSource,
    } : null)} />;
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
