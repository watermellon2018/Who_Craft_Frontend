import React from 'react';
import {render, screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';

import {useCreditSummary} from '../hooks/useCreditSummary';
import CreditBalanceBadge from './CreditBalanceBadge';

jest.mock('../hooks/useCreditSummary');

const mockedUseCreditSummary = useCreditSummary as jest.MockedFunction<typeof useCreditSummary>;

describe('CreditBalanceBadge', () => {
  it('shows the available balance and links to the wallet', () => {
    mockedUseCreditSummary.mockReturnValue({
      summary: {
        account: {
          availableBalance: '1250.50',
          reservedBalance: '10.00',
          totalBalance: '1260.50',
          isFrozen: false,
          freezeReason: '',
        },
        stats: {
          periodDays: 30,
          received: '1300.50',
          sent: '40.00',
          spent: '0.00',
          refunded: '0.00',
        },
        capabilities: {demoTopUpEnabled: true, transfersEnabled: true, adminWalletManagement: false},
        alerts: {lowBalance: false, lowBalanceThreshold: '10.00'},
        transferLimits: {perTransfer: '1000.00', rollingDay: '5000.00', rollingDayCount: 20},
      },
      loading: false,
      error: false,
      reload: jest.fn(),
    });

    render(<MemoryRouter><CreditBalanceBadge /></MemoryRouter>);

    const link = screen.getByRole('link', {name: 'Открыть кошелёк Craft'});
    expect(link).toHaveAttribute('href', '/credits');
    expect(link).toHaveTextContent(/1.?250,50/);
  });
});
