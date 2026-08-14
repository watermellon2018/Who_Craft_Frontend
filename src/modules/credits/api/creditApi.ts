import api from '../../../api/http';
import {createGeneratedApiClient} from '../../../api/generated/client';
import type {
  CreditDemoTopUpRequest,
  CreditHistoryPage,
  CreditOperationType,
  CreditSummary,
  CreditTransferRequest,
  CreditTransferResponse,
  CreditMutationResponse,
  GenerationCostEstimate,
  GenerationCostEstimateRequest,
} from '../../../api/generated/contracts';

const generatedClient = createGeneratedApiClient(api);

export const CREDIT_BALANCE_UPDATED_EVENT = 'wcraft:credit-balance-updated';

export interface CreditHistoryQuery {
  limit?: number;
  offset?: number;
  operationType?: CreditOperationType;
}

export function fetchCreditSummary(): Promise<CreditSummary> {
  return generatedClient.getCreditSummary();
}

export function fetchCreditHistory(
  query: CreditHistoryQuery = {},
): Promise<CreditHistoryPage> {
  return generatedClient.listCreditHistory(query);
}

export function createDemoTopUp(
  payload: CreditDemoTopUpRequest,
  idempotencyKey: string,
): Promise<CreditMutationResponse> {
  return generatedClient.createCreditDemoTopUp(payload, idempotencyKey);
}

export function createCreditTransfer(
  payload: CreditTransferRequest,
  idempotencyKey: string,
): Promise<CreditTransferResponse> {
  return generatedClient.createCreditTransfer(payload, idempotencyKey);
}

export function estimateGenerationCost(
  payload: GenerationCostEstimateRequest,
): Promise<GenerationCostEstimate> {
  return generatedClient.estimateGenerationCost(payload);
}

export function notifyCreditBalanceUpdated(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CREDIT_BALANCE_UPDATED_EVENT));
  }
}

export function createIdempotencyKey(prefix: 'topup' | 'transfer'): string {
  const randomUuid = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${randomUuid}`;
}
