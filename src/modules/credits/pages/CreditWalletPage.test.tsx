import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';

import {
  createCreditAdminOperation,
  createCreditTransfer,
  createDemoTopUp,
  createIdempotencyKey,
  fetchCreditAdminAudit,
  fetchCreditHistory,
  fetchCreditSpendingStatistics,
  fetchCreditSummary,
  setGenerationRoutingMode,
  notifyCreditBalanceUpdated,
} from '../api/creditApi';
import CreditWalletPage from './CreditWalletPage';

jest.mock('../../profile/components/DashboardHeader', () => function MockDashboardHeader() {
  return null;
});
jest.mock('../api/creditApi', () => ({
  createCreditTransfer: jest.fn(),
  createCreditAdminOperation: jest.fn(),
  createDemoTopUp: jest.fn(),
  createIdempotencyKey: jest.fn((prefix: string) => `${prefix}-test-key`),
  fetchCreditAdminAudit: jest.fn(),
  fetchCreditHistory: jest.fn(),
  fetchCreditSpendingStatistics: jest.fn(),
  fetchCreditSummary: jest.fn(),
  getGenerationRoutingMode: jest.fn(() => 'manual'),
  setGenerationRoutingMode: jest.fn(),
  notifyCreditBalanceUpdated: jest.fn(),
}));

const mockedFetchSummary = fetchCreditSummary as jest.MockedFunction<typeof fetchCreditSummary>;
const mockedFetchHistory = fetchCreditHistory as jest.MockedFunction<typeof fetchCreditHistory>;
const mockedFetchSpending = fetchCreditSpendingStatistics as jest.MockedFunction<typeof fetchCreditSpendingStatistics>;
const mockedCreateTopUp = createDemoTopUp as jest.MockedFunction<typeof createDemoTopUp>;
const mockedCreateTransfer = createCreditTransfer as jest.MockedFunction<typeof createCreditTransfer>;
const mockedCreateAdmin = createCreditAdminOperation as jest.MockedFunction<typeof createCreditAdminOperation>;
const mockedFetchAdminAudit = fetchCreditAdminAudit as jest.MockedFunction<typeof fetchCreditAdminAudit>;
const mockedCreateKey = createIdempotencyKey as jest.MockedFunction<typeof createIdempotencyKey>;
const mockedNotifyUpdate = notifyCreditBalanceUpdated as jest.MockedFunction<typeof notifyCreditBalanceUpdated>;
const mockedSetRouting = setGenerationRoutingMode as jest.MockedFunction<typeof setGenerationRoutingMode>;

const summary = {
  account: {
    availableBalance: '500.00',
    reservedBalance: '25.00',
    totalBalance: '525.00',
    isFrozen: false,
    freezeReason: '',
  },
  stats: {
    periodDays: 30,
    received: '700.00',
    sent: '100.00',
    spent: '75.00',
    refunded: '0.00',
  },
  capabilities: {demoTopUpEnabled: true, transfersEnabled: true, adminWalletManagement: false},
  alerts: {lowBalance: false, lowBalanceThreshold: '10.00'},
  transferLimits: {perTransfer: '1000.00', rollingDay: '5000.00', rollingDayCount: 20},
};

const spending = {
  periodDays: 30,
  totalCharged: '75.00',
  jobCount: 3,
  byDomain: [{domain: 'character', charged: '50.00', jobCount: 2}],
  byProject: [{projectId: 1, projectTitle: 'Film', charged: '75.00', jobCount: 3}],
  timeline: [],
};

const history = {
  items: [{
    id: 'entry-1',
    operationType: 'demo_top_up' as const,
    availableDelta: '500.00',
    reservedDelta: '0.00',
    availableBalanceAfter: '500.00',
    reservedBalanceAfter: '0.00',
    correlationId: 'correlation-1',
    counterparty: null,
    description: 'Demo',
    createdAt: '2026-08-14T10:00:00Z',
  }],
  total: 1,
  limit: 20,
  offset: 0,
  nextOffset: null,
};

