import React from 'react';
import {useTranslation} from 'react-i18next';
import {Link} from 'react-router-dom';

import PathConstants from '../../../routes/pathConstant';
import {useCreditSummary} from '../hooks/useCreditSummary';
import '../credits.css';

export function formatCreditAmount(value: string, language: string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '—';
  return new Intl.NumberFormat(language, {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

const CreditBalanceBadge: React.FC = () => {
  const {t, i18n} = useTranslation();
  const {summary, loading, error} = useCreditSummary();

  return (
    <Link
      to={PathConstants.CREDITS}
      className="credit-balance-badge"
      aria-label={t('credits.openWallet')}
      title={error ? t('credits.balanceUnavailable') : t('credits.openWallet')}
    >
      <span className="credit-balance-badge__coin" aria-hidden="true">C</span>
      <span className="credit-balance-badge__content">
        <span className="credit-balance-badge__label">{t('credits.balance')}</span>
        <span className="credit-balance-badge__value">
          {loading ? '…' : summary
            ? formatCreditAmount(summary.account.availableBalance, i18n.language)
            : '—'}
        </span>
      </span>
    </Link>
  );
};

export default CreditBalanceBadge;

