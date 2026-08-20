import {
  CheckCircleOutlined,
  HistoryOutlined,
  PlusOutlined,
  SoundOutlined,
} from '@ant-design/icons';
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Empty,
  Form,
  Input,
  InputNumber,
  Result,
  Segmented,
  Select,
  Skeleton,
  Slider,
  Spin,
  Tag,
} from 'antd';
import {flushSync} from 'react-dom';
import {useTranslation} from 'react-i18next';
import {useLocation, useNavigate, useParams, useSearchParams} from 'react-router-dom';

import {getApiErrorMessage} from '../../../api/errors';
import {backendAssetUrl} from '../../../api/http';
import {
  soundEffectCreatePath,
  soundEffectDetailPath,
  soundEffectJobPath,
  soundEffectsPath,
} from '../../../routes/pathConstant';
import {
  GenerationCostPreview,
  runGenerationWithCredits,
} from '../../credits/components/GenerationCostGuard';
import type {GenerationCostIntent} from '../../credits/components/GenerationCostGuard';
import MusicStudioShell from '../../music-studio/components/MusicStudioShell';
import {newSoundEffectIdempotencyKey, soundEffectsApi} from '../api/soundEffectsApi';
import {useSoundEffectJob} from '../hooks/useSoundEffectJob';
import type {
  SoundEffectCapabilities,
  SoundEffectCreateRequest,
  SoundEffectItem,
  SoundEffectJob,
  SoundEffectModel,
  SoundEffectPermissions,
} from '../types';
import '../soundEffects.css';
import '../../music-studio/musicStudio.css';

const DEFAULT_PERMISSIONS: SoundEffectPermissions = {canEdit: false, canRunGeneration: false};
const DEFAULT_DURATION_SECONDS = 5;
const DEFAULT_PROMPT_INFLUENCE = 0.3;
const PROMPT_MAX_CHARS = 450;
type SoundEffectEnqueueResponse = Awaited<ReturnType<typeof soundEffectsApi.enqueueJob>>;

function soundEffectCreditIntent(intent: {
  durationSeconds?: number;
  modelKey?: string;
  promptLength: number;
}): GenerationCostIntent {
  return {
    domain: 'sound_effect',
    operation: 'generate',
    variantCount: 1,
    ...intent,
  };
}

function jobIdFromResponse(response: SoundEffectJob | {jobId: string}): string {
  return response.jobId;
}

function selectedModelKey(
  capabilities: SoundEffectCapabilities,
  preferred: string | null,
): string {
  const models = capabilities.models ?? [];
  const preferredModel = models.find((model) => model.key === preferred && model.configured);
  if (preferredModel) return preferredModel.key;
  return models.find(
    (model) => model.key === capabilities.defaultModelKey && model.configured,
  )?.key
    ?? models.find((model) => model.default && model.configured)?.key
    ?? models.find((model) => model.configured)?.key
    ?? models[0]?.key
    ?? '';
}

function routeDetail(model: SoundEffectModel): string {
  const modelRoutes = model.routes ?? [];
  const routes = modelRoutes.filter((route) => route.configured);
  const candidates = routes.length ? routes : modelRoutes;
  const providers = Array.from(new Set(candidates.map((route) => route.providerDisplayName)))
    .join(', ') || model.providerDisplayName || '';
  const prices = candidates
    .filter((route) => route.unitCostUsd != null && String(route.unitCostUsd).trim() !== '')
    .map((route) => Number(route.unitCostUsd))
    .filter((price) => Number.isFinite(price));
  if (!prices.length) return providers;
  return `${providers} · $${Math.min(...prices).toFixed(2)}`;
}

export function soundEffectIntentFingerprint(payload: SoundEffectCreateRequest): string {
  return JSON.stringify(payload);
}

