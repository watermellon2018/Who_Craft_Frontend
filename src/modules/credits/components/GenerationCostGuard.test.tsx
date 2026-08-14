import {Modal} from 'antd';

import {
  estimateGenerationCost,
  notifyCreditBalanceUpdated,
} from '../api/creditApi';
import {runGenerationWithCredits} from './GenerationCostGuard';

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

  it('confirms paid work, runs it once and refreshes the wallet badge', async () => {
    mockedEstimate.mockResolvedValue(estimate);
    jest.spyOn(Modal, 'confirm').mockImplementation((config) => {
      void config.onOk?.();
      return {destroy: jest.fn(), update: jest.fn()} as never;
    });
    const operation = jest.fn().mockResolvedValue('job');

    await expect(runGenerationWithCredits({domain: 'character'}, operation)).resolves.toBe('job');

    expect(operation).toHaveBeenCalledTimes(1);
    expect(mockedNotify).toHaveBeenCalledTimes(1);
  });

  it('blocks the provider call when the available balance is insufficient', async () => {
    mockedEstimate.mockResolvedValue({...estimate, availableBalance: '0.01', sufficientBalance: false});
    jest.spyOn(Modal, 'error').mockReturnValue({destroy: jest.fn(), update: jest.fn()} as never);
    const operation = jest.fn().mockResolvedValue('job');

    await expect(runGenerationWithCredits({domain: 'poster'}, operation)).resolves.toBeUndefined();

    expect(operation).not.toHaveBeenCalled();
    expect(mockedNotify).not.toHaveBeenCalled();
  });
});