describe('CreditWalletPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedCreateKey.mockImplementation((prefix) => `${prefix}-test-key`);
    mockedFetchSummary.mockResolvedValue(summary);
    mockedFetchHistory.mockResolvedValue(history);
    mockedFetchSpending.mockResolvedValue(spending);
    mockedCreateTopUp.mockResolvedValue({
      account: summary.account,
      transaction: history.items[0],
      replayed: false,
    });
    mockedCreateTransfer.mockResolvedValue({
      account: summary.account,
      transfer: {
        id: 'transfer-1',
        amount: '25.00',
        recipient: {username: 'test', displayName: 'Test'},
        note: '',
        createdAt: '2026-08-14T10:00:00Z',
      },
      replayed: false,
    });
    mockedCreateAdmin.mockResolvedValue({
      account: summary.account,
      auditEvent: {
        id: 'audit-1', eventType: 'freeze', amount: null, reason: 'Review', actor: 'staff', createdAt: '2026-08-14T10:00:00Z',
      },
      replayed: false,
    });
    mockedFetchAdminAudit.mockResolvedValue({
      username: 'test', account: summary.account, items: [],
    });
  });

  it('shows balances, statistics and ledger history', async () => {
    render(<MemoryRouter><CreditWalletPage /></MemoryRouter>);

    expect(await screen.findByText('Зарезервировано')).toBeInTheDocument();
    expect(screen.getAllByText('Демо-пополнение')).toHaveLength(2);
    expect(screen.getByText('Потрачено')).toBeInTheDocument();
    expect(screen.getByText('Куда ушли кредиты')).toBeInTheDocument();
    expect(screen.getByText('Film')).toBeInTheDocument();
  });

  it('saves the selected automatic routing mode', async () => {
    render(<MemoryRouter><CreditWalletPage /></MemoryRouter>);
    const economy = await screen.findByRole('button', {name: /Дешевле/});

    fireEvent.click(economy);

    expect(mockedSetRouting).toHaveBeenCalledWith('economy');
    expect(await screen.findByRole('status')).toHaveTextContent('Режим маршрутизации сохранён.');
  });

  it('submits a transfer by exact login and refreshes the balance', async () => {
    render(<MemoryRouter><CreditWalletPage /></MemoryRouter>);
    await screen.findByLabelText('Логин получателя');

    fireEvent.change(screen.getByLabelText('Логин получателя'), {target: {value: 'test'}});
    fireEvent.change(screen.getAllByLabelText('Сумма в кредитах')[1], {target: {value: '25'}});
    fireEvent.click(screen.getByRole('button', {name: 'Перевести кредиты'}));

    await waitFor(() => expect(mockedCreateTransfer).toHaveBeenCalledWith(
      {username: 'test', amount: '25.00'},
      'transfer-test-key',
    ));
    await waitFor(() => expect(mockedNotifyUpdate).toHaveBeenCalled());
    expect(await screen.findByRole('status')).toHaveTextContent('Отправлено 25 кредитов пользователю @test.');
  });

  it('labels top-up as demo and never invokes a payment system', async () => {
    render(<MemoryRouter><CreditWalletPage /></MemoryRouter>);
    await screen.findByText('ДЕМО');

    expect(screen.getByText('ДЕМО')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Добавить кредиты'}));

    await waitFor(() => expect(mockedCreateTopUp).toHaveBeenCalledWith(
      {amount: '500.00'},
      'topup-test-key',
    ));
    expect(await screen.findByRole('status')).toHaveTextContent('Добавлено 500 кредитов.');
  });

  it('lets staff perform an audited wallet adjustment', async () => {
    mockedFetchSummary.mockResolvedValue({
      ...summary,
      capabilities: {...summary.capabilities, adminWalletManagement: true},
    });
    render(<MemoryRouter><CreditWalletPage /></MemoryRouter>);

    await screen.findByText('Управление кошельками');
    fireEvent.change(screen.getByLabelText('Логин пользователя'), {target: {value: 'test'}});
    fireEvent.change(screen.getAllByLabelText('Сумма в кредитах')[2], {target: {value: '12.50'}});
    fireEvent.change(screen.getByLabelText('Причина операции'), {target: {value: 'Support refund'}});
    fireEvent.click(screen.getByRole('button', {name: 'Выполнить операцию'}));

    await waitFor(() => expect(mockedCreateAdmin).toHaveBeenCalledWith(
      {
        username: 'test',
        action: 'adjustment',
        reason: 'Support refund',
        amount: '12.50',
      },
      'admin-test-key',
    ));
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Операция выполнена и записана в аудит.',
    );
    expect(mockedFetchAdminAudit).toHaveBeenCalledWith('test');
  });
});
