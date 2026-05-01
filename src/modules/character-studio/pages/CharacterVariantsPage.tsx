import React, { useEffect, useState } from 'react';
import { message } from 'antd';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { createCharacterFromTreeAPI } from '../../../api/generation/characters/tree_structure';
import { characterApi } from '../api/characterApi';
import { notifyCharacterListUpdated, notifyCharacterTreeUpdated } from '../events';
import { useGenerationJob } from '../hooks/useGenerationJob';
import { CharacterVariant } from '../types/character.types';
import { GenerationOptions } from '../components/create/GenerationSettingsPanel';
import PathConstants from '../../../routes/pathConstant';
import './CharacterVariantsPage.css';

interface VariantsPageState {
  jobId?: string;
  formValues?: Record<string, unknown>;
  characterId?: string;
  sourceTreeNodeId?: string;
  characterName?: string;
  generationOptions?: GenerationOptions;
}

export default function CharacterVariantsPage() {
    const navigate = useNavigate();
    const { projectId = '', characterId = '' } = useParams<{ projectId: string; characterId: string }>();
    const location = useLocation();
    const state = (location.state as VariantsPageState | null) ?? {};

    // Mutable job id — updated when user clicks Regenerate without navigating away.
    const [currentJobId, setCurrentJobId] = useState<string | undefined>(state.jobId ?? undefined);
    const { job } = useGenerationJob(currentJobId);

    const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
    const [applying, setApplying] = useState(false);
    const [regenerating, setRegenerating] = useState(false);
    const [regenError, setRegenError] = useState<string | undefined>();

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
            setRegenError(job.error_message || 'Ошибка генерации. Попробуйте ещё раз.');
        }
    }, [job]);

    const effectiveSelectedId = selectedVariantId ?? displayVariants[0]?.variant_id ?? null;

    const noContext = !currentJobId;
    // Full-page loading only for the initial job (no displayVariants yet).
    const isInitialLoading = !noContext && displayVariants.length === 0 && (
        job === null || job.status === 'queued' || job.status === 'processing'
    );
    // Grid-level loading during regeneration (we still have displayVariants to show).
    const isRegeneratingGrid = regenerating && (
        job === null || job.status === 'queued' || job.status === 'processing'
    );
    const isFailed = !noContext && !regenerating && job?.status === 'failed';
    const isEmpty = !noContext && job?.status === 'completed' && displayVariants.length === 0;

    const handleBack = () => navigate(-1);

    // Pass form values and draft character id back so the form can be pre-filled
    // and the same draft character can be reused (no new character created).
    const buildEditState = () => ({
        formValues: state.formValues,
        characterId,
        sourceTreeNodeId: state.sourceTreeNodeId,
        generationOptions: state.generationOptions,
    });

    const handleEditParams = () => {
        navigate(PathConstants.CHARACTER_STUDIO_CREATE.replace(':projectId', projectId), {
            state: buildEditState(),
        });
    };

    // Regenerate: re-run generation with the same params, stay on this page.
    const handleRegenerate = async () => {
        if (regenerating) return;
        const { formValues, generationOptions: opts } = state;
        if (!formValues) {
            message.error('Параметры генерации недоступны. Используйте «Изменить параметры».');
            return;
        }
        setRegenerating(true);
        setRegenError(undefined);
        setSelectedVariantId(null);
        try {
            const jobResponse = await characterApi.generateInitial(projectId, characterId, {
                variant_count: opts?.count ?? 1,
                image_type: 'portrait',
                creativity: opts?.creativity ?? 'balanced',
                seed: opts?.lockSeed && opts?.seed ? Number(opts.seed) : undefined,
                lock_seed: opts?.lockSeed ?? false,
                visual_style: formValues.visual_style,
                text_refinement: formValues.appearance_description,
                character_type: formValues.character_type,
                age: formValues.age,
                lifecycle_stage: formValues.lifecycle_stage,
                body_structure: formValues.body_structure,
                surface_material: formValues.surface_material,
                special_features: formValues.special_features,
                appearance_description: formValues.appearance_description,
            });
            if (jobResponse.data?.status === 'failed') {
                setRegenError(jobResponse.data?.error_message || 'Генерация не удалась');
                setRegenerating(false);
                return;
            }
            const newJobId = jobResponse.data?.job_id;
            if (newJobId) {
                setCurrentJobId(newJobId);
            } else {
                setRegenError('Сервер не вернул идентификатор задачи');
                setRegenerating(false);
            }
        } catch {
            setRegenError('Ошибка при запуске генерации. Попробуйте ещё раз.');
            setRegenerating(false);
        }
    };

    const handleContinue = async () => {
        const variantId = effectiveSelectedId;
        if (!variantId) return;
        setApplying(true);
        try {
            await characterApi.applyVariant(projectId, characterId, variantId, 'Портрет выбран при создании', 'portrait');

            // Tree node creation and list notifications are deferred here so that
            // draft characters never appear in UI lists before the user confirms a variant.
            const treeNodeId = state.sourceTreeNodeId || uuidv4();
            const charName = state.characterName || '';
            if (charName) {
                await createCharacterFromTreeAPI(treeNodeId, charName, 'leaf', projectId, null, null, characterId);
            }
            notifyCharacterTreeUpdated();
            notifyCharacterListUpdated();

            navigate(`/project/${projectId}/characters/${characterId}/edit`);
        } catch {
            message.error('Ошибка при выборе варианта. Попробуйте ещё раз.');
        } finally {
            setApplying(false);
        }
    };

    if (noContext) {
        return (
            <div className="cvp-page">
                <div className="cvp-error">
                    <p className="cvp-error__title">Сессия не найдена</p>
                    <p className="cvp-error__text">Вернитесь к форме создания персонажа.</p>
                    <button className="cvp-btn-accent" onClick={handleEditParams}>
                        ← Вернуться к форме создания
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
                    <p className="cvp-loading__title">Генерируем портретные варианты…</p>
                    <p className="cvp-loading__sub">Обычно это занимает 10–30 секунд</p>
                    {job && typeof job.progress === 'number' && job.progress > 0 && (
                        <div className="cvp-progress">
                            <div className="cvp-progress__bar" style={{ width: `${job.progress}%` }} />
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (isFailed) {
        return (
            <div className="cvp-page">
                <div className="cvp-error">
                    <p className="cvp-error__title">Ошибка генерации</p>
                    <p className="cvp-error__text">{job?.error_message || 'Попробуйте создать персонажа ещё раз.'}</p>
                    <button className="cvp-btn-accent" onClick={handleEditParams}>
                        ← Вернуться к форме создания
                    </button>
                </div>
            </div>
        );
    }

    if (isEmpty) {
        return (
            <div className="cvp-page">
                <div className="cvp-error">
                    <p className="cvp-error__title">Варианты не были созданы</p>
                    <p className="cvp-error__text">Возможно, параметры персонажа не прошли проверку безопасности.</p>
                    <button className="cvp-btn-accent" onClick={handleEditParams}>
                        ← Вернуться к форме создания
                    </button>
                </div>
            </div>
        );
    }

    const displaySelectedVariant = displayVariants.find(v => v.variant_id === effectiveSelectedId) ?? null;
    // Number of skeleton cards to show during regeneration (match expected count).
    const skeletonCount = state.generationOptions?.count ?? displayVariants.length;

    return (
        <div className="cvp-page">
            <div className="cvp-header">
                <div className="cvp-header-left">
                    <button className="cvp-back-btn" onClick={handleBack}>
                        ← Назад
                    </button>
                    <div>
                        <h1 className="cvp-title">Выберите вариант персонажа</h1>
                        <p className="cvp-subtitle">
                            Мы сгенерировали несколько вариантов на основе ваших параметров. Выберите понравившийся портрет.
                        </p>
                    </div>
                </div>
                <div className="cvp-header-actions">
                    <button className="cvp-btn-secondary" onClick={handleEditParams} disabled={regenerating}>
                        Изменить параметры
                    </button>
                    <button
                        className="cvp-btn-accent"
                        onClick={handleRegenerate}
                        disabled={regenerating}
                    >
                        {regenerating ? (
                            <>
                                <span className="cvp-btn-spinner" />
                                Генерируем…
                            </>
                        ) : (
                            'Перегенерировать'
                        )}
                    </button>
                </div>
            </div>

            {regenError && (
                <div className="cvp-regen-error">
                    {regenError}
                </div>
            )}

            <div className="cvp-grid">
                {isRegeneratingGrid
                    ? Array.from({ length: skeletonCount }, (_, i) => (
                        <div key={`skeleton-${i}`} className="cvp-card cvp-card--skeleton">
                            <div className="cvp-card-img-placeholder cvp-card-img-placeholder--loading" />
                            <span className="cvp-card-label">Вариант {i + 1}</span>
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
                                        alt={`Вариант ${idx + 1}`}
                                    />
                                ) : (
                                    <div className="cvp-card-img-placeholder" />
                                )}
                                <span className="cvp-card-label">Вариант {idx + 1}</span>
                                <div className="cvp-card-footer">
                                    <div className="cvp-radio">
                                        <span className="cvp-radio-check">✓</span>
                                    </div>
                                    <span className="cvp-select-label">
                                        {isSelected ? 'Выбрано' : 'Выбрать'}
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
                            alt="Выбранный вариант"
                        />
                    ) : (
                        <div className="cvp-thumb-placeholder" />
                    )}
                    <span className="cvp-selected-label">
                        Выбрано:{' '}
                        <span>
                            Вариант {(displayVariants.findIndex(v => v.variant_id === effectiveSelectedId) + 1) || 1}
                        </span>
                    </span>
                </div>
                <div className="cvp-panel-right">
                    <button
                        className="cvp-btn-continue"
                        disabled={!effectiveSelectedId || applying || regenerating}
                        onClick={handleContinue}
                    >
                        {applying ? 'Сохраняем…' : 'Продолжить'}
                    </button>
                    <span className="cvp-continue-hint">Вы перейдёте к редактору персонажа</span>
                </div>
            </div>
        </div>
    );
}
