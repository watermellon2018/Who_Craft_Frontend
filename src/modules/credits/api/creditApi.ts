import api from '../../../api/http';
import {createGeneratedApiClient} from '../../../api/generated/client';
import type {
  CreditDemoTopUpRequest,
  CreditAdminAudit,
  CreditAdminOperationRequest,
  CreditAdminOperationResponse,
  CreditHistoryPage,
  CreditOperationType,
  CreditSummary,
  CreditSpendingStatistics,
  CreditTransferRequest,
  CreditTransferResponse,
  CreditMutationResponse,
  GenerationCostEstimate,
  GenerationCostEstimateRequest,
  GenerationRoutingMode,
} from '../../../api/generated/contracts';

const generatedClient = createGeneratedApiClient(api);

export const CREDIT_BALANCE_UPDATED_EVENT = 'wcraft:credit-balance-updated';
export const GENERATION_ROUTING_MODE_STORAGE_KEY = 'craftGenerationRoutingMode';

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

export function fetchCreditSpendingStatistics(
  periodDays = 30,
  projectId?: number,
): Promise<CreditSpendingStatistics> {
  return generatedClient.getCreditSpendingStatistics({
    periodDays,
    ...(projectId ? {projectId} : {}),
  });
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

export function createCreditAdminOperation(
  payload: CreditAdminOperationRequest,
  idempotencyKey: string,
): Promise<CreditAdminOperationResponse> {
  return generatedClient.createCreditAdminOperation(payload, idempotencyKey);
}

export function fetchCreditAdminAudit(username: string): Promise<CreditAdminAudit> {
  return generatedClient.getCreditAdminAudit(username);
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

export function createIdempotencyKey(prefix: 'topup' | 'transfer' | 'admin'): string {
  const randomUuid = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${randomUuid}`;
}

const ROUTING_MODES: GenerationRoutingMode[] = [
  'manual',
  'economy',
  'fast',
  'balanced',
  'quality',
];

export function getGenerationRoutingMode(): GenerationRoutingMode {
  if (typeof window === 'undefined') return 'manual';
  const stored = window.localStorage.getItem(GENERATION_ROUTING_MODE_STORAGE_KEY);
  return ROUTING_MODES.includes(stored as GenerationRoutingMode)
    ? stored as GenerationRoutingMode
    : 'manual';
}

export function setGenerationRoutingMode(mode: GenerationRoutingMode): void {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(GENERATION_ROUTING_MODE_STORAGE_KEY, mode);
  }
}
