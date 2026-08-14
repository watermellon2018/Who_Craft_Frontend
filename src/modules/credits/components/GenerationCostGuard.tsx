import {Modal} from 'antd';
import React from 'react';
import i18n from '../../../i18n';

import type {
  GenerationCostEstimate,
  GenerationCostEstimateRequest,
} from '../../../api/generated/contracts';
import {getApiErrorMessage} from '../../../api/errors';
import {
  estimateGenerationCost,
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
            <div>
              <dt>{i18n.t('credits.generation.balanceAfterReserve')}</dt>
              <dd>
                {costLabel(String(
                  Number(estimate.availableBalance) - Number(estimate.reservationAmount),
                ))} C
              </dd>
            </div>
          </dl>
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
    estimate = await estimateGenerationCost(intent);
  } catch (error) {
    Modal.error({
      title: i18n.t('credits.generation.estimateErrorTitle'),
      content: getApiErrorMessage(error, i18n.t('credits.generation.estimateError')),
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
  operation: () => Promise<T>,
): Promise<T | undefined> {
  const estimate = await confirmGenerationCost(intent);
  if (!estimate) return undefined;
  const result = await operation();
  notifyCreditBalanceUpdated();
  return result;
}
