import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';

import {
  createCreditTransfer,
  createDemoTopUp,
  createIdempotencyKey,
  fetchCreditHistory,
  fetchCreditSummary,
  notifyCreditBalanceUpdated,
} from '../api/creditApi';
import CreditWalletPage from './CreditWalletPage';

jest.mock('../../profile/components/DashboardHeader', () => function MockDashboardHeader() {
  return null;
});
jest.mock('../api/creditApi', () => ({
  createCreditTransfer: jest.fn(),
  createDemoTopUp: jest.fn(),
  createIdempotencyKey: jest.fn((prefix: string) => `${prefix}-test-key`),
  fetchCreditHistory: jest.fn(),
  fetchCreditSummary: jest.fn(),
  notifyCreditBalanceUpdated: jest.fn(),
}));

const mockedFetchSummary = fetchCreditSummary as jest.MockedFunction<typeof fetchCreditSummary>;
const mockedFetchHistory = fetchCreditHistory as jest.MockedFunction<typeof fetchCreditHistory>;
const mockedCreateTopUp = createDemoTopUp as jest.MockedFunction<typeof createDemoTopUp>;
const mockedCreateTransfer = createCreditTransfer as jest.MockedFunction<typeof createCreditTransfer>;
const mockedCreateKey = createIdempotencyKey as jest.MockedFunction<typeof createIdempotencyKey>;
const mockedNotifyUpdate = notifyCreditBalanceUpdated as jest.MockedFunction<typeof notifyCreditBalanceUpdated>;

const summary = {
  account: {
    availableBalance: '500.00',
    reservedBalance: '25.00',
    totalBalance: '525.00',
  },
  stats: {
    periodDays: 30,
    received: '700.00',
    sent: '100.00',
    spent: '75.00',
    refunded: '0.00',
  },
  capabilities: {demoTopUpEnabled: true, transfersEnabled: true},
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
  });

  it('shows balances, statistics and ledger history', async () => {
    render(<MemoryRouter><CreditWalletPage /></MemoryRouter>);

    expect(await screen.findByText('Зарезервировано')).toBeInTheDocument();
    expect(screen.getAllByText('Демо-пополнение')).toHaveLength(2);
    expect(screen.getByText('Потрачено')).toBeInTheDocument();
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
});
