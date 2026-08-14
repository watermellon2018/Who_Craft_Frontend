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

function costLabel(value: string): string {
  return formatCreditAmount(value, i18n.language);
}

function confirmation(estimate: GenerationCostEstimate): Promise<boolean> {
  if (Number(estimate.reservationAmount) <= 0) return Promise.resolve(true);
  return new Promise((resolve) => {
    Modal.confirm({
      title: i18n.t('credits.generation.confirmTitle'),
      content: (
        <div className="generation-cost-confirmation">
          <p>{i18n.t('credits.generation.confirmDescription')}</p>
          <dl>
            <div>
              <dt>{i18n.t('credits.generation.estimatedCost')}</dt>
              <dd>{costLabel(estimate.estimatedCost)} C</dd>
            </div>
            {estimate.routeCandidates.length > 1 && (
              <div>
                <dt>{i18n.t('credits.generation.maxWithFallback')}</dt>
                <dd>{costLabel(estimate.reservationAmount)} C</dd>
              </div>
            )}
            <div>
              <dt>{i18n.t('credits.generation.routingMode')}</dt>
              <dd>{i18n.t(`credits.routing.modes.${estimate.routingMode}.title`)}</dd>
            </div>
            <div>
              <dt>{i18n.t('credits.generation.balanceAfterReserve')}</dt>
              <dd>
                {costLabel(String(
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
  let estimate: GenerationCostEstimate;
  try {
    estimate = await estimateGenerationCost({
      ...intent,
      routingMode: intent.routingMode ?? getGenerationRoutingMode(),
    });
  } catch (error) {
    Modal.error({
      title: i18n.t('credits.generation.estimateErrorTitle'),
      content: getApiErrorMessage(error, i18n.t('credits.generation.estimateError')),
    });
    return null;
  }
  if (estimate.accountFrozen) {
    Modal.error({
      title: i18n.t('credits.frozen.title'),
      content: i18n.t('credits.frozen.generation'),
    });
    return null;
  }
  if (!estimate.sufficientBalance) {
    Modal.error({
      title: i18n.t('credits.generation.insufficientTitle'),
      content: i18n.t('credits.generation.insufficientDescription', {
        required: costLabel(estimate.reservationAmount),
        available: costLabel(estimate.availableBalance),
      }),
    });
    return null;
  }
  return (await confirmation(estimate)) ? estimate : null;
}

export async function runGenerationWithCredits<T>(
  intent: GenerationCostIntent,
  operation: (estimate: GenerationCostEstimate) => Promise<T>,
): Promise<T | undefined> {
  const estimate = await confirmGenerationCost(intent);
  if (!estimate) return undefined;
  const result = await operation(estimate);
  notifyCreditBalanceUpdated();
  return result;
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
        amount: costLabel(estimate.reservationAmount),
      })}
    >
      ≈ {costLabel(estimate.estimatedCost)} C
    </span>
  );
};
