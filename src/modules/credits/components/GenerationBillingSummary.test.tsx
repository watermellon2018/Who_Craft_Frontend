import React from 'react';
import {render, screen} from '@testing-library/react';

import GenerationBillingSummary from './GenerationBillingSummary';

describe('GenerationBillingSummary', () => {
  it('shows the final charged amount and fallback usage', () => {
    render(<GenerationBillingSummary billing={{
      status: 'captured',
      currency: 'USD',
      estimatedCost: '0.03',
      reservedAmount: '0.08',
      actualCost: '0.05',
      chargedAmount: '0.05',
      uncoveredCost: '0.00',
      costIsEstimate: false,
      provider: 'openrouter-images',
      model: 'google/gemini-flash-image',
      operation: 'generate',
      routingMode: 'economy',
      routingAttempts: [{result: 'failed'}, {result: 'succeeded'}],
    }} />);

    expect(screen.getByText(/Итоговая стоимость/)).toHaveTextContent(/0,05 C/);
    expect(screen.getByText('Использован резервный провайдер')).toBeInTheDocument();
  });
});
