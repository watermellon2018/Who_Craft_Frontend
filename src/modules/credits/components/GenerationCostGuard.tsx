import {Modal} from 'antd';
import React, {useEffect, useMemo, useState} from 'react';
import i18n from '../../../i18n';

import type {
  GenerationCostEstimate,
  GenerationCostEstimateRequest,
} from '../../../api/generated/contracts';
import {getApiErrorMessage} from '../../../api/errors';
import {
  estimateGenerationCost,
  getGenerationRoutingMode,
  notifyCreditBalanceUpdated,
} from '../api/creditApi';
import {formatCreditAmount} from './CreditBalanceBadge';

export type GenerationCostIntent = GenerationCostEstimateRequest;

export const GENERATION_COST_MODAL_THEME = {
  className: 'generation-cost-modal',
  styles: {
    content: {
      background: 'var(--craft-surface-raised)',
      border: '1px solid var(--craft-border)',
      boxShadow: 'var(--craft-shadow-elevated)',
    },
  },
} as const;

export function formatGenerationCost(value: string): string {
  return formatCreditAmount(value, i18n.language);
}

function confirmation(estimate: GenerationCostEstimate): Promise<boolean> {
  if (Number(estimate.reservationAmount) <= 0) return Promise.resolve(true);
  return new Promise((resolve) => {
    Modal.confirm({
      ...GENERATION_COST_MODAL_THEME,
      title: i18n.t('credits.generation.confirmTitle'),
      content: (
        <div className="generation-cost-confirmation">
          <p>{i18n.t('credits.generation.confirmDescription')}</p>
          <dl>
            <div>
              <dt>{i18n.t('credits.generation.estimatedCost')}</dt>
              <dd>{formatGenerationCost(estimate.estimatedCost)} C</dd>
            </div>
            {estimate.routeCandidates.length > 1 && (
              <div>
                <dt>{i18n.t('credits.generation.maxWithFallback')}</dt>
                <dd>{formatGenerationCost(estimate.reservationAmount)} C</dd>
              </div>
            )}
            <div>
              <dt>{i18n.t('credits.generation.routingMode')}</dt>
              <dd>{i18n.t(`credits.routing.modes.${estimate.routingMode}.title`)}</dd>
            </div>
            <div>
              <dt>{i18n.t('credits.generation.balanceAfterReserve')}</dt>
              <dd>
                {formatGenerationCost(String(
                  Number(estimate.availableBalance) - Number(estimate.reservationAmount),
                ))} C
              </dd>
            </div>
          </dl>
          {estimate.routeCandidates.length > 1 && (
            <p className="generation-cost-confirmation__route">
              {i18n.t('credits.generation.fallbackRoute', {
                primary: estimate.routeCandidates[0].modelName,
                fallback: estimate.routeCandidates[1].modelName,
              })}
            </p>
          )}
          <small>{i18n.t('credits.generation.finalCostHint')}</small>
        </div>
      ),
      okText: i18n.t('credits.generation.confirm'),
      cancelText: i18n.t('common.cancel'),
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    });
  });
}

export async function confirmGenerationCost(
  intent: GenerationCostIntent,
): Promise<GenerationCostEstimate | null> {
  const estimate = await prepareGenerationCost(intent);
  if (!estimate) return null;
  return (await confirmation(estimate)) ? estimate : null;
}

export async function prepareGenerationCost(
  intent: GenerationCostIntent,
): Promise<GenerationCostEstimate | null> {
  let estimate: GenerationCostEstimate;
  try {
    estimate = await getGenerationCostEstimate(intent);
  } catch (error) {
    Modal.error({
      ...GENERATION_COST_MODAL_THEME,
      title: i18n.t('credits.generation.estimateErrorTitle'),
      content: getApiErrorMessage(error, i18n.t('credits.generation.estimateError')),
    });
    return null;
  }
  if (estimate.accountFrozen) {
    Modal.error({
      ...GENERATION_COST_MODAL_THEME,
      title: i18n.t('credits.frozen.title'),
      content: i18n.t('credits.frozen.generation'),
    });
    return null;
  }
  if (!estimate.sufficientBalance) {
    Modal.error({
      ...GENERATION_COST_MODAL_THEME,
      title: i18n.t('credits.generation.insufficientTitle'),
      content: i18n.t('credits.generation.insufficientDescription', {
        required: formatGenerationCost(estimate.reservationAmount),
        available: formatGenerationCost(estimate.availableBalance),
      }),
    });
    return null;
  }
  return estimate;
}

export function getGenerationCostEstimate(
  intent: GenerationCostIntent,
): Promise<GenerationCostEstimate> {
  return estimateGenerationCost({
    ...intent,
    routingMode: intent.routingMode ?? getGenerationRoutingMode(),
  });
}

export async function runApprovedGeneration<T>(
  estimate: GenerationCostEstimate,
  operation: (approvedEstimate: GenerationCostEstimate) => Promise<T>,
): Promise<T> {
  const result = await operation(estimate);
  notifyCreditBalanceUpdated();
  return result;
}

export async function runGenerationWithCredits<T>(
  intent: GenerationCostIntent,
  operation: (estimate: GenerationCostEstimate) => Promise<T>,
): Promise<T | undefined> {
  const estimate = await confirmGenerationCost(intent);
  if (!estimate) return undefined;
  return runApprovedGeneration(estimate, operation);
}

interface GenerationCostPreviewProps {
  intent: GenerationCostIntent;
  className?: string;
}

export const GenerationCostPreview: React.FC<GenerationCostPreviewProps> = ({
  intent,
  className = '',
}) => {
  const [estimate, setEstimate] = useState<GenerationCostEstimate | null>(null);
  const serializedIntent = useMemo(() => JSON.stringify(intent), [intent]);

  useEffect(() => {
    let active = true;
    void estimateGenerationCost({
      ...intent,
      routingMode: intent.routingMode ?? getGenerationRoutingMode(),
    }).then((result) => {
      if (active) setEstimate(result);
    }).catch(() => {
      if (active) setEstimate(null);
    });
    return () => {
      active = false;
    };
  }, [serializedIntent]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!estimate || Number(estimate.reservationAmount) <= 0) return null;
  return (
    <span
      className={`generation-cost-preview ${className}`.trim()}
      title={i18n.t('credits.generation.previewTitle', {
        amount: formatGenerationCost(estimate.reservationAmount),
      })}
    >
      ≈ {formatGenerationCost(estimate.estimatedCost)} C
    </span>
  );
};
