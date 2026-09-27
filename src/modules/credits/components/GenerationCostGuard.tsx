import {Alert, Button, Radio, Select, Spin} from 'antd';
import React, {useEffect, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import i18n from '../../../i18n';
import {craftModal} from '../../../theme/CraftModalHost';

import type {
  GenerationCostEstimate,
  GenerationCostEstimateRequest,
  GenerationSource,
  PersonalApiSettings,
} from '../../../api/generated/contracts';
import {getApiErrorMessage} from '../../../api/errors';
import {getAuthGeneration} from '../../../api/http';
import {
  fetchPersonalApiSettings,
  generationModality,
  personalGenerationRoutes,
  preferredGenerationSource,
  saveGenerationPreference,
} from '../../personal-api/api/personalApi';
import '../../personal-api/personal-api.css';
import {
  estimateGenerationCost,
  getGenerationRoutingMode,
  notifyCreditBalanceUpdated,
} from '../api/creditApi';
import {formatCreditAmount} from './CreditBalanceBadge';

export type GenerationCostIntent = GenerationCostEstimateRequest;

export const GENERATION_COST_MODAL_THEME = {
  className: 'generation-cost-modal',
  styles: {
    content: {
      background: 'var(--craft-surface-raised)',
      border: '1px solid var(--craft-border)',
      boxShadow: 'var(--craft-shadow-elevated)',
    },
  },
} as const;

export function formatGenerationCost(value: string): string {
  return formatCreditAmount(value, i18n.language);
}

function formatGenerationCostPreview(value: string): string {
  return formatCreditAmount(value, i18n.language, 3);
}

function EstimateDetails({estimate}: {estimate: GenerationCostEstimate}) {
  const {t} = useTranslation();
  if (estimate.generationSource === 'personal') return (
    <div className="generation-cost-confirmation">
      <Alert showIcon type="info" message={t('personalApi.guard.external')} />
      <dl>
        <div><dt>{t('personalApi.guard.connection')}</dt><dd>{estimate.connectionName}</dd></div>
        <div><dt>{t('personalApi.guard.model')}</dt><dd>{estimate.modelName || estimate.modelKey}</dd></div>
      </dl>
      {estimate.routeCandidates.length > 1 && <p>{t('personalApi.guard.route')}: {estimate.routeCandidates.map((route) => route.modelName).join(' → ')}</p>}
      <small>{t('personalApi.guard.timeoutHint')}</small>
    </div>
  );
  if (estimate.isFree) return <Alert showIcon type="success" message={t('personalApi.guard.free')} />;
  return (
        <div className="generation-cost-confirmation">
          <p>{t('credits.generation.confirmDescription')}</p>
          <dl>
            <div>
              <dt>{i18n.t('credits.generation.estimatedCost')}</dt>
              <dd>{formatGenerationCost(estimate.estimatedCost)} C</dd>
            </div>
            {estimate.routeCandidates.length > 1 && (
              <div>
                <dt>{i18n.t('credits.generation.maxWithFallback')}</dt>
                <dd>{formatGenerationCost(estimate.reservationAmount)} C</dd>
              </div>
            )}
            <div>
              <dt>{i18n.t('credits.generation.routingMode')}</dt>
              <dd>{i18n.t(`credits.routing.modes.${estimate.routingMode}.title`)}</dd>
            </div>
            <div>
              <dt>{i18n.t('credits.generation.balanceAfterReserve')}</dt>
              <dd>
                {formatGenerationCost(String(
                  Number(estimate.availableBalance) - Number(estimate.reservationAmount),
                ))} C
              </dd>
            </div>
          </dl>
          {estimate.routeCandidates.length > 1 && (
            <p className="generation-cost-confirmation__route">
              {i18n.t('credits.generation.fallbackRoute', {
                primary: estimate.routeCandidates[0].modelName,
                fallback: estimate.routeCandidates[1].modelName,
              })}
            </p>
          )}
          <small>{i18n.t('credits.generation.finalCostHint')}</small>
        </div>
  );
}

interface GenerationApprovalProps {
  intent: GenerationCostIntent;
  onDecision: (estimate: GenerationCostEstimate | null) => void;
  platformModels?: Array<{value: string; label: string; disabled?: boolean}>;
  modelLabel?: string;
  confirmLabel?: string;
  platformDetails?: (estimate: GenerationCostEstimate) => React.ReactNode;
}

export function GenerationApproval({intent, onDecision, platformModels, modelLabel, confirmLabel, platformDetails}: GenerationApprovalProps) {
  const {t} = useTranslation();
  const modality = generationModality(intent.domain);
  const [settings, setSettings] = useState<PersonalApiSettings | null>(null);
  const [source, setSource] = useState<GenerationSource>(intent.generationSource ?? 'platform');
  const [model, setModel] = useState<string>();
  const [platformModel, setPlatformModel] = useState(intent.modelKey);
  const [estimate, setEstimate] = useState<GenerationCostEstimate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [authGeneration] = useState(getAuthGeneration);
  const serializedIntent = JSON.stringify(intent);
  const routes = settings ? personalGenerationRoutes(settings, modality,
    modality === 'text' ? 'structured' : intent.operation ?? 'generate') : [];
  const modelOptions = Array.from(new Map(routes.map((route) => [route.model.key, {
    value: route.model.key, label: route.model.label,
  }])).values());

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    void fetchPersonalApiSettings().then((result) => {
      if (!active || getAuthGeneration() !== authGeneration) return;
      setSource(intent.generationSource ?? preferredGenerationSource(result, modality));
      setSettings(result);
    }).catch((reason) => {
      if (active) setError(getApiErrorMessage(reason, t('personalApi.guard.accessError')));
    }).finally(() => {if (active) setLoading(false);});
    return () => {active = false;};
  }, [authGeneration, intent.generationSource, modality, reload, t]);

  useEffect(() => {
    if (!settings) return;
    let active = true;
    setEstimate(null);
    setError('');
    if (source === 'personal' && (!settings.storageAvailable || !routes.length)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void getGenerationCostEstimate({...intent, generationSource: source,
      modelKey: source === 'personal' ? model : platformModel}).then((result) => {
      if (active && getAuthGeneration() === authGeneration) setEstimate(result);
    }).catch((reason) => {
      if (active) setError(getApiErrorMessage(reason, t('personalApi.guard.accessError')));
    }).finally(() => {if (active) setLoading(false);});
    return () => {active = false;};
  }, [authGeneration, serializedIntent, settings, source, model, platformModel, t]); // eslint-disable-line react-hooks/exhaustive-deps

  const walletBlocked = Boolean(estimate && estimate.generationSource !== 'personal' && !estimate.isFree
    && (estimate.accountFrozen || !estimate.sufficientBalance));
  const approve = async () => {
    if (!estimate || loading || saving || walletBlocked || getAuthGeneration() !== authGeneration) return;
    setSaving(true);
    try {
      const preference = settings?.preferences.find((item) => item.modality === modality);
      if (preference?.source !== source) {
        await saveGenerationPreference(modality, {source, routes: preference?.routes ?? []});
      }
      if (getAuthGeneration() === authGeneration) onDecision(estimate);
    } catch (reason) {
      setError(getApiErrorMessage(reason, t('personalApi.guard.accessError')));
      setSaving(false);
    }
  };
  return (
    <div className="personal-api-approval">
      <div className="personal-api-approval__source">
        <span id="generation-source-label">{t('personalApi.guard.source')}</span>
        <Radio.Group aria-labelledby="generation-source-label" value={source} disabled={!settings || saving}
          onChange={(event) => {setEstimate(null); setSource(event.target.value); setModel(undefined);}}>
          <Radio.Button value="platform">{t('personalApi.guard.platform')}</Radio.Button>
          <Radio.Button value="personal">{t('personalApi.guard.personal')}</Radio.Button>
        </Radio.Group>
      </div>
      <small>{t('personalApi.guard.remembered', {modality: t(`personalApi.modalities.${modality}`)})}</small>
      {source === 'platform' && platformModels && <div className="personal-api-approval__model">
        <label htmlFor="generation-platform-model">{modelLabel ?? t('personalApi.guard.model')}</label>
        <Select id="generation-platform-model" aria-label={modelLabel ?? t('personalApi.guard.model')}
          value={platformModel} disabled={saving} options={platformModels}
          onChange={(value) => {setEstimate(null); setPlatformModel(value);}} />
      </div>}
      {source === 'personal' && settings && (
        routes.length ? <div className="personal-api-approval__model">
          <label htmlFor="generation-personal-model">{t('personalApi.guard.model')}</label>
          <Select id="generation-personal-model" aria-label={t('personalApi.guard.model')} value={model ?? ''}
            disabled={saving} onChange={(value) => {setEstimate(null); setModel(value || undefined);}}
            options={[{value: '', label: t('personalApi.guard.priority')}, ...modelOptions]} />
        </div> : <Alert type="warning" showIcon message={t('personalApi.guard.noRoutes')} />
      )}
      {source === 'personal' && settings && !settings.storageAvailable && (
        <Alert type="error" showIcon message={t('personalApi.storageUnavailable')} />
      )}
      {source === 'platform' && settings && !settings.hasPaidSubscription && !estimate?.isFree && (
        <Alert type="info" showIcon message={t('personalApi.guard.subscription')} />
      )}
      {loading && <div role="status"><Spin size="small" /> {t('personalApi.guard.loading')}</div>}
      {error && <Alert type="error" showIcon message={error} action={<Button onClick={() => {setSettings(null); setReload((value) => value + 1);}}>{t('common.retry')}</Button>} />}
      {!loading && estimate && (estimate.generationSource !== 'personal' && platformDetails
        ? platformDetails(estimate) : <EstimateDetails estimate={estimate} />)}
      {walletBlocked && <Alert type="error" showIcon message={t(estimate?.accountFrozen ? 'credits.frozen.generation' : 'credits.generation.insufficientTitle')} />}
      <a href="/profile/settings#personal-api">{t('personalApi.guard.settings')}</a>
      <div className="personal-api-approval__actions">
        <Button className="craft-action-button craft-action-button--secondary" disabled={saving} onClick={() => onDecision(null)}>{t('common.cancel')}</Button>
        <Button className="craft-action-button" type="primary" loading={saving} disabled={loading || !estimate || walletBlocked}
          onClick={() => void approve()}>{confirmLabel ?? t('personalApi.guard.continue')}</Button>
      </div>
    </div>
  );
}

