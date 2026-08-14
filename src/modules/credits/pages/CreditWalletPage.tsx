import React, {FormEvent, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';

import {getApiErrorMessage} from '../../../api/errors';
import type {
  CreditHistoryPage,
  CreditLedgerEntry,
  CreditOperationType,
  CreditSummary,
} from '../../../api/generated/contracts';
import DashboardHeader from '../../profile/components/DashboardHeader';
import {
  createCreditTransfer,
  createDemoTopUp,
  createIdempotencyKey,
  fetchCreditHistory,
  fetchCreditSummary,
  notifyCreditBalanceUpdated,
} from '../api/creditApi';
import {formatCreditAmount} from '../components/CreditBalanceBadge';
import '../credits.css';

const HISTORY_LIMIT = 20;

interface PendingMutation {
  fingerprint: string;
  key: string;
}

function normalizedAmount(value: string): string | null {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? amount.toFixed(2) : null;
}

function mutationKey(
  pending: React.MutableRefObject<PendingMutation | null>,
  prefix: 'topup' | 'transfer',
  fingerprint: string,
): string {
  if (pending.current?.fingerprint === fingerprint) return pending.current.key;
  const key = createIdempotencyKey(prefix);
  pending.current = {fingerprint, key};
  return key;
}

const CreditWalletPage: React.FC = () => {
  const {t, i18n} = useTranslation();
  const [summary, setSummary] = useState<CreditSummary | null>(null);
  const [history, setHistory] = useState<CreditHistoryPage | null>(null);
  const [historyFilter, setHistoryFilter] = useState<CreditOperationType | ''>('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [topUpAmount, setTopUpAmount] = useState('500');
  const [topUpPending, setTopUpPending] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferNote, setTransferNote] = useState('');
  const [transferPending, setTransferPending] = useState(false);
  const topUpMutation = useRef<PendingMutation | null>(null);
  const transferMutation = useRef<PendingMutation | null>(null);

  const loadWallet = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [nextSummary, nextHistory] = await Promise.all([
        fetchCreditSummary(),
        fetchCreditHistory({
          limit: HISTORY_LIMIT,
          offset: 0,
          ...(historyFilter ? {operationType: historyFilter} : {}),
        }),
      ]);
      setSummary(nextSummary);
      setHistory(nextHistory);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, t('credits.errors.load')));
    } finally {
      setLoading(false);
    }
  }, [historyFilter, t]);

  useEffect(() => {
    void loadWallet();
  }, [loadWallet]);

  const refreshAfterMutation = async () => {
    const [nextSummary, nextHistory] = await Promise.all([
      fetchCreditSummary(),
      fetchCreditHistory({
        limit: HISTORY_LIMIT,
        offset: 0,
        ...(historyFilter ? {operationType: historyFilter} : {}),
      }),
    ]);
    setSummary(nextSummary);
    setHistory(nextHistory);
    notifyCreditBalanceUpdated();
  };

  const handleTopUp = async (event: FormEvent) => {
    event.preventDefault();
    const amount = normalizedAmount(topUpAmount);
    if (!amount) {
      setError(t('credits.errors.invalidAmount'));
      return;
    }
    const key = mutationKey(topUpMutation, 'topup', amount);
    setTopUpPending(true);
    setError('');
    setNotice('');
    try {
      await createDemoTopUp({amount}, key);
      topUpMutation.current = null;
      await refreshAfterMutation();
      setNotice(t('credits.topUp.success', {amount: formatCreditAmount(amount, i18n.language)}));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, t('credits.errors.topUp')));
    } finally {
      setTopUpPending(false);
    }
  };

  const handleTransfer = async (event: FormEvent) => {
    event.preventDefault();
    const username = recipient.trim();
    const amount = normalizedAmount(transferAmount);
    if (!username || !amount) {
      setError(t('credits.errors.transferFields'));
      return;
    }
    const fingerprint = JSON.stringify([username, amount, transferNote.trim()]);
    const key = mutationKey(transferMutation, 'transfer', fingerprint);
    setTransferPending(true);
    setError('');
    setNotice('');
    try {
      await createCreditTransfer({
        username,
        amount,
        ...(transferNote.trim() ? {note: transferNote.trim()} : {}),
      }, key);
      transferMutation.current = null;
      setRecipient('');
      setTransferAmount('');
      setTransferNote('');
      await refreshAfterMutation();
      setNotice(t('credits.transfer.success', {
        amount: formatCreditAmount(amount, i18n.language),
        username,
      }));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, t('credits.errors.transfer')));
    } finally {
      setTransferPending(false);
    }
  };

  const loadMore = async () => {
    if (!history?.nextOffset) return;
    setLoadingMore(true);
    setError('');
    try {
      const nextPage = await fetchCreditHistory({
        limit: HISTORY_LIMIT,
        offset: history.nextOffset,
        ...(historyFilter ? {operationType: historyFilter} : {}),
      });
      setHistory({
        ...nextPage,
        items: [...history.items, ...nextPage.items],
      });
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, t('credits.errors.history')));
    } finally {
      setLoadingMore(false);
    }
  };

  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }), [i18n.language]);

  const operationOptions: CreditOperationType[] = [
    'demo_top_up',
    'transfer_out',
    'transfer_in',
    'reserve',
    'capture',
    'release',
    'refund',
    'adjustment',
  ];

  const amountDelta = (entry: CreditLedgerEntry) => (
    Number(entry.availableDelta) !== 0 ? entry.availableDelta : entry.reservedDelta
  );

  return (
    <div className="credit-wallet-page">
      <DashboardHeader
        breadcrumbItems={[{label: t('credits.pageTitle')}]}
        sectionTitle={t('credits.pageTitle')}
      />

      <main className="credit-wallet">
        <section className="credit-wallet__hero">
          <div>
            <span className="credit-wallet__eyebrow">CRAFT WALLET</span>
            <h1>{t('credits.pageTitle')}</h1>
            <p>{t('credits.subtitle')}</p>
          </div>
          <div className="credit-wallet__hero-balance" aria-live="polite">
            <span>{t('credits.available')}</span>
            <strong>{summary
              ? formatCreditAmount(summary.account.availableBalance, i18n.language)
              : '—'}</strong>
            <small>{t('credits.units')}</small>
          </div>
        </section>

        {error && <div className="credit-wallet__alert credit-wallet__alert--error" role="alert">{error}</div>}
        {notice && <div className="credit-wallet__alert credit-wallet__alert--success" role="status">{notice}</div>}

        {loading && !summary ? (
          <div className="credit-wallet__loading">{t('common.loading')}</div>
        ) : (
          <>
            <section className="credit-wallet__balance-grid" aria-label={t('credits.balanceDetails')}>
              <article className="credit-card credit-card--primary">
                <span>{t('credits.available')}</span>
                <strong>{formatCreditAmount(summary?.account.availableBalance ?? '0', i18n.language)}</strong>
                <small>{t('credits.availableHint')}</small>
              </article>
              <article className="credit-card">
                <span>{t('credits.reserved')}</span>
                <strong>{formatCreditAmount(summary?.account.reservedBalance ?? '0', i18n.language)}</strong>
                <small>{t('credits.reservedHint')}</small>
              </article>
              <article className="credit-card">
                <span>{t('credits.total')}</span>
                <strong>{formatCreditAmount(summary?.account.totalBalance ?? '0', i18n.language)}</strong>
                <small>{t('credits.totalHint')}</small>
              </article>
            </section>

            <section className="credit-wallet__stats">
              <div className="credit-wallet__section-heading">
                <div>
                  <span>{t('credits.stats.eyebrow')}</span>
                  <h2>{t('credits.stats.title', {days: summary?.stats.periodDays ?? 30})}</h2>
                </div>
              </div>
              <div className="credit-wallet__stats-grid">
                {(['received', 'sent', 'spent', 'refunded'] as const).map((key) => (
                  <article key={key}>
                    <span>{t(`credits.stats.${key}`)}</span>
                    <strong>{formatCreditAmount(summary?.stats[key] ?? '0', i18n.language)}</strong>
                  </article>
                ))}
              </div>
            </section>

            <div className="credit-wallet__actions-grid">
              {summary?.capabilities.demoTopUpEnabled && (
                <section className="credit-wallet__panel credit-wallet__panel--demo">
                  <span className="credit-wallet__demo-badge">{t('credits.topUp.demoBadge')}</span>
                  <h2>{t('credits.topUp.title')}</h2>
                  <p>{t('credits.topUp.description')}</p>
                  <form onSubmit={handleTopUp}>
                    <label htmlFor="credit-top-up-amount">{t('credits.amount')}</label>
                    <div className="credit-wallet__amount-row">
                      <input
                        id="credit-top-up-amount"
                        inputMode="decimal"
                        value={topUpAmount}
                        onChange={(event) => setTopUpAmount(event.target.value)}
                      />
                      <button type="submit" disabled={topUpPending}>
                        {topUpPending ? t('credits.processing') : t('credits.topUp.submit')}
                      </button>
                    </div>
                    <div className="credit-wallet__presets" aria-label={t('credits.topUp.presets')}>
                      {['100', '500', '1000'].map((amount) => (
                        <button key={amount} type="button" onClick={() => setTopUpAmount(amount)}>
                          +{amount}
                        </button>
                      ))}
                    </div>
                  </form>
                </section>
              )}

              {summary?.capabilities.transfersEnabled && (
                <section className="credit-wallet__panel">
                  <h2>{t('credits.transfer.title')}</h2>
                  <p>{t('credits.transfer.description')}</p>
                  <form onSubmit={handleTransfer}>
                    <label htmlFor="credit-recipient">{t('credits.transfer.recipient')}</label>
                    <input
                      id="credit-recipient"
                      autoComplete="off"
                      placeholder={t('credits.transfer.recipientPlaceholder')}
                      value={recipient}
                      onChange={(event) => setRecipient(event.target.value)}
                    />
                    <label htmlFor="credit-transfer-amount">{t('credits.amount')}</label>
                    <input
                      id="credit-transfer-amount"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={transferAmount}
                      onChange={(event) => setTransferAmount(event.target.value)}
                    />
                    <label htmlFor="credit-transfer-note">{t('credits.transfer.note')}</label>
                    <input
                      id="credit-transfer-note"
                      maxLength={140}
                      placeholder={t('credits.transfer.notePlaceholder')}
                      value={transferNote}
                      onChange={(event) => setTransferNote(event.target.value)}
                    />
                    <button type="submit" disabled={transferPending}>
                      {transferPending ? t('credits.processing') : t('credits.transfer.submit')}
                    </button>
                    <small>{t('credits.transfer.hint')}</small>
                  </form>
                </section>
              )}
            </div>

            <section className="credit-wallet__history">
              <div className="credit-wallet__section-heading credit-wallet__section-heading--history">
                <div>
                  <span>{t('credits.history.eyebrow')}</span>
                  <h2>{t('credits.history.title')}</h2>
                </div>
                <label>
                  <span>{t('credits.history.filter')}</span>
                  <select
                    value={historyFilter}
                    onChange={(event) => setHistoryFilter(event.target.value as CreditOperationType | '')}
                  >
                    <option value="">{t('credits.history.all')}</option>
                    {operationOptions.map((operation) => (
                      <option key={operation} value={operation}>
                        {t(`credits.operations.${operation}`)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {!history?.items.length ? (
                <div className="credit-wallet__empty">{t('credits.history.empty')}</div>
              ) : (
                <div className="credit-wallet__ledger">
                  {history.items.map((entry) => {
                    const delta = amountDelta(entry);
                    const positive = Number(delta) > 0;
                    return (
                      <article key={entry.id} className="credit-ledger-entry">
                        <div className="credit-ledger-entry__icon" aria-hidden="true">
                          {positive ? '+' : '−'}
                        </div>
                        <div className="credit-ledger-entry__body">
                          <strong>{t(`credits.operations.${entry.operationType}`)}</strong>
                          <span>
                            {entry.counterparty
                              ? t('credits.history.counterparty', {username: entry.counterparty.username})
                              : t('credits.history.systemOperation')}
                          </span>
                        </div>
                        <div className="credit-ledger-entry__meta">
                          <strong className={positive ? 'is-positive' : 'is-negative'}>
                            {positive ? '+' : ''}{formatCreditAmount(delta, i18n.language)}
                          </strong>
                          <time dateTime={entry.createdAt}>{dateFormatter.format(new Date(entry.createdAt))}</time>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}

              {history?.nextOffset !== null && history?.nextOffset !== undefined && (
                <button
                  type="button"
                  className="credit-wallet__load-more"
                  onClick={loadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? t('common.loading') : t('credits.history.loadMore')}
                </button>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
};

export default CreditWalletPage;

