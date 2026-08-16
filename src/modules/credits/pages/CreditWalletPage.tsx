import React, {FormEvent, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';

import {getApiErrorMessage} from '../../../api/errors';
import type {
  CreditAdminOperationRequest,
  CreditHistoryPage,
  CreditLedgerEntry,
  CreditOperationType,
  CreditSpendingStatistics,
  CreditSummary,
  GenerationRoutingMode,
  ProjectCreditBudget,
} from '../../../api/generated/contracts';
import DashboardHeader from '../../profile/components/DashboardHeader';
import {
  createCreditAdminOperation,
  createCreditTransfer,
  createDemoTopUp,
  createIdempotencyKey,
  fetchCreditHistory,
  fetchProjectCreditBudgets,
  fetchCreditSpendingStatistics,
  fetchCreditSummary,
  getGenerationRoutingMode,
  notifyCreditBalanceUpdated,
  setGenerationRoutingMode,
  updateProjectCreditBudget,
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

function normalizedBudget(value: string): string | null {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 ? amount.toFixed(2) : null;
}

function mutationKey(
  pending: React.MutableRefObject<PendingMutation | null>,
  prefix: 'topup' | 'transfer' | 'admin',
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
  const [spending, setSpending] = useState<CreditSpendingStatistics | null>(null);
  const [projectBudgets, setProjectBudgets] = useState<ProjectCreditBudget[]>([]);
  const [budgetDrafts, setBudgetDrafts] = useState<Record<number, string>>({});
  const [budgetPending, setBudgetPending] = useState<number | null>(null);
  const [spendingPeriod, setSpendingPeriod] = useState(30);
  const [historyFilter, setHistoryFilter] = useState<CreditOperationType | ''>('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [topUpAmount, setTopUpAmount] = useState('500');
  const [topUpPending, setTopUpPending] = useState(false);
  const [sender, setSender] = useState('');
  const [recipient, setRecipient] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [transferPending, setTransferPending] = useState(false);
  const [routingMode, setRoutingModeState] = useState<GenerationRoutingMode>(getGenerationRoutingMode);
  const [adminReason, setAdminReason] = useState('');
  const [adminPending, setAdminPending] = useState(false);
  const topUpMutation = useRef<PendingMutation | null>(null);
  const transferMutation = useRef<PendingMutation | null>(null);
  const adminMutation = useRef<PendingMutation | null>(null);

  const loadWallet = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [nextSummary, nextHistory, nextSpending, nextBudgets] = await Promise.all([
        fetchCreditSummary(),
        fetchCreditHistory({
          limit: HISTORY_LIMIT,
          offset: 0,
          ...(historyFilter ? {operationType: historyFilter} : {}),
        }),
        fetchCreditSpendingStatistics(spendingPeriod),
        fetchProjectCreditBudgets(),
      ]);
      setSummary(nextSummary);
      setHistory(nextHistory);
      setSpending(nextSpending);
      setProjectBudgets(nextBudgets.items);
      setBudgetDrafts(Object.fromEntries(
        nextBudgets.items.map((budget) => [budget.projectId, budget.limit ?? '']),
      ));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, t('credits.errors.load')));
    } finally {
      setLoading(false);
    }
  }, [historyFilter, spendingPeriod, t]);

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
    const senderUsername = sender.trim();
    const recipientUsername = recipient.trim();
    const reason = transferReason.trim();
    const amount = normalizedAmount(transferAmount);
    if (!senderUsername || !recipientUsername || !amount || !reason) {
      setError(t('credits.errors.transferFields'));
      return;
    }
    const fingerprint = JSON.stringify([
      senderUsername,
      recipientUsername,
      amount,
      reason,
    ]);
    const key = mutationKey(transferMutation, 'transfer', fingerprint);
    setTransferPending(true);
    setError('');
    setNotice('');
    try {
      await createCreditTransfer({
        senderUsername,
        recipientUsername,
        amount,
        reason,
      }, key);
      transferMutation.current = null;
      setSender('');
      setRecipient('');
      setTransferAmount('');
      setTransferReason('');
      await refreshAfterMutation();
      setNotice(t('credits.transfer.success', {
        amount: formatCreditAmount(amount, i18n.language),
        sender: senderUsername,
        recipient: recipientUsername,
      }));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, t('credits.errors.transfer')));
    } finally {
      setTransferPending(false);
    }
  };

  const handleRoutingMode = (mode: GenerationRoutingMode) => {
    setGenerationRoutingMode(mode);
    setRoutingModeState(mode);
    setNotice(t('credits.routing.saved'));
  };

  const handleAdminOperation = async (event: FormEvent) => {
    event.preventDefault();
    const reason = adminReason.trim();
    if (!reason) {
      setError(t('credits.admin.validation'));
      return;
    }
    const payload: CreditAdminOperationRequest = {
      action: summary?.account.isFrozen ? 'unfreeze' : 'freeze',
      reason,
    };
    const fingerprint = JSON.stringify(payload);
    setAdminPending(true);
    setError('');
    setNotice('');
    try {
      await createCreditAdminOperation(
        payload,
        mutationKey(adminMutation, 'admin', fingerprint),
      );
      adminMutation.current = null;
      setAdminReason('');
      await refreshAfterMutation();
      setNotice(t(`credits.admin.success.${payload.action}`));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, t('credits.admin.error')));
    } finally {
      setAdminPending(false);
    }
  };

  const handleBudgetUpdate = async (event: FormEvent, budget: ProjectCreditBudget) => {
    event.preventDefault();
    const draft = (budgetDrafts[budget.projectId] ?? '').trim();
    const limit = draft ? normalizedBudget(draft) : null;
    if (draft && limit === null) {
      setError(t('credits.budgets.validation'));
      return;
    }
    setBudgetPending(budget.projectId);
    setError('');
    setNotice('');
    try {
      const updated = await updateProjectCreditBudget(budget.projectId, {limit});
      setProjectBudgets((current) => current.map((item) => (
        item.projectId === updated.projectId ? updated : item
      )));
      setBudgetDrafts((current) => ({
        ...current,
        [updated.projectId]: updated.limit ?? '',
      }));
      setNotice(t('credits.budgets.success', {project: updated.projectTitle}));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, t('credits.budgets.error')));
    } finally {
      setBudgetPending(null);
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
        {summary?.account.isFrozen && (
          <div className="credit-wallet__alert credit-wallet__alert--error" role="alert">
            <strong>{t('credits.frozen.title')}</strong> {summary.account.freezeReason || t('credits.frozen.description')}
          </div>
        )}
        {summary?.alerts.lowBalance && (
          <div className="credit-wallet__alert credit-wallet__alert--warning" role="status">
            {t('credits.lowBalance', {
              threshold: formatCreditAmount(summary.alerts.lowBalanceThreshold, i18n.language),
            })}
          </div>
        )}

        {loading && !summary ? (
          <div className="credit-wallet__loading">{t('common.loading')}</div>
        ) : (
          <>
            <section className="credit-wallet__routing">
              <div className="credit-wallet__section-heading">
                <div>
                  <span>{t('credits.routing.eyebrow')}</span>
                  <h2>{t('credits.routing.title')}</h2>
                </div>
              </div>
              <p>{t('credits.routing.description')}</p>
              <div className="credit-wallet__routing-grid">
                {(['manual', 'economy', 'fast', 'balanced', 'quality'] as GenerationRoutingMode[]).map((mode) => (
                  <button
                    aria-pressed={routingMode === mode}
                    className={routingMode === mode ? 'is-active' : ''}
                    key={mode}
                    onClick={() => handleRoutingMode(mode)}
                    type="button"
                  >
                    <strong>{t(`credits.routing.modes.${mode}.title`)}</strong>
                    <span>{t(`credits.routing.modes.${mode}.description`)}</span>
                  </button>
                ))}
              </div>
              <small>{t('credits.routing.priceGuard')}</small>
            </section>

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

            {summary?.capabilities.demoTopUpEnabled && (
              <section
                aria-labelledby="credit-top-up-title"
                className="credit-wallet__top-up"
              >
                <div className="credit-wallet__section-heading">
                  <div>
                    <span>{t('credits.topUp.eyebrow')}</span>
                    <h2 id="credit-top-up-title">{t('credits.topUp.title')}</h2>
                  </div>
                </div>
                <p>{t('credits.topUp.description')}</p>
                <div className="credit-wallet__panel credit-wallet__panel--demo">
                  <span className="credit-wallet__demo-badge">{t('credits.topUp.demoBadge')}</span>
                  <form onSubmit={handleTopUp}>
                    <label htmlFor="credit-top-up-amount">{t('credits.amount')}</label>
                    <div className="credit-wallet__amount-row">
                      <input
                        id="credit-top-up-amount"
                        inputMode="decimal"
                        value={topUpAmount}
                        onChange={(event) => setTopUpAmount(event.target.value)}
                      />
                      <button
                        type="submit"
                        disabled={topUpPending || summary?.account.isFrozen}
                      >
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
                </div>
              </section>
            )}

            <section className="credit-wallet__spending">
              <div className="credit-wallet__section-heading credit-wallet__section-heading--history">
                <div>
                  <span>{t('credits.spending.eyebrow')}</span>
                  <h2>{t('credits.spending.title')}</h2>
                </div>
                <label>
                  <span>{t('credits.spending.period')}</span>
                  <select value={spendingPeriod} onChange={(event) => setSpendingPeriod(Number(event.target.value))}>
                    {[7, 30, 90, 365].map((days) => (
                      <option key={days} value={days}>{t('credits.spending.days', {days})}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="credit-wallet__spending-total">
                <span>{t('credits.spending.total')}</span>
                <strong>{formatCreditAmount(spending?.totalCharged ?? '0', i18n.language)} C</strong>
                <small>{t('credits.spending.jobs', {count: spending?.jobCount ?? 0})}</small>
              </div>
              <div className="credit-wallet__spending-columns">
                <div>
                  <h3>{t('credits.spending.byType')}</h3>
                  {(spending?.byDomain ?? []).map((row) => (
                    <div className="credit-wallet__spending-row" key={row.domain}>
                      <span>{t(`credits.spending.domains.${row.domain}`, {defaultValue: row.domain})}</span>
                      <strong>{formatCreditAmount(row.charged, i18n.language)} C</strong>
                    </div>
                  ))}
                </div>
                <div>
                  <h3>{t('credits.spending.byProject')}</h3>
                  {(spending?.byProject ?? []).map((row) => (
                    <div className="credit-wallet__spending-row" key={`${row.projectId ?? 'none'}-${row.projectTitle}`}>
                      <span>{row.projectTitle || t('credits.spending.noProject')}</span>
                      <strong>{formatCreditAmount(row.charged, i18n.language)} C</strong>
                    </div>
                  ))}
                </div>
              </div>
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

            <section className="credit-wallet__budgets">
              <div className="credit-wallet__section-heading">
                <div>
                  <span>{t('credits.budgets.eyebrow')}</span>
                  <h2>{t('credits.budgets.title')}</h2>
                </div>
              </div>
              <p>{t('credits.budgets.description')}</p>
              {!projectBudgets.length ? (
                <div className="credit-wallet__empty">{t('credits.budgets.empty')}</div>
              ) : (
                <div className="credit-wallet__budget-list">
                  {projectBudgets.map((budget) => (
                    <article
                      className={`credit-budget-card${budget.overLimit ? ' credit-budget-card--over' : ''}`}
                      key={budget.projectId}
                    >
                      <div className="credit-budget-card__heading">
                        <div>
                          <strong>{budget.projectTitle}</strong>
                          <span>{budget.limit === null
                            ? t('credits.budgets.unlimited')
                            : t('credits.budgets.limitValue', {
                              amount: formatCreditAmount(budget.limit, i18n.language),
                            })}</span>
                        </div>
                        {budget.overLimit && <em>{t('credits.budgets.overLimit')}</em>}
                      </div>
                      <dl>
                        <div>
                          <dt>{t('credits.budgets.spent')}</dt>
                          <dd>{formatCreditAmount(budget.spent, i18n.language)} C</dd>
                        </div>
                        <div>
                          <dt>{t('credits.reserved')}</dt>
                          <dd>{formatCreditAmount(budget.reserved, i18n.language)} C</dd>
                        </div>
                        <div>
                          <dt>{t('credits.budgets.remaining')}</dt>
                          <dd>{budget.remaining === null
                            ? t('credits.budgets.unlimited')
                            : `${formatCreditAmount(budget.remaining, i18n.language)} C`}</dd>
                        </div>
                      </dl>
                      <form onSubmit={(event) => handleBudgetUpdate(event, budget)}>
                        <label htmlFor={`credit-budget-${budget.projectId}`}>
                          {t('credits.budgets.limit')}
                        </label>
                        <div className="credit-wallet__amount-row">
                          <input
                            id={`credit-budget-${budget.projectId}`}
                            inputMode="decimal"
                            placeholder={t('credits.budgets.unlimitedPlaceholder')}
                            value={budgetDrafts[budget.projectId] ?? ''}
                            onChange={(event) => setBudgetDrafts((current) => ({
                              ...current,
                              [budget.projectId]: event.target.value,
                            }))}
                          />
                          <button disabled={budgetPending === budget.projectId} type="submit">
                            {budgetPending === budget.projectId
                              ? t('credits.processing')
                              : t('credits.budgets.save')}
                          </button>
                        </div>
                        <small>{t('credits.budgets.hint')}</small>
                      </form>
                    </article>
                  ))}
                </div>
              )}
            </section>

            {summary?.capabilities.adminWalletManagement && (
              <section className="credit-wallet__admin">
                <div className="credit-wallet__section-heading">
                  <div>
                    <span>ADMIN</span>
                    <h2>{t('credits.admin.title')}</h2>
                  </div>
                </div>
                <p>{t('credits.admin.description')}</p>
                <div className="credit-wallet__admin-grid">
                  <article className="credit-wallet__panel">
                    <h3>{summary.account.isFrozen
                      ? t('credits.admin.walletState.frozenTitle')
                      : t('credits.admin.walletState.activeTitle')}</h3>
                    <p>{summary.account.isFrozen
                      ? t('credits.admin.walletState.frozenDescription')
                      : t('credits.admin.walletState.activeDescription')}</p>
                    <form onSubmit={handleAdminOperation}>
                      <label htmlFor="credit-admin-reason">{t('credits.admin.reason')}</label>
                      <input
                        id="credit-admin-reason"
                        maxLength={255}
                        placeholder={t('credits.admin.reasonPlaceholder')}
                        value={adminReason}
                        onChange={(event) => setAdminReason(event.target.value)}
                      />
                      <button disabled={adminPending} type="submit">
                        {adminPending
                          ? t('credits.processing')
                          : t(`credits.admin.actions.${summary.account.isFrozen ? 'unfreeze' : 'freeze'}`)}
                      </button>
                    </form>
                  </article>

                  {summary.capabilities.transfersEnabled && (
                    <article className="credit-wallet__panel">
                      <h3>{t('credits.transfer.title')}</h3>
                      <p>{t('credits.transfer.description')}</p>
                      <form onSubmit={handleTransfer}>
                        <label htmlFor="credit-sender">{t('credits.transfer.sender')}</label>
                        <input
                          id="credit-sender"
                          autoComplete="off"
                          placeholder={t('credits.transfer.senderPlaceholder')}
                          value={sender}
                          onChange={(event) => setSender(event.target.value)}
                        />
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
                        <label htmlFor="credit-transfer-reason">{t('credits.transfer.reason')}</label>
                        <input
                          id="credit-transfer-reason"
                          maxLength={255}
                          placeholder={t('credits.transfer.reasonPlaceholder')}
                          value={transferReason}
                          onChange={(event) => setTransferReason(event.target.value)}
                        />
                        <button type="submit" disabled={transferPending}>
                          {transferPending ? t('credits.processing') : t('credits.transfer.submit')}
                        </button>
                        <small>{t('credits.transfer.hint')}</small>
                        <small>{t('credits.transfer.limits', {
                          perTransfer: formatCreditAmount(summary.transferLimits.perTransfer, i18n.language),
                          day: formatCreditAmount(summary.transferLimits.rollingDay, i18n.language),
                          count: summary.transferLimits.rollingDayCount,
                        })}</small>
                      </form>
                    </article>
                  )}
                </div>
              </section>
            )}

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