export async function confirmGenerationCost(
  intent: GenerationCostIntent,
): Promise<GenerationCostEstimate | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (estimate: GenerationCostEstimate | null) => {
      if (settled) return;
      settled = true;
      modal.destroy();
      resolve(estimate);
    };
    const modal = craftModal.confirm({
      ...GENERATION_COST_MODAL_THEME,
      title: i18n.t('personalApi.guard.title'),
      icon: null,
      width: 580,
      footer: null,
      closable: true,
      content: <GenerationApproval intent={intent} onDecision={finish} />,
      onCancel: () => finish(null),
    });
  });
}

export async function prepareGenerationCost(
  intent: GenerationCostIntent,
): Promise<GenerationCostEstimate | null> {
  let estimate: GenerationCostEstimate;
  try {
    estimate = await getGenerationCostEstimate(intent);
  } catch (error) {
    craftModal.error({
      ...GENERATION_COST_MODAL_THEME,
      title: i18n.t('credits.generation.estimateErrorTitle'),
      content: getApiErrorMessage(error, i18n.t('credits.generation.estimateError')),
    });
    return null;
  }
  if (estimate.generationSource !== 'personal' && !estimate.isFree && estimate.accountFrozen) {
    craftModal.error({
      ...GENERATION_COST_MODAL_THEME,
      title: i18n.t('credits.frozen.title'),
      content: i18n.t('credits.frozen.generation'),
    });
    return null;
  }
  if (estimate.generationSource !== 'personal' && !estimate.isFree && !estimate.sufficientBalance) {
    craftModal.error({
      ...GENERATION_COST_MODAL_THEME,
      title: i18n.t('credits.generation.insufficientTitle'),
      content: i18n.t('credits.generation.insufficientDescription', {
        required: formatGenerationCost(estimate.reservationAmount),
        available: formatGenerationCost(estimate.availableBalance),
      }),
    });
    return null;
  }
  return estimate;
}

