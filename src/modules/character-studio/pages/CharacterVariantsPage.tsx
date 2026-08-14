import React, { useEffect, useState } from 'react';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import {useLocation, useNavigate, useParams, useSearchParams} from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import {getApiStatus} from '../../../api/errors';
import { characterApi } from '../api/characterApi';
import {characterTreeApi} from '../api/treeApi';
import { notifyCharacterListUpdated, notifyCharacterTreeUpdated } from '../events';
import { useGenerationJob } from '../hooks/useGenerationJob';
import {defaultGenerationOptions} from '../components/create/GenerationSettingsPanel';
import type {GenerationOptions} from '../components/create/GenerationSettingsPanel';
import GenerationJobHistory from '../components/GenerationJobHistory';
import type {
    CharacterImageType,
    CharacterRegion,
    CharacterVariant,
    GenerationJob,
    StudioCharacter,
} from '../types/character.types';
import {characterToFormValues} from '../types/characterForm';
import {characterCreatePath} from '../../../routes/pathConstant';
import './CharacterVariantsPage.css';

interface VariantsPageState {
  formValues?: Record<string, unknown>;
  sourceTreeNodeId?: string;
  characterName?: string;
  generationOptions?: GenerationOptions;
}
const INITIAL_SECONDARY_ASSETS: Array<{
    imageType: CharacterImageType;
    region: CharacterRegion;
}> = [
    {imageType: 'full_body', region: 'body'},
    {imageType: 'scene', region: 'style'},
];
const VARIANT_GENERATION_JOB_TYPES = ['initial_variants', 'reference_variants'] as const;
const CANCELLATION_REQUESTED_LABEL = '\u041e\u0442\u043c\u0435\u043d\u0430 \u0437\u0430\u043f\u0440\u043e\u0448\u0435\u043d\u0430';
const CANCELLATION_REQUESTED_NOTICE = '\u0423\u0436\u0435 \u043d\u0430\u0447\u0430\u0442\u0430\u044f \u0433\u0435\u043d\u0435\u0440\u0430\u0446\u0438\u044f \u043c\u043e\u0436\u0435\u0442 \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u044c\u0441\u044f, \u043d\u043e \u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442 \u043d\u0435 \u0431\u0443\u0434\u0435\u0442 \u043f\u0440\u0438\u043c\u0435\u043d\u0451\u043d.';


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
    const [characterName, setCharacterName] = useState(state.characterName ?? '');
    const [characterData, setCharacterData] = useState<StudioCharacter | null>(null);
    const [characterLoading, setCharacterLoading] = useState(!state.characterName);
    const [characterError, setCharacterError] = useState<string | null>(null);

    const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
    const [applying, setApplying] = useState(false);
    const [regenerating, setRegenerating] = useState(false);
    const [regenError, setRegenError] = useState<string | undefined>();

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
            setRegenError(job.error_message || t('characterStudio.variants.generationFailedRetry'));
        }
        if (job?.status === 'cancellation_requested') {
            setRegenerating(false);
            setRegenError(CANCELLATION_REQUESTED_LABEL);
        }
    }, [job, t]);

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
    const handleRegenerate = async () => {
        if (regenerating) return;
        const formValues = effectiveFormValues;
        const opts = effectiveGenerationOptions;
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
                image_model: opts.imageModel,
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
            const jobResponse = await characterApi.generateInitial(
                projectId,
                characterId,
                payload,
                `character:${characterId}:portrait:${uuidv4()}`,
            );
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
        try {
            const appliedRevision = await characterApi.applyVariant(
                projectId,
                characterId,
                variantId,
                t('characterStudio.variants.portaitSelected'),
                'portrait',
            );

            // Tree node creation and list notifications are deferred here so that
            // draft characters never appear in UI lists before the user confirms a variant.
            const treeNodeId = sourceTreeNodeId || placementTreeNodeId;
            const charName = characterName;
            if (charName) {
                await characterTreeApi.create(projectId, {
                    id: treeNodeId,
                    name: charName,
                    type: 'character',
                    studio_character_id: characterId,
                });
            }
            notifyCharacterTreeUpdated();
            notifyCharacterListUpdated();

            const revisionId = appliedRevision.data?.revision_id;
            let secondaryLaunchFailed = false;
            const launchedJobs = revisionId
                ? await Promise.all(INITIAL_SECONDARY_ASSETS.map(async ({imageType, region}) => {
                    try {
                        const response = await characterApi.generateEdit(
                            projectId,
                            characterId,
                            {
                                region,
                                image_type: imageType,
                                controls: {},
                                preserve: {identity: true},
                                variant_count: 1,
                                activate_image: true,
                            },
                            `${characterId}:${imageType}:${revisionId}`,
                        );
                        const nextJobId = response.data?.job_id;
                        if (!nextJobId) secondaryLaunchFailed = true;
                        return nextJobId ? [imageType, nextJobId] as const : null;
                    } catch {
                        secondaryLaunchFailed = true;
                        return null;
                    }
                }))
                : [];
            const secondaryJobIds = Object.fromEntries(
                launchedJobs.filter((entry): entry is readonly [CharacterImageType, string] => entry !== null),
            );
            if (!revisionId || secondaryLaunchFailed) {
                message.warning(t('characterStudio.editor.generationError'));
            }

            navigate(`/project/${projectId}/characters/${characterId}/edit`, {
                state: {secondaryJobIds},
            });
        } catch {
            message.error(t('characterStudio.variants.selectError'));
        } finally {
            setApplying(false);
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
                    <p className="cvp-error__text">{job?.error_message || t('characterStudio.variants.tryAgain')}</p>
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
                        onClick={handleRegenerate}
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
                                onClick={() => setSelectedVariantId(variant.variant_id)}
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
