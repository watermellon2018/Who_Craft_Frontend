import React from 'react';
import {useTranslation} from 'react-i18next';

import type {GenerationBilling} from '../../../api/generated/contracts';
import {formatCreditAmount} from './CreditBalanceBadge';
import '../credits.css';

interface GenerationBillingSummaryProps {
  billing?: GenerationBilling | null;
  compact?: boolean;
}

const GenerationBillingSummary: React.FC<GenerationBillingSummaryProps> = ({
  billing,
  compact = false,
}) => {
  const {t, i18n} = useTranslation();
  if (!billing) return null;

  const settled = billing.status !== 'reserved';
  const amount = settled ? billing.chargedAmount : billing.reservedAmount;
  const model = billing.model || billing.provider;

  return (
    <div className={`generation-billing ${compact ? 'generation-billing--compact' : ''}`.trim()}>
      <span>
        {settled ? t('credits.billing.final') : t('credits.billing.reserved')}
        {' '}
        <strong>{formatCreditAmount(amount, i18n.language)} C</strong>
      </span>
      {model && <small>{model}</small>}
      {billing.routingAttempts.length > 1 && (
        <small>{t('credits.billing.fallbackUsed')}</small>
      )}
    </div>
  );
};

export default GenerationBillingSummary;
