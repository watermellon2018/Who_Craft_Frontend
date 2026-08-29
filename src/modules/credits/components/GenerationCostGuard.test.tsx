import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {Modal} from 'antd';

import {
  estimateGenerationCost,
  notifyCreditBalanceUpdated,
} from '../api/creditApi';
import {
  confirmGenerationCost,
  GenerationCostPreview,
  prepareGenerationCost,
  runApprovedGeneration,
  runGenerationWithCredits,
} from './GenerationCostGuard';

jest.mock('../api/creditApi', () => ({
  estimateGenerationCost: jest.fn(),
  getGenerationRoutingMode: jest.fn(() => 'manual'),
  notifyCreditBalanceUpdated: jest.fn(),
}));

const mockedEstimate = estimateGenerationCost as jest.MockedFunction<typeof estimateGenerationCost>;
const mockedNotify = notifyCreditBalanceUpdated as jest.MockedFunction<typeof notifyCreditBalanceUpdated>;

const estimate = {
  domain: 'character',
  operation: 'generate',
  provider: 'litellm',
  modelKey: 'gemini-flash-image',
  modelName: 'gemini/gemini-2.5-flash-image',
  currency: 'USD' as const,
  estimatedCost: '0.039',
  reservationAmount: '0.039',
  pricingSource: 'google',
  costIsEstimate: true,
  availableBalance: '1.00',
  sufficientBalance: true,
  accountFrozen: false,
  routingMode: 'manual' as const,
  routingReason: 'manual-selection',
  routeCandidates: [],
};

describe('GenerationCostGuard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    Modal.destroyAll();
  });

  it('confirms paid work, runs it once and refreshes the wallet badge', async () => {
    mockedEstimate.mockResolvedValue(estimate);
    const confirmSpy = jest.spyOn(Modal, 'confirm').mockImplementation((config) => {
      void config.onOk?.();
      return {destroy: jest.fn(), update: jest.fn()} as never;
    });
    const operation = jest.fn().mockResolvedValue('job');

    await expect(runGenerationWithCredits({domain: 'character'}, operation)).resolves.toBe('job');

    expect(operation).toHaveBeenCalledTimes(1);
    expect(mockedNotify).toHaveBeenCalledTimes(1);
    expect(confirmSpy).toHaveBeenCalledWith(expect.objectContaining({
      className: 'generation-cost-modal',
      styles: expect.objectContaining({
        content: expect.objectContaining({
          background: 'var(--craft-surface-raised)',
        }),
      }),
    }));
  });

  it('blocks the provider call when the available balance is insufficient', async () => {
    mockedEstimate.mockResolvedValue({...estimate, availableBalance: '0.01', sufficientBalance: false});
    const errorSpy = jest.spyOn(Modal, 'error')
      .mockReturnValue({destroy: jest.fn(), update: jest.fn()} as never);
    const operation = jest.fn().mockResolvedValue('job');

    await expect(runGenerationWithCredits({domain: 'poster'}, operation)).resolves.toBeUndefined();

    expect(operation).not.toHaveBeenCalled();
    expect(mockedNotify).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(expect.objectContaining({
      className: 'generation-cost-modal',
      styles: expect.objectContaining({
        content: expect.objectContaining({
          background: 'var(--craft-surface-raised)',
        }),
      }),
    }));
  });

  it('prepares an affordable estimate without opening the generic confirmation', async () => {
    mockedEstimate.mockResolvedValue(estimate);
    const confirmSpy = jest.spyOn(Modal, 'confirm');

    await expect(prepareGenerationCost({
      domain: 'character',
      variantCount: 2,
    })).resolves.toEqual(estimate);

    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('rounds the approximate cost preview to three decimal places', async () => {
    mockedEstimate.mockResolvedValue({
      ...estimate,
      estimatedCost: '0.134502',
      reservationAmount: '0.134502',
    });

    render(<GenerationCostPreview intent={{domain: 'reference'}} />);

    const preview = await screen.findByText(/≈ 0[,.]135 C/);
    expect(preview.getAttribute('title')).toMatch(/0[,.]135/);
  });

  it('runs work after a custom approval and refreshes the wallet badge', async () => {
    const operation = jest.fn().mockResolvedValue(['full-body-job']);

    await expect(runApprovedGeneration(estimate, operation)).resolves.toEqual(['full-body-job']);

    expect(operation).toHaveBeenCalledWith(estimate);
    expect(mockedNotify).toHaveBeenCalledTimes(1);
  });

  it('applies the active Craft theme tokens to the rendered modal surface', async () => {
    mockedEstimate.mockResolvedValue(estimate);

    const confirmation = confirmGenerationCost({domain: 'character'});
    const modalContent = await waitFor(() => {
      const element = document.querySelector(
        '.generation-cost-modal .ant-modal-content',
      ) as HTMLElement | null;
      expect(element).not.toBeNull();
      return element as HTMLElement;
    });

    expect(modalContent.closest('.generation-cost-modal')).not.toBeNull();

    const cancelButton = document.querySelector(
      '.generation-cost-modal .ant-btn-default',
    ) as HTMLButtonElement | null;
    expect(cancelButton).not.toBeNull();
    fireEvent.click(cancelButton as HTMLButtonElement);

    await expect(confirmation).resolves.toBeNull();
  });
});
