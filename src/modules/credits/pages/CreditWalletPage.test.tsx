import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';

import {
  createCreditAdminOperation,
  createCreditTransfer,
  createDemoTopUp,
  createIdempotencyKey,
  fetchCreditHistory,
  fetchProjectCreditBudgets,
  fetchCreditSpendingStatistics,
  fetchCreditSummary,
  setGenerationRoutingMode,
  notifyCreditBalanceUpdated,
  updateProjectCreditBudget,
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
  fetchCreditHistory: jest.fn(),
  fetchProjectCreditBudgets: jest.fn(),
  fetchCreditSpendingStatistics: jest.fn(),
  fetchCreditSummary: jest.fn(),
  getGenerationRoutingMode: jest.fn(() => 'manual'),
  setGenerationRoutingMode: jest.fn(),
  notifyCreditBalanceUpdated: jest.fn(),
  updateProjectCreditBudget: jest.fn(),
}));

const mockedFetchSummary = fetchCreditSummary as jest.MockedFunction<typeof fetchCreditSummary>;
const mockedFetchHistory = fetchCreditHistory as jest.MockedFunction<typeof fetchCreditHistory>;
const mockedFetchSpending = fetchCreditSpendingStatistics as jest.MockedFunction<typeof fetchCreditSpendingStatistics>;
const mockedFetchBudgets = fetchProjectCreditBudgets as jest.MockedFunction<typeof fetchProjectCreditBudgets>;
const mockedCreateTopUp = createDemoTopUp as jest.MockedFunction<typeof createDemoTopUp>;
const mockedCreateTransfer = createCreditTransfer as jest.MockedFunction<typeof createCreditTransfer>;
const mockedCreateAdmin = createCreditAdminOperation as jest.MockedFunction<typeof createCreditAdminOperation>;
const mockedUpdateBudget = updateProjectCreditBudget as jest.MockedFunction<typeof updateProjectCreditBudget>;
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

const projectBudget = {
  projectId: 7,
  projectTitle: 'Budget Film',
  limit: '100.00',
  spent: '25.00',
  reserved: '10.00',
  remaining: '65.00',
  overLimit: false,
};

describe('CreditWalletPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedCreateKey.mockImplementation((prefix) => `${prefix}-test-key`);
    mockedFetchSummary.mockResolvedValue(summary);
    mockedFetchHistory.mockResolvedValue(history);
    mockedFetchSpending.mockResolvedValue(spending);
    mockedFetchBudgets.mockResolvedValue({items: [projectBudget]});
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
        sender: 'alice',
        recipient: {username: 'test', displayName: 'Test'},
        note: '',
        createdAt: '2026-08-14T10:00:00Z',
      },
      auditEvent: {
        id: 'audit-transfer', eventType: 'transfer', amount: '25.00', reason: 'Support', actor: 'staff', createdAt: '2026-08-14T10:00:00Z',
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
    mockedUpdateBudget.mockResolvedValue(projectBudget);
  });

  it('shows balances, statistics and ledger history', async () => {
    render(<MemoryRouter><CreditWalletPage /></MemoryRouter>);

    expect(await screen.findAllByText('Зарезервировано')).toHaveLength(2);
    expect(screen.getAllByText('Демо-пополнение')).toHaveLength(2);
    expect(screen.getAllByText('Потрачено')).toHaveLength(2);
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

  it('submits an audited staff transfer with sender, recipient and reason', async () => {
    mockedFetchSummary.mockResolvedValue({
      ...summary,
      capabilities: {...summary.capabilities, adminWalletManagement: true},
    });
    render(<MemoryRouter><CreditWalletPage /></MemoryRouter>);
    await screen.findByLabelText('Логин получателя');

    fireEvent.change(screen.getByLabelText('Логин отправителя'), {target: {value: 'alice'}});
    fireEvent.change(screen.getByLabelText('Логин получателя'), {target: {value: 'test'}});
    fireEvent.change(screen.getAllByLabelText('Сумма в кредитах')[1], {target: {value: '25'}});
    fireEvent.change(screen.getByLabelText('Причина перевода'), {target: {value: 'Support'}});
    fireEvent.click(screen.getByRole('button', {name: 'Перевести кредиты'}));

    await waitFor(() => expect(mockedCreateTransfer).toHaveBeenCalledWith(
      {
        senderUsername: 'alice',
        recipientUsername: 'test',
        amount: '25.00',
        reason: 'Support',
      },
      'transfer-test-key',
    ));
    await waitFor(() => expect(mockedNotifyUpdate).toHaveBeenCalled());
    expect(await screen.findByRole('status')).toHaveTextContent('Переведено 25 кредитов: @alice → @test.');
  });

  it('labels top-up as demo and never invokes a payment system', async () => {
    render(<MemoryRouter><CreditWalletPage /></MemoryRouter>);
    const heading = await screen.findByRole('heading', {name: 'Пополнение баланса'});
    const topUpSection = heading.closest('section');

    expect(topUpSection).toHaveTextContent('БАЛАНС');
    expect(screen.getByText('ДЕМО')).toBeInTheDocument();
    expect(topUpSection).not.toHaveTextContent('ЛИМИТЫ ПРОЕКТОВ');
    fireEvent.click(screen.getByRole('button', {name: 'Добавить кредиты'}));

    await waitFor(() => expect(mockedCreateTopUp).toHaveBeenCalledWith(
      {amount: '500.00'},
      'topup-test-key',
    ));
    expect(await screen.findByRole('status')).toHaveTextContent('Добавлено 500 кредитов.');
  });

  it('lets staff freeze their own wallet without entering a username', async () => {
    mockedFetchSummary.mockResolvedValue({
      ...summary,
      capabilities: {...summary.capabilities, adminWalletManagement: true},
    });
    render(<MemoryRouter><CreditWalletPage /></MemoryRouter>);

    await screen.findByText('Управление кошельками');
    expect(screen.queryByLabelText('Логин пользователя')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Причина операции'), {target: {value: 'Security review'}});
    fireEvent.click(screen.getByRole('button', {name: 'Заморозить мой кошелёк'}));

    await waitFor(() => expect(mockedCreateAdmin).toHaveBeenCalledWith(
      {
        action: 'freeze',
        reason: 'Security review',
      },
      'admin-test-key',
    ));
    expect(await screen.findByRole('status')).toHaveTextContent('Ваш кошелёк заморожен.');
  });

  it('updates a project generation budget and shows reserved spend', async () => {
    render(<MemoryRouter><CreditWalletPage /></MemoryRouter>);

    expect(await screen.findByText('Budget Film')).toBeInTheDocument();
    expect(screen.getByText('10 C')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Максимальный бюджет'), {target: {value: '120'}});
    fireEvent.click(screen.getByRole('button', {name: 'Сохранить'}));

    await waitFor(() => expect(mockedUpdateBudget).toHaveBeenCalledWith(
      7,
      {limit: '120.00'},
    ));
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Бюджет проекта «Budget Film» сохранён.',
    );
  });
});