export default function SoundEffectsPage() {
  const {t} = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const {projectId = '', jobId, effectId: effectIdParam} = useParams<{
    effectId?: string;
    jobId?: string;
    projectId: string;
  }>();
  const [searchParams] = useSearchParams();
  const sceneId = Number(searchParams.get('sceneId')) || null;
  const targetEffectId = Number(searchParams.get('targetEffectId')) || null;
  const effectId = effectIdParam && /^\d+$/.test(effectIdParam) ? Number(effectIdParam) : null;
  const isCreateRoute = location.pathname.endsWith('/create');

  const [capabilities, setCapabilities] = useState<SoundEffectCapabilities | null>(null);
  const [permissions, setPermissions] = useState<SoundEffectPermissions>(DEFAULT_PERMISSIONS);
  const [models, setModels] = useState<SoundEffectModel[]>([]);
  const [modelKey, setModelKey] = useState('');
  const [prompt, setPrompt] = useState('');
  const [durationMode, setDurationMode] = useState<'auto' | 'custom'>('auto');
  const [durationSeconds, setDurationSeconds] = useState(DEFAULT_DURATION_SECONDS);
  const [loop, setLoop] = useState(false);
  const [promptInfluence, setPromptInfluence] = useState(DEFAULT_PROMPT_INFLUENCE);
  const [effects, setEffects] = useState<SoundEffectItem[]>([]);
  const [history, setHistory] = useState<SoundEffectJob[]>([]);
  const [libraryMode, setLibraryMode] = useState<'library' | 'history'>('library');
  const [selectedEffect, setSelectedEffect] = useState<SoundEffectItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [applyingVariantId, setApplyingVariantId] = useState<string | null>(null);
  const [dataRevision, setDataRevision] = useState(0);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const enqueueIntentRef = useRef<{fingerprint: string; key: string} | null>(null);
  const generation = useSoundEffectJob(projectId, jobId);

  const model = models.find((item) => item.key === modelKey) ?? null;
  const effectiveCapabilities = useMemo(() => ({
    duration: {
      autoSupported: true,
      defaultSeconds: DEFAULT_DURATION_SECONDS,
      maxSeconds: 30,
      minSeconds: 0.5,
      ...capabilities?.duration,
      ...model?.duration,
      ...model?.capabilities?.duration,
    },
    promptInfluence: {
      default: DEFAULT_PROMPT_INFLUENCE,
      max: 1,
      min: 0,
      ...capabilities?.promptInfluence,
      ...model?.promptInfluence,
      ...model?.capabilities?.promptInfluence,
    },
    supportsLoop: model?.capabilities?.supportsLoop
      ?? model?.supportsLoop
      ?? capabilities?.supportsLoop
      ?? true,
  }), [capabilities, model]);

  useEffect(() => () => activeAudioRef.current?.pause(), []);

  useEffect(() => {
    if (!projectId) return;
    const controller = new AbortController();
    setLoading(true);
    setPageError(null);
    void Promise.all([
      soundEffectsApi.getCapabilities(projectId, controller.signal),
      soundEffectsApi.listEffects(projectId, controller.signal),
      soundEffectsApi.listJobs(projectId, controller.signal),
    ]).then(([capabilitiesResponse, effectsResponse, jobsResponse]) => {
      if (controller.signal.aborted) return;
      const nextCapabilities = capabilitiesResponse.data;
      setCapabilities(nextCapabilities);
      setModels(nextCapabilities.models ?? []);
      setModelKey((current) => selectedModelKey(nextCapabilities, current));
      setPermissions(effectsResponse.data.permissions ?? nextCapabilities.permissions);
      setEffects(effectsResponse.data.items);
      setHistory(jobsResponse.data.items);
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) {
        setPageError(getApiErrorMessage(error, t('soundEffects.errors.load')));
      }
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [dataRevision, projectId, t]);

  useEffect(() => {
    setSelectedEffect(effectId ? effects.find((effect) => effect.id === effectId) ?? null : null);
  }, [effectId, effects]);

  useEffect(() => {
    const duration = effectiveCapabilities.duration;
    setDurationSeconds((current) => Math.min(
      duration.maxSeconds ?? 30,
      Math.max(duration.minSeconds ?? 0.5, current),
    ));
    if (!duration.autoSupported) setDurationMode('custom');
    if (!effectiveCapabilities.supportsLoop) setLoop(false);
    const influence = effectiveCapabilities.promptInfluence;
    setPromptInfluence((current) => Math.min(
      influence.max ?? 1,
      Math.max(influence.min ?? 0, current),
    ));
  }, [effectiveCapabilities]);

  const validate = (): string | null => {
    if (!model?.configured) return t('soundEffects.validation.model');
    if (!prompt.trim()) return t('soundEffects.validation.prompt');
    if (prompt.trim().length > (capabilities?.prompt?.maxChars ?? PROMPT_MAX_CHARS)) {
      return t('soundEffects.validation.promptLength');
    }
    if (durationMode === 'custom' && (
      durationSeconds < (effectiveCapabilities.duration.minSeconds ?? 0.5)
      || durationSeconds > (effectiveCapabilities.duration.maxSeconds ?? 30)
    )) return t('soundEffects.validation.duration');
    return null;
  };

  const enqueue = async () => {
    const validationError = validate();
    if (validationError || !model) {
      setPageError(validationError);
      return;
    }
    const basePayload: SoundEffectCreateRequest = {
      durationSeconds: durationMode === 'auto' ? null : durationSeconds,
      loop,
      modelKey: model.key,
      prompt: prompt.trim(),
      promptInfluence,
      sceneId,
      targetEffectId,
    };
    setSubmitting(true);
    setPageError(null);
    try {
      const response = await runGenerationWithCredits<SoundEffectEnqueueResponse>(soundEffectCreditIntent({
        durationSeconds: basePayload.durationSeconds ?? undefined,
        modelKey: basePayload.modelKey,
        promptLength: basePayload.prompt.length,
      }), (approvedEstimate) => {
        const payload = {...basePayload, modelKey: approvedEstimate.modelKey};
        const fingerprint = soundEffectIntentFingerprint(payload);
        const intent = enqueueIntentRef.current?.fingerprint === fingerprint
          ? enqueueIntentRef.current
          : {fingerprint, key: newSoundEffectIdempotencyKey()};
        enqueueIntentRef.current = intent;
        return soundEffectsApi.enqueueJob(projectId, payload, intent.key);
      });
      if (!response) return;
      navigate(soundEffectJobPath(projectId, response.data.jobId));
    } catch (error: unknown) {
      setPageError(getApiErrorMessage(error, t('soundEffects.errors.generate')));
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = async () => {
    if (!jobId) return;
    setActionLoading(true);
    try {
      await soundEffectsApi.cancelJob(projectId, jobId);
      generation.refresh();
    } catch (error: unknown) {
      setPageError(getApiErrorMessage(error, t('soundEffects.errors.generate')));
    } finally {
      setActionLoading(false);
    }
  };

  const retry = async () => {
    if (!jobId) return;
    setActionLoading(true);
    try {
      const response = await soundEffectsApi.retryJob(projectId, jobId);
      navigate(soundEffectJobPath(projectId, jobIdFromResponse(response.data)));
    } catch (error: unknown) {
      setPageError(getApiErrorMessage(error, t('soundEffects.errors.generate')));
    } finally {
      setActionLoading(false);
    }
  };

  const apply = async (variantId: string) => {
    if (!generation.job) return;
    setApplyingVariantId(variantId);
    try {
      const response = await soundEffectsApi.applyVariant(projectId, generation.job.jobId, variantId, {
        targetEffectId: generation.job.targetEffectId ?? null,
        title: generation.job.prompt.slice(0, 120),
      });
      flushSync(() => setDataRevision((current) => current + 1));
      navigate(response.data.effectId
        ? soundEffectDetailPath(projectId, response.data.effectId)
        : soundEffectsPath(projectId));
    } catch (error: unknown) {
      setPageError(getApiErrorMessage(error, t('soundEffects.errors.apply')));
    } finally {
      setApplyingVariantId(null);
    }
  };

  const playAudio = (audio: HTMLAudioElement) => {
    if (activeAudioRef.current && activeAudioRef.current !== audio) activeAudioRef.current.pause();
    activeAudioRef.current = audio;
  };

  const library = (
    <aside className="music-library sound-effects-library" aria-label={t('soundEffects.library.title')}>
      <div className="music-library__header">
        <div><h2>{t('soundEffects.library.title')}</h2></div>
        {permissions.canRunGeneration && (
          <Button
            aria-label={t('soundEffects.create.new')}
            className="music-library__create"
            icon={<PlusOutlined />}
            type="primary"
            onClick={() => navigate(soundEffectCreatePath(projectId))}
          />
        )}
      </div>
      <Segmented
        block
        className="music-library__tabs"
        value={libraryMode}
        options={[
          {label: t('soundEffects.library.title'), value: 'library'},
          {icon: <HistoryOutlined />, label: t('soundEffects.history.title'), value: 'history'},
        ]}
        onChange={(value) => setLibraryMode(value as 'library' | 'history')}
      />
      {loading ? <Skeleton active /> : libraryMode === 'library' ? (
        effects.length ? <div className="music-library__list">
          {effects.map((effect) => (
            <article className="music-library-row" key={effect.id}>
              <button type="button" onClick={() => navigate(soundEffectDetailPath(projectId, effect.id))}>
                <span><strong>{effect.title}</strong><small>{effect.activeVersion?.request?.prompt}</small></span>
              </button>
              {effect.activeVersion?.asset.audioUrl && (
                <audio
                  controls
                  preload="metadata"
                  aria-label={effect.title}
                  src={backendAssetUrl(effect.activeVersion.asset.audioUrl)}
                  onPlay={(event) => playAudio(event.currentTarget)}
                />
              )}
            </article>
          ))}
        </div> : <Empty description={t('soundEffects.library.empty')} />
      ) : history.length ? <div className="music-library__list">
        {history.map((item) => (
          <button
            className="music-history-row"
            key={item.jobId}
            type="button"
            onClick={() => navigate(soundEffectJobPath(projectId, item.jobId))}
          >
            <span><strong>{item.prompt}</strong><small>{item.modelKey}</small></span>
            <Tag>{t(`soundEffects.job.status.${item.status}`)}</Tag>
          </button>
        ))}
      </div> : <Empty description={t('soundEffects.history.empty')} />}
    </aside>
  );

  const createView = loading && !capabilities ? <Skeleton active /> : (
    <div className="music-create-view sound-effects-create">
      <div className="music-page-heading">
        <div><span className="music-eyebrow">{t('soundEffects.eyebrow')}</span><h1>{t('soundEffects.create.title')}</h1></div>
      </div>
      <section className="music-card">
        <Form component="div" layout="vertical">
          <Form.Item label={t('soundEffects.form.model')}>
            <Select
              aria-label={t('soundEffects.form.model')}
              disabled={!permissions.canRunGeneration}
              value={modelKey}
              options={models.map((item) => ({
                disabled: !item.configured,
                label: `${item.label}${routeDetail(item) ? ` · ${routeDetail(item)}` : ''}`,
                value: item.key,
              }))}
              onChange={setModelKey}
            />
          </Form.Item>
          <Form.Item label={t('soundEffects.form.prompt')} required>
            <Input.TextArea
              aria-label={t('soundEffects.form.prompt')}
              disabled={!permissions.canRunGeneration}
              maxLength={capabilities?.prompt?.maxChars ?? PROMPT_MAX_CHARS}
              rows={6}
              showCount
              value={prompt}
              placeholder={t('soundEffects.form.promptPlaceholder')}
              onChange={(event) => setPrompt(event.target.value)}
            />
          </Form.Item>
          <Form.Item label={t('soundEffects.form.duration')}>
            <Segmented
              disabled={!permissions.canRunGeneration}
              value={durationMode}
              options={[
                {label: t('soundEffects.form.durationAuto'), value: 'auto'},
                {label: t('soundEffects.form.durationCustom'), value: 'custom'},
              ].filter((option) => option.value !== 'auto' || effectiveCapabilities.duration.autoSupported)}
              onChange={(value) => setDurationMode(value as 'auto' | 'custom')}
            />
            {durationMode === 'custom' && (
              <InputNumber
                aria-label={t('soundEffects.form.durationSeconds')}
                disabled={!permissions.canRunGeneration}
                max={effectiveCapabilities.duration.maxSeconds}
                min={effectiveCapabilities.duration.minSeconds}
                step={0.5}
                value={durationSeconds}
                onChange={(value) => setDurationSeconds(value ?? DEFAULT_DURATION_SECONDS)}
              />
            )}
          </Form.Item>
          <Form.Item label={t('soundEffects.form.influence')}>
            <Slider
              disabled={!permissions.canRunGeneration}
              max={effectiveCapabilities.promptInfluence.max}
              min={effectiveCapabilities.promptInfluence.min}
              step={0.05}
              value={promptInfluence}
              onChange={setPromptInfluence}
            />
          </Form.Item>
          {effectiveCapabilities.supportsLoop && (
            <Checkbox
              checked={loop}
              disabled={!permissions.canRunGeneration}
              onChange={(event) => setLoop(event.target.checked)}
            >{t('soundEffects.form.loop')}</Checkbox>
          )}
        </Form>
      </section>
      {pageError && <Alert showIcon type="error" message={pageError} />}
    </div>
  );

  const jobView = generation.loading ? <div className="music-centered"><Spin /></div>
    : generation.errorMessage ? <Result status="error" title={generation.errorMessage} />
      : generation.job ? (
        <div className="music-job-view">
          <div className="music-page-heading"><div><span className="music-eyebrow">{t('soundEffects.job.title')}</span><h1>{generation.job.prompt}</h1></div></div>
          {generation.job.status === 'completed' ? (
            <Alert showIcon type="success" message={t('soundEffects.job.completed')} />
          ) : generation.job.status === 'failed' ? (
            <Result
              status="error"
              title={t('soundEffects.job.failed')}
              subTitle={generation.job.error?.detail}
              extra={generation.job.canRetry && <Button loading={actionLoading} onClick={() => void retry()}>{t('soundEffects.job.retry')}</Button>}
            />
          ) : generation.job.status === 'cancelled' ? (
            <Result status="info" title={t('soundEffects.job.cancelled')} />
          ) : (
            <section className="music-job-progress"><Spin /><div><h2>{t(`soundEffects.job.status.${generation.job.status}`)}</h2><p>{t('soundEffects.job.background')}</p>{generation.job.canCancel && <Button danger loading={actionLoading} onClick={() => void cancel()}>{t('soundEffects.job.cancel')}</Button>}</div></section>
          )}
          {generation.job.status === 'completed' && (
            <div className="music-variant-grid">
              {generation.job.variants.map((variant) => (
                <article className="music-variant-player" key={variant.variantId}>
                  <strong>{t('soundEffects.player.variant', {number: (variant.index ?? 0) + 1})}</strong>
                  {variant.audioUrl ? (
                    <audio controls preload="metadata" src={backendAssetUrl(variant.audioUrl)} onPlay={(event) => playAudio(event.currentTarget)} />
                  ) : <span>{t('soundEffects.player.unavailable')}</span>}
                  {permissions.canEdit && (
                    <Button
                      type="primary"
                      icon={variant.appliedEffectVersionId ? <CheckCircleOutlined /> : undefined}
                      disabled={Boolean(variant.appliedEffectVersionId)}
                      loading={applyingVariantId === variant.variantId}
                      onClick={() => void apply(variant.variantId)}
                    >{variant.appliedEffectVersionId ? t('soundEffects.player.applied') : t('soundEffects.player.apply')}</Button>
                  )}
                </article>
              ))}
            </div>
          )}
          {pageError && <Alert showIcon type="error" message={pageError} />}
        </div>
      ) : <Empty />;

  const detailView = selectedEffect ? (
    <div className="music-track-detail">
      <div className="music-page-heading"><div><span className="music-eyebrow">{t('soundEffects.detail.eyebrow')}</span><h1>{selectedEffect.title}</h1><p>{selectedEffect.activeVersion?.request?.prompt}</p></div></div>
      {selectedEffect.activeVersion?.asset.audioUrl ? (
        <section className="music-card">
          <audio controls preload="metadata" src={backendAssetUrl(selectedEffect.activeVersion.asset.audioUrl)} onPlay={(event) => playAudio(event.currentTarget)} />
          {permissions.canRunGeneration && <Button onClick={() => navigate(`${soundEffectCreatePath(projectId)}?targetEffectId=${selectedEffect.id}`)}>{t('soundEffects.detail.newVersion')}</Button>}
        </section>
      ) : <Empty description={t('soundEffects.player.unavailable')} />}
    </div>
  ) : loading ? <Skeleton active /> : <Empty />;

  const landingView = (
    <Result
      icon={<SoundOutlined />}
      title={t('soundEffects.landing.title')}
      subTitle={t('soundEffects.landing.subtitle')}
      extra={permissions.canRunGeneration && <Button type="primary" onClick={() => navigate(soundEffectCreatePath(projectId))}>{t('soundEffects.create.new')}</Button>}
    />
  );

  const center = isCreateRoute ? createView : jobId ? jobView : effectId ? detailView : landingView;
  const inspector = isCreateRoute ? (
    <div className="music-summary">
      <div className="music-summary__heading"><span className="music-eyebrow">{t('soundEffects.summary.eyebrow')}</span><h2>{t('soundEffects.summary.title')}</h2></div>
      <dl className="music-summary__list">
        <div><dt>{t('soundEffects.form.model')}</dt><dd>{model?.label ?? '—'}</dd></div>
        <div><dt>{t('soundEffects.form.duration')}</dt><dd>{durationMode === 'auto' ? t('soundEffects.form.durationAuto') : `${durationSeconds} ${t('musicStudio.units.seconds')}`}</dd></div>
        <div><dt>{t('soundEffects.form.loop')}</dt><dd>{loop ? t('common.yes') : t('common.no')}</dd></div>
      </dl>
      <div className="music-summary__action">
        <Button block type="primary" size="large" disabled={!permissions.canRunGeneration || Boolean(validate())} loading={submitting} onClick={() => void enqueue()}>{t('soundEffects.create.generate')}</Button>
        <GenerationCostPreview intent={soundEffectCreditIntent({
          durationSeconds: durationMode === 'auto' ? undefined : durationSeconds,
          modelKey: model?.key,
          promptLength: prompt.trim().length,
        })} />
      </div>
    </div>
  ) : <div className="music-context-card"><h2>{t('soundEffects.summary.title')}</h2><p>{t('soundEffects.summary.helper')}</p></div>;

  if (!projectId) return <Result status="404" />;
  return (
    <MusicStudioShell
      center={center}
      inspector={inspector}
      library={library}
      projectId={projectId}
      workspace="sound-effects"
    />
  );
}
