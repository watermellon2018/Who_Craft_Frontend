import {Button, Checkbox, message, Modal} from 'antd';
import React, {useEffect, useMemo, useRef, useState} from 'react';
import { useTranslation } from 'react-i18next';
import {useLocation, useNavigate, useParams, useSearchParams} from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import type {
    CharacterSecondaryAssetsQuote,
    CharacterSecondaryAssetType,
} from '../../../api/generated/contracts';
import {getApiStatus} from '../../../api/errors';
import i18n from '../../../i18n';
import {characterCreatePath} from '../../../routes/pathConstant';
import {getGenerationRoutingMode} from '../../credits/api/creditApi';
import {
    formatGenerationCost,
    GENERATION_COST_MODAL_THEME,
    runGenerationWithCredits,
} from '../../credits/components/GenerationCostGuard';
import GenerationJobHistory from '../components/GenerationJobHistory';
import {defaultGenerationOptions} from '../components/create/GenerationSettingsPanel';
import type {GenerationOptions} from '../components/create/GenerationSettingsPanel';
import {characterApi} from '../api/characterApi';
import {characterTreeApi} from '../api/treeApi';
import { notifyCharacterListUpdated, notifyCharacterTreeUpdated } from '../events';
import { useGenerationJob } from '../hooks/useGenerationJob';
import {useImageModelCatalog} from '../hooks/useImageModelCatalog';
import type {
    CharacterVariant,
    GenerationJob,
    StudioCharacter,
} from '../types/character.types';
import {characterToFormValues} from '../types/characterForm';
import './CharacterVariantsPage.css';

interface VariantsPageState {
  formValues?: Record<string, unknown>;
  sourceTreeNodeId?: string;
  characterName?: string;
  generationOptions?: GenerationOptions;
}
const INITIAL_SECONDARY_ASSETS = ['full_body', 'scene'] as const satisfies readonly CharacterSecondaryAssetType[];
type SecondaryGenerationDecision =
    | {kind: 'cancel'}
    | {kind: 'save-only'}
    | {imageTypes: CharacterSecondaryAssetType[]; kind: 'generate'; quote: CharacterSecondaryAssetsQuote};
const VARIANT_GENERATION_JOB_TYPES = ['initial_variants', 'reference_variants'] as const;
const CANCELLATION_REQUESTED_LABEL = '\u041e\u0442\u043c\u0435\u043d\u0430 \u0437\u0430\u043f\u0440\u043e\u0448\u0435\u043d\u0430';
const CANCELLATION_REQUESTED_NOTICE = '\u0423\u0436\u0435 \u043d\u0430\u0447\u0430\u0442\u0430\u044f \u0433\u0435\u043d\u0435\u0440\u0430\u0446\u0438\u044f \u043c\u043e\u0436\u0435\u0442 \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u044c\u0441\u044f, \u043d\u043e \u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442 \u043d\u0435 \u0431\u0443\u0434\u0435\u0442 \u043f\u0440\u0438\u043c\u0435\u043d\u0451\u043d.';

interface SecondaryGenerationConfirmationProps {
    characterId: string;
    imageModel?: string;
    onDecision: (decision: SecondaryGenerationDecision) => void;
    projectId: string;
    routingMode: ReturnType<typeof getGenerationRoutingMode>;
    variantId: string;
}