export function getGenerationCostEstimate(
  intent: GenerationCostIntent,
): Promise<GenerationCostEstimate> {
  return estimateGenerationCost({
    ...intent,
    routingMode: intent.routingMode ?? getGenerationRoutingMode(),
  });
}

export async function runApprovedGeneration<T>(
  estimate: GenerationCostEstimate,
  operation: (approvedEstimate: GenerationCostEstimate) => Promise<T>,
): Promise<T> {
  const result = await operation(estimate);
  if (estimate.generationSource !== 'personal' && !estimate.isFree) notifyCreditBalanceUpdated();
  return result;
}

export async function runGenerationWithCredits<T>(
  intent: GenerationCostIntent,
  operation: (estimate: GenerationCostEstimate) => Promise<T>,
): Promise<T | undefined> {
  const estimate = await confirmGenerationCost(intent);
  if (!estimate) return undefined;
  return runApprovedGeneration(estimate, operation);
}

interface GenerationCostPreviewProps {
  intent: GenerationCostIntent;
  className?: string;
}

export const GenerationCostPreview: React.FC<GenerationCostPreviewProps> = ({
  intent,
  className = '',
}) => {
  const [estimate, setEstimate] = useState<GenerationCostEstimate | null>(null);
  const serializedIntent = useMemo(() => JSON.stringify(intent), [intent]);

  useEffect(() => {
    let active = true;
    void estimateGenerationCost({
      ...intent,
      routingMode: intent.routingMode ?? getGenerationRoutingMode(),
    }).then((result) => {
      if (active) setEstimate(result);
    }).catch(() => {
      if (active) setEstimate(null);
    });
    return () => {
      active = false;
    };
  }, [serializedIntent]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!estimate) return null;
  if (estimate.generationSource === 'personal') return <span className={`generation-cost-preview ${className}`}>{i18n.t('personalApi.guard.personal')}</span>;
  if (estimate.isFree) return <span className={`generation-cost-preview ${className}`}>{i18n.t('personalApi.guard.free')}</span>;
  if (Number(estimate.reservationAmount) <= 0) return null;
  return (
    <span
      className={`generation-cost-preview ${className}`.trim()}
      title={i18n.t('credits.generation.previewTitle', {
        amount: formatGenerationCostPreview(estimate.reservationAmount),
      })}
    >
      ≈ {formatGenerationCostPreview(estimate.estimatedCost)} C
    </span>
  );
};