function SecondaryGenerationConfirmation({
    characterId,
    imageModel,
    onDecision,
    projectId,
    routingMode,
    variantId,
}: SecondaryGenerationConfirmationProps) {
    const {t} = useTranslation();
    const [selectedTypes, setSelectedTypes] = useState<CharacterSecondaryAssetType[]>(
        [...INITIAL_SECONDARY_ASSETS],
    );
    const selectedImageTypes = useMemo(
        () => INITIAL_SECONDARY_ASSETS.filter((imageType) => selectedTypes.includes(imageType)),
        [selectedTypes],
    );
    const selectionKey = selectedImageTypes.join(',');
    const [quoteState, setQuoteState] = useState<{
        failed: boolean;
        loading: boolean;
        quote: CharacterSecondaryAssetsQuote | null;
        selectionKey: string;
    }>({failed: false, loading: true, quote: null, selectionKey});
    const quoteStateIsCurrent = quoteState.selectionKey === selectionKey;
    const quote = quoteStateIsCurrent ? quoteState.quote : null;
    const estimateLoading = selectedImageTypes.length > 0 && (
        !quoteStateIsCurrent || quoteState.loading
    );
    const quoteFailed = quoteStateIsCurrent && quoteState.failed;
    useEffect(() => {
        let active = true;
        setQuoteState({failed: false, loading: true, quote: null, selectionKey});
        if (selectedImageTypes.length === 0) {
            setQuoteState({failed: false, loading: false, quote: null, selectionKey});
            return () => {
                active = false;
            };
        }
        void characterApi.quoteSecondaryAssets(projectId, characterId, {
            variant_id: variantId,
            image_types: [...selectedImageTypes],
            ...(imageModel ? {image_model: imageModel} : {}),
            routing_mode: routingMode,
        })
            .then((response) => {
                if (!active) return;
                setQuoteState({failed: false, loading: false, quote: response.data, selectionKey});
            })
            .catch(() => {
                if (active) {
                    setQuoteState({failed: true, loading: false, quote: null, selectionKey});
                }
            });
        return () => {
            active = false;
        };
    }, [characterId, imageModel, projectId, routingMode, selectedImageTypes, selectionKey, variantId]);
    const canGenerate = Boolean(
        selectedImageTypes.length > 0
        && quote?.quote_token
        && quote.account_frozen !== true
        && quote.sufficient_balance !== false,
    );
    const unavailableReason = selectedImageTypes.length === 0
        ? null
        : estimateLoading
            ? t('characterStudio.variants.secondaryGeneration.estimating')
            : quoteFailed || !quote
            ? t('characterStudio.variants.secondaryGeneration.estimateUnavailable')
            : quote.account_frozen
                ? t('credits.frozen.generation')
                : quote.sufficient_balance === false
                    ? t('credits.generation.insufficientDescription', {
                        required: formatGenerationCost(quote.totals.reservation_amount),
                        available: formatGenerationCost(quote.available_balance ?? '0'),
                    })
                    : null;

    const toggleType = (imageType: CharacterSecondaryAssetType, checked: boolean) => {
        setSelectedTypes((current) => checked
            ? [...current, imageType]
            : current.filter((value) => value !== imageType));
    };

    return (
        <div className="generation-cost-confirmation">
            <p>{t('characterStudio.variants.secondaryGeneration.description')}</p>
            <fieldset style={{border: 0, margin: '16px 0', padding: 0}}>
                <legend style={{color: 'var(--craft-text)', fontWeight: 700, marginBottom: 10}}>
                    {t('characterStudio.variants.secondaryGeneration.chooseAssets')}
                </legend>
                <div style={{display: 'grid', gap: 10}}>
                    {INITIAL_SECONDARY_ASSETS.map((imageType) => {
                        const quoteItem = quote?.items.find((item) => item.image_type === imageType);
                        return (
                        <Checkbox
                            checked={selectedTypes.includes(imageType)}
                            key={imageType}
                            onChange={(event) => toggleType(imageType, event.target.checked)}
                        >
                            <span style={{color: 'var(--craft-text)'}}>
                                {t(`characterStudio.variants.secondaryGeneration.assets.${imageType}`)}
                            </span>
                            <strong style={{color: 'var(--craft-accent)', marginLeft: 8}}>
                                {quoteItem
                                    ? `≈ ${formatGenerationCost(quoteItem.estimated_cost)} C`
                                    : t('characterStudio.variants.secondaryGeneration.costUnavailable')}
                            </strong>
                            {quoteItem && (
                                <small style={{color: 'var(--craft-text-muted)', display: 'block', marginLeft: 24}}>
                                    {quoteItem.model_name}
                                </small>
                            )}
                        </Checkbox>
                        );
                    })}
                </div>
            </fieldset>
            <dl>
                <div>
                    <dt>{t('characterStudio.variants.secondaryGeneration.total')}</dt>
                    <dd>
                        {selectedImageTypes.length === 0
                            ? '0 C'
                            : quote
                                ? `≈ ${formatGenerationCost(quote.totals.estimated_cost)} C`
                                : t('characterStudio.variants.secondaryGeneration.costUnavailable')}
                    </dd>
                </div>
                {quote?.items[0] && (
                    <div>
                        <dt>{t('credits.generation.routingMode')}</dt>
                        <dd>{t(`credits.routing.modes.${quote.items[0].routing_mode}.title`)}</dd>
                    </div>
                )}
            </dl>
            <small>{t('characterStudio.variants.secondaryGeneration.costHint')}</small>
            {unavailableReason && (
                <p role="status" style={{color: 'var(--craft-warning)', marginBottom: 0}}>
                    {unavailableReason}
                </p>
            )}
            <div style={{display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end', marginTop: 20}}>
                <Button onClick={() => onDecision({kind: 'cancel'})}>
                    {t('common.cancel')}
                </Button>
                <Button onClick={() => onDecision({kind: 'save-only'})}>
                    {t('characterStudio.variants.secondaryGeneration.saveOnly')}
                </Button>
                <Button
                    disabled={!canGenerate}
                    type="primary"
                    onClick={() => {
                        if (quote) {
                            onDecision({imageTypes: selectedImageTypes, kind: 'generate', quote});
                        }
                    }}
                >
                    {t('characterStudio.variants.secondaryGeneration.saveAndGenerate')}
                </Button>
            </div>
        </div>
    );
}

function confirmSecondaryGeneration(
    intent: Omit<SecondaryGenerationConfirmationProps, 'onDecision'>,
    signal: AbortSignal,
): Promise<SecondaryGenerationDecision> {
    return new Promise((resolve) => {
        let settled = false;
        let modal: ReturnType<typeof Modal.confirm> | null = null;
        const settle = (decision: SecondaryGenerationDecision) => {
            if (settled) return;
            settled = true;
            signal.removeEventListener('abort', handleAbort);
            modal?.destroy();
            resolve(decision);
        };
        const handleAbort = () => settle({kind: 'cancel'});
        if (signal.aborted) {
            settle({kind: 'cancel'});
            return;
        }
        signal.addEventListener('abort', handleAbort, {once: true});
        modal = Modal.confirm({
            ...GENERATION_COST_MODAL_THEME,
            closable: true,
            content: <SecondaryGenerationConfirmation {...intent} onDecision={settle} />,
            footer: null,
            icon: null,
            maskClosable: true,
            maskTransitionName: '',
            title: i18n.t('characterStudio.variants.secondaryGeneration.title'),
            transitionName: '',
            width: 620,
            onCancel: () => settle({kind: 'cancel'}),
        });
    });
}


function generationOptionsFromJob(job: GenerationJob | null): GenerationOptions {
    const payload = job?.request_payload ?? {};
    const requestedCount = Number(payload.variant_count ?? job?.variant_count ?? defaultGenerationOptions.count);
    const count = requestedCount === 1 || requestedCount === 2 || requestedCount === 4
        ? requestedCount
        : defaultGenerationOptions.count;
    const creativity = payload.creativity === 'strict' || payload.creativity === 'creative'
        ? payload.creativity
        : 'balanced';
    return {
        count,
        creativity,
        imageModel: typeof payload.image_model === 'string' ? payload.image_model : '',
        lockSeed: Boolean(payload.lock_seed),
        seed: payload.seed == null ? '' : String(payload.seed),
    };
}

export default function CharacterVariantsPage() {
    const {projectId = '', characterId = ''} = useParams<{projectId: string; characterId: string}>();
    return <CharacterVariantsPageContent key={`${projectId}:${characterId}`} />;
}

function CharacterVariantsPageContent() {
    const navigate = useNavigate();
    const {t} = useTranslation();
    const { projectId = '', characterId = '' } = useParams<{ projectId: string; characterId: string }>();
    const location = useLocation();
    const state = (location.state as VariantsPageState | null) ?? {};

    const [searchParams, setSearchParams] = useSearchParams();
    const currentJobId = searchParams.get('jobId') || undefined;
    const sourceTreeNodeId = searchParams.get('treeNodeId') || state.sourceTreeNodeId;
    const [placementTreeNodeId] = useState(() => sourceTreeNodeId || uuidv4());
    const {
        errorMessage,
        errorStatus,
        job,
        loading: jobLoading,
        retry: retryJobPolling,
    } = useGenerationJob(currentJobId, projectId, characterId);
    const {catalog: imageModelCatalog} = useImageModelCatalog(projectId);
    const [characterName, setCharacterName] = useState(state.characterName ?? '');
    const [characterData, setCharacterData] = useState<StudioCharacter | null>(null);
    const [characterLoading, setCharacterLoading] = useState(!state.characterName);
    const [characterError, setCharacterError] = useState<string | null>(null);

    const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
    const [applying, setApplying] = useState(false);
    const [regenerating, setRegenerating] = useState(false);
    const [regenError, setRegenError] = useState<string | undefined>();
    const [continueError, setContinueError] = useState<string | undefined>();
    const [appliedPortraitVariantId, setAppliedPortraitVariantId] = useState<string | null>(null);
    const mountedRef = useRef(true);
    const placementPersistedRef = useRef(false);
    const secondaryConfirmationControllerRef = useRef<AbortController | null>(null);

    useEffect(() => () => {
        mountedRef.current = false;
        secondaryConfirmationControllerRef.current?.abort();
    }, []);

    const recoveredCharacterValues = characterData ? characterToFormValues(characterData) : undefined;
    const hasFormContext = Boolean(recoveredCharacterValues || job?.request_payload || state.formValues);
    const effectiveFormValues = hasFormContext
        ? {...recoveredCharacterValues, ...state.formValues, ...job?.request_payload}
        : undefined;
    const durableGenerationOptions = generationOptionsFromJob(job);
    const hasDurableGenerationOptions = Boolean(
        job?.request_payload && Object.keys(job.request_payload).length > 0,
    );
    const effectiveGenerationOptions = hasDurableGenerationOptions
        ? durableGenerationOptions
        : {...durableGenerationOptions, ...state.generationOptions};
    const contextMismatch = Boolean(
        job && (
            (job.character_id && String(job.character_id) !== characterId)
            || (job.project_id != null && String(job.project_id) !== projectId)
        ),
    );
    const characterAge = Number(effectiveFormValues?.age);
    const isProviderBlocked = job?.error_code === 'IMAGE_PROVIDER_BLOCKED';
    const isChildProviderBlocked = Boolean(
        isProviderBlocked
        && Number.isFinite(characterAge)
        && characterAge >= 0
        && characterAge < 18,
    );
    const currentImageModel = effectiveGenerationOptions.imageModel || imageModelCatalog?.current || '';
    const childModelRecommendations = useMemo(() => (
        imageModelCatalog?.available.filter((model) => {
            const modelIdentifier = `${model.key} ${model.model_id}`.toLowerCase();
            return model.configured
                && model.supports_generate
                && model.key !== currentImageModel
                && model.key.startsWith('openrouter-images:')
                && modelIdentifier.includes('openai/gpt-image');
        }) ?? []
    ), [currentImageModel, imageModelCatalog]);
    const jobFailureMessage = isChildProviderBlocked
        ? t('characterStudio.variants.childGenerationBlocked')
        : isProviderBlocked
            ? t('characterStudio.variants.providerBlocked')
            : job?.error_message || t('characterStudio.variants.tryAgain');

    useEffect(() => {
        if (characterName) {
            setCharacterLoading(false);
            return;
        }
        if (!currentJobId || !projectId || !characterId) return;
        let cancelled = false;
        setCharacterLoading(true);
        setCharacterError(null);
        characterApi.get(projectId, characterId)
            .then((response) => {
                if (cancelled) return;
                const recoveredCharacter = response.data as StudioCharacter;
                const recoveredName = recoveredCharacter.name ?? '';
                setCharacterData(recoveredCharacter);
                setCharacterName(recoveredName);
                if (!recoveredName) setCharacterError('Не удалось восстановить имя персонажа');
            })
            .catch((error: unknown) => {
                if (cancelled) return;
                const status = getApiStatus(error);
                setCharacterError(status === 403
                    ? 'Нет доступа к персонажу'
                    : status === 404
                        ? 'Персонаж не найден'
                        : 'Не удалось загрузить персонажа');
            })
            .finally(() => {
                if (!cancelled) setCharacterLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [characterId, characterName, currentJobId, projectId]);

    // Persist the last successfully loaded variants so the grid stays visible
    // while a new regeneration job is in flight.
    const [displayVariants, setDisplayVariants] = useState<CharacterVariant[]>(
        job?.variants ?? [],
    );

    useEffect(() => {
        if (job?.status === 'completed') {
            setDisplayVariants(job.variants ?? []);
            setRegenerating(false);
            setRegenError(undefined);
        }
        if (job?.status === 'failed') {
            setRegenerating(false);
            setRegenError(jobFailureMessage);
        }
        if (job?.status === 'cancellation_requested') {
            setRegenerating(false);
            setRegenError(CANCELLATION_REQUESTED_LABEL);
        }
    }, [job, jobFailureMessage, t]);

    const effectiveSelectedId = selectedVariantId ?? displayVariants[0]?.variant_id ?? null;

    const noContext = !currentJobId;
    // Full-page loading only for the initial job (no displayVariants yet).
    const isInitialLoading = !noContext && !errorMessage && !contextMismatch && displayVariants.length === 0 && (
        jobLoading || job === null || job.status === 'queued' || job.status === 'processing'
    );
    // Grid-level loading during regeneration (we still have displayVariants to show).
    const isRegeneratingGrid = regenerating && (
        job === null || job.status === 'queued' || job.status === 'processing'
    );
    const isFailed = !noContext && !regenerating && job?.status === 'failed';
    const isEmpty = !noContext && job?.status === 'completed' && displayVariants.length === 0;
    const isCancelled = !noContext && job?.status === 'cancelled';
    const isCancellationRequested = job?.status === 'cancellation_requested';

    const handleBack = () => navigate(-1);

    const handleHistoryJobStarted = (nextJobId: string) => {
        setRegenerating(displayVariants.length > 0);
        setRegenError(undefined);
        setSelectedVariantId(null);
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set('jobId', nextJobId);
        setSearchParams(nextParams, {replace: true, state});
    };

    // Pass form values and draft character id back so the form can be pre-filled
    // and the same draft character can be reused (no new character created).
    const buildEditState = () => ({
        formValues: effectiveFormValues
            ? {...effectiveFormValues, name: effectiveFormValues.name ?? characterName}
            : undefined,
        characterId,
        sourceTreeNodeId,
        initialCharacterName: characterName,
        generationOptions: effectiveGenerationOptions,
    });

    const handleEditParams = () => {
        navigate(characterCreatePath(projectId, {draftId: characterId, treeNodeId: sourceTreeNodeId}), {
            state: buildEditState(),
        });
    };

    // Regenerate: re-run generation with the same params, stay on this page.
    const handleRegenerate = async (modelOverride?: string) => {
        if (regenerating) return;
        const formValues = effectiveFormValues;
        const opts = effectiveGenerationOptions;
        const imageModel = modelOverride ?? opts.imageModel;
        if (!formValues) {
            message.error(t('characterStudio.variants.missingParams'));
            return;
        }
        setRegenerating(true);
        setRegenError(undefined);
        setSelectedVariantId(null);
        try {
            const payload = {
                variant_count: opts.count,
                image_type: 'portrait',
                image_model: imageModel,
                creativity: opts.creativity,
                seed: opts.lockSeed && opts.seed ? Number(opts.seed) : undefined,
                lock_seed: opts.lockSeed,
                visual_style: formValues.visual_style,
                text_refinement: formValues.appearance_description,
                character_type: formValues.character_type,
                age: formValues.age,
                lifecycle_stage: formValues.lifecycle_stage,
                body_structure: formValues.body_structure,
                surface_material: formValues.surface_material,
                special_features: formValues.special_features,
                appearance_description: formValues.appearance_description,
            };
            const jobResponse = await runGenerationWithCredits(
                {
                    domain: 'character',
                    operation: 'generate',
                    modelKey: imageModel,
                    variantCount: opts.count,
                    promptLength: String(formValues.appearance_description ?? '').length,
                    routingMode: modelOverride ? 'manual' : undefined,
                },
                (estimate) => characterApi.generateInitial(
                    projectId,
                    characterId,
                    {
                        ...payload,
                        image_model: estimate.modelKey,
                        routing_mode: estimate.routingMode,
                    },
                    `character:${characterId}:portrait:${uuidv4()}`,
                ),
            );
            if (!jobResponse) {
                setRegenerating(false);
                return;
            }
            if (jobResponse.data?.status === 'failed') {
                setRegenError(jobResponse.data?.error_message || t('characterStudio.editor.saveGeneric'));
                setRegenerating(false);
                return;
            }
            const newJobId = jobResponse.data?.job_id;
            if (newJobId) {
                setRegenerating(true);
                const nextParams = new URLSearchParams(searchParams);
                nextParams.set('jobId', newJobId);
                setSearchParams(nextParams, {replace: true, state});
            } else {
                setRegenError(t('characterStudio.variants.noJobId'));
                setRegenerating(false);
            }
        } catch {
            setRegenError(t('characterStudio.variants.generationLaunchError'));
            setRegenerating(false);
        }
    };

    const handleContinue = async () => {
        const variantId = effectiveSelectedId;
        if (!variantId) return;
        setApplying(true);
        setContinueError(undefined);
        try {
            const confirmationController = new AbortController();
            secondaryConfirmationControllerRef.current?.abort();
            secondaryConfirmationControllerRef.current = confirmationController;
            const decision = await confirmSecondaryGeneration({
                characterId,
                imageModel: effectiveGenerationOptions.imageModel || undefined,
                projectId,
                routingMode: getGenerationRoutingMode(),
                variantId,
            }, confirmationController.signal);
            if (secondaryConfirmationControllerRef.current === confirmationController) {
                secondaryConfirmationControllerRef.current = null;
            }
            if (!mountedRef.current || decision.kind === 'cancel') return;

            if (appliedPortraitVariantId !== variantId) {
                await characterApi.applyVariant(
                    projectId,
                    characterId,
                    variantId,
                    t('characterStudio.variants.portaitSelected'),
                    'portrait',
                );

                // Tree node creation and list notifications are deferred here so that
                // draft characters never appear in UI lists before the user confirms a variant.
                if (!placementPersistedRef.current && characterName) {
                    const treeNodeId = sourceTreeNodeId || placementTreeNodeId;
                    await characterTreeApi.create(projectId, {
                        id: treeNodeId,
                        name: characterName,
                        type: 'character',
                        studio_character_id: characterId,
                    });
                    placementPersistedRef.current = true;
                    notifyCharacterTreeUpdated();
                }
                notifyCharacterListUpdated();
                setAppliedPortraitVariantId(variantId);
            }

            if (decision.kind === 'save-only') {
                navigate(`/project/${projectId}/characters/${characterId}/edit`, {
                    state: {secondaryJobIds: {}},
                });
                return;
            }

            try {
                const response = await characterApi.generateSecondaryAssets(
                    projectId,
                    characterId,
                    decision.quote.quote_token,
                );
                const failedJob = response.data.jobs.find((jobItem) => (
                    jobItem.status === 'failed' || !jobItem.job_id
                ));
                if (failedJob) throw new Error(failedJob.error_message || 'secondary generation failed');
                const secondaryJobIds = Object.fromEntries(
                    response.data.jobs.map((jobItem) => [jobItem.image_type, jobItem.job_id]),
                );
                navigate(`/project/${projectId}/characters/${characterId}/edit`, {
                    state: {secondaryJobIds},
                });
            } catch {
                if (mountedRef.current) {
                    const errorText = t('characterStudio.variants.secondaryGeneration.portraitSavedGenerationFailed');
                    setContinueError(errorText);
                    message.error(errorText);
                }
            }
        } catch {
            if (mountedRef.current) message.error(t('characterStudio.variants.selectError'));
        } finally {
            if (mountedRef.current) setApplying(false);
        }
    };

    if (noContext) {
        return (
            <div className="cvp-page">
                <div className="cvp-error">
                    <p className="cvp-error__title">{t('characterStudio.variants.noSession')}</p>
                    <p className="cvp-error__text">{t('characterStudio.variants.backToForm')}</p>
                    <button className="cvp-btn-accent" onClick={handleEditParams}>
                        {t('characterStudio.variants.backToForm')}
                    </button>
                </div>
            </div>
        );
    }

    if (errorMessage || characterError || contextMismatch) {
        const title = errorStatus === 403
            ? 'Нет доступа к генерации'
            : errorStatus === 404
                ? 'Генерация не найдена'
                : characterError
                    ? characterError
                    : contextMismatch
                        ? 'Задание не относится к этому персонажу'
                        : 'Не удалось загрузить генерацию';
        return (
            <div className="cvp-page">
                <div className="cvp-error">
                    <p className="cvp-error__title">{title}</p>
                    <p className="cvp-error__text">{errorMessage || characterError || 'Проверьте адрес страницы и попробуйте снова.'}</p>
                    {errorMessage && <button className="cvp-btn-accent" onClick={retryJobPolling}>
                        {'\u041f\u043e\u0432\u0442\u043e\u0440\u0438\u0442\u044c'}
                    </button>}
                    <button className="cvp-btn-accent" onClick={handleEditParams}>
                        {t('characterStudio.variants.backToForm')}
                    </button>
                </div>
            </div>
        );
    }

    if (isInitialLoading) {
        return (
            <div className="cvp-page">
                <div className="cvp-loading">
                    <div className="cvp-loading__spinner" />
                    <p className="cvp-loading__title">
                        {isCancellationRequested ? 'Отмена запрошена' : t('characterStudio.variants.generatingPortraits')}
                    </p>
                    <p className="cvp-loading__sub">
                        {isCancellationRequested
                            ? 'Уже начатая генерация может завершиться, но результат не будет применён.'
                            : t('characterStudio.variants.typicalTime')}
                    </p>
                    {job && typeof job.progress === 'number' && job.progress > 0 && (
                        <div className="cvp-progress">
                            <div className="cvp-progress__bar" style={{ width: `${job.progress}%` }} />
                        </div>
                    )}
                    <GenerationJobHistory
                        allowedJobTypes={VARIANT_GENERATION_JOB_TYPES}
                        characterId={characterId}
                        className="cvp-generation-history"
                        currentJob={job}
                        currentJobId={currentJobId}
                        defaultOpen
                        onJobStarted={handleHistoryJobStarted}
                        projectId={projectId}
                    />
                </div>
            </div>
        );
    }
    if (isCancellationRequested && displayVariants.length === 0) {
        return (
            <div className="cvp-page">
                <div className="cvp-error">
                    <p className="cvp-error__title">{CANCELLATION_REQUESTED_LABEL}</p>
                    <p className="cvp-error__text">
                        {CANCELLATION_REQUESTED_NOTICE}
                    </p>
                    <button className="cvp-btn-accent" onClick={handleEditParams}>
                        {t('characterStudio.variants.backToForm')}
                    </button>
                    <GenerationJobHistory
                        allowedJobTypes={VARIANT_GENERATION_JOB_TYPES}
                        characterId={characterId}
                        className="cvp-generation-history"
                        currentJob={job}
                        currentJobId={currentJobId}
                        defaultOpen
                        onJobStarted={handleHistoryJobStarted}
                        projectId={projectId}
                    />
                </div>
            </div>
        );
    }


    if (isFailed) {
        return (
            <div className="cvp-page">
                <div className="cvp-error">
                    <p className="cvp-error__title">{t('characterStudio.variants.generationError')}</p>
                    <p className="cvp-error__text">{jobFailureMessage}</p>
                    {isChildProviderBlocked && childModelRecommendations.length > 0 && (
                        <div>
                            <p className="cvp-error__text">
                                {t('characterStudio.variants.childModelRecommendations')}
                            </p>
                            <div style={{display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center'}}>
                                {childModelRecommendations.map((model) => (
                                    <button
                                        className="cvp-btn-secondary"
                                        key={model.key}
                                        type="button"
                                        onClick={() => void handleRegenerate(model.key)}
                                    >
                                        {t('characterStudio.variants.retryWithModel', {model: model.label})}
                                    </button>
                                ))}
                            </div>
                            <p className="cvp-error__text">
                                {t('characterStudio.variants.childModelDisclaimer')}
                            </p>
                        </div>
                    )}
                    <button className="cvp-btn-accent" onClick={handleEditParams}>
                        {t('characterStudio.variants.backToForm')}
                    </button>
                    <GenerationJobHistory
                        allowedJobTypes={VARIANT_GENERATION_JOB_TYPES}
                        characterId={characterId}
                        className="cvp-generation-history"
                        currentJob={job}
                        currentJobId={currentJobId}
                        defaultOpen
                        onJobStarted={handleHistoryJobStarted}
                        projectId={projectId}
                    />
                </div>
            </div>
        );

    }
    if (isCancelled) {
        return (
            <div className="cvp-page">
                <div className="cvp-error">
                    <p className="cvp-error__title">Генерация отменена</p>
                    <p className="cvp-error__text">Можно повторить генерацию из истории.</p>
                    <button className="cvp-btn-accent" onClick={handleEditParams}>
                        {t('characterStudio.variants.backToForm')}
                    </button>
                    <GenerationJobHistory
                        allowedJobTypes={VARIANT_GENERATION_JOB_TYPES}
                        characterId={characterId}
                        className="cvp-generation-history"
                        currentJob={job}
                        currentJobId={currentJobId}
                        defaultOpen
                        onJobStarted={handleHistoryJobStarted}
                        projectId={projectId}
                    />
                </div>
            </div>
        );
    }

    if (isEmpty) {
        return (
            <div className="cvp-page">
                <div className="cvp-error">
                    <p className="cvp-error__title">{t('characterStudio.variants.noVariants')}</p>
                    <p className="cvp-error__text">{t('characterStudio.variants.securityCheckFailed')}</p>
                    <button className="cvp-btn-accent" onClick={handleEditParams}>
                        {t('characterStudio.variants.backToForm')}
                    </button>
                </div>
            </div>
        );
    }

    const displaySelectedVariant = displayVariants.find(v => v.variant_id === effectiveSelectedId) ?? null;
    // Number of skeleton cards to show during regeneration (match expected count).
    const skeletonCount = effectiveGenerationOptions.count ?? displayVariants.length;

    return (
        <div className="cvp-page">
            <div className="cvp-header">
                <div className="cvp-header-left">
                    <button className="cvp-back-btn" onClick={handleBack}>
                        {t('characterStudio.variants.back')}
                    </button>
                    <div>
                        <h1 className="cvp-title">{t('characterStudio.variants.selectVariant')}</h1>
                        <p className="cvp-subtitle">
                            {t('characterStudio.variants.subtitle')}
                        </p>
                    </div>
                </div>
                <div className="cvp-header-actions">
                    <button className="cvp-btn-secondary" onClick={handleEditParams} disabled={regenerating || characterLoading}>
                        {t('characterStudio.variants.editParams')}
                    </button>
                    <button
                        className="cvp-btn-accent"
                        onClick={() => void handleRegenerate()}
                        disabled={regenerating}
                    >
                        {regenerating ? (
                            <>
                                <span className="cvp-btn-spinner" />
                                {t('characterStudio.variants.regenerating')}
                            </>
                        ) : (
                            t('characterStudio.variants.regenerate')
                        )}
                    </button>
                </div>
            </div>

            {regenError && (
                <div className="cvp-regen-error">
                    {regenError}
                </div>
            )}

            {continueError && (
                <div className="cvp-regen-error" role="alert">
                    {continueError}
                </div>
            )}

            <GenerationJobHistory
                allowedJobTypes={VARIANT_GENERATION_JOB_TYPES}
                characterId={characterId}
                className="cvp-generation-history cvp-generation-history--page"
                currentJob={job}
                currentJobId={currentJobId}
                onJobStarted={handleHistoryJobStarted}
                projectId={projectId}
            />

            <div className="cvp-grid">

                {isRegeneratingGrid
                    ? Array.from({ length: skeletonCount }, (_, i) => (
                        <div key={`skeleton-${i}`} className="cvp-card cvp-card--skeleton">
                            <div className="cvp-card-img-placeholder cvp-card-img-placeholder--loading" />
                            <span className="cvp-card-label">{t('characterStudio.variants.labelVariant', {index: i + 1})}</span>
                        </div>
                    ))
                    : displayVariants.map((variant, idx) => {
                        const isSelected = (selectedVariantId ?? displayVariants[0]?.variant_id) === variant.variant_id;
                        return (
                            <div
                                key={variant.variant_id}
                                className={`cvp-card${isSelected ? ' cvp-card--selected' : ''}`}
                                onClick={() => {
                                    setSelectedVariantId(variant.variant_id);
                                    setContinueError(undefined);
                                }}
                            >
                                {variant.image_url ? (
                                    <img
                                        className="cvp-card-img"
                                        src={variant.image_url}
                                        alt={t('characterStudio.variants.altVariant', {index: idx + 1})}
                                    />
                                ) : (
                                    <div className="cvp-card-img-placeholder" />
                                )}
                                <span className="cvp-card-label">{t('characterStudio.variants.labelVariant', {index: idx + 1})}</span>
                                <div className="cvp-card-footer">
                                    <div className="cvp-radio">
                                        <span className="cvp-radio-check">✓</span>
                                    </div>
                                    <span className="cvp-select-label">
                                        {isSelected ? t('characterStudio.variants.selected') : t('characterStudio.variants.select')}
                                    </span>
                                </div>
                            </div>
                        );
                    })
                }
            </div>

            <div className="cvp-bottom-panel">
                <div className="cvp-panel-left">
                    {displaySelectedVariant?.image_url ? (
                        <img
                            className="cvp-thumb"
                            src={displaySelectedVariant.image_url}
                            alt={t('characterStudio.variants.altSelectedVariant')}
                        />
                    ) : (
                        <div className="cvp-thumb-placeholder" />
                    )}
                    <span className="cvp-selected-label">
                        {t('characterStudio.variants.selectedPrefix')}{' '}
                        <span>
                            {t('characterStudio.variants.labelVariant', {index: (displayVariants.findIndex(v => v.variant_id === effectiveSelectedId) + 1) || 1})}
                        </span>
                    </span>
                </div>
                <div className="cvp-panel-right">
                    <button
                        className="cvp-btn-continue"
                        disabled={!effectiveSelectedId || applying || regenerating || characterLoading || !characterName}
                        onClick={handleContinue}
                    >
                        {applying ? t('characterStudio.variants.applying') : t('characterStudio.variants.continue')}
                    </button>
                    <span className="cvp-continue-hint">{t('characterStudio.variants.continueHint')}</span>
                </div>
            </div>
        </div>
    );
}
