import React, {useCallback, useEffect, useRef, useState} from 'react';
import type {ReactNode} from 'react';
import DashboardHeader from "../../../modules/profile/components/DashboardHeader";
import {useNavigate, useParams} from "react-router-dom";
import {
    ArrowLeftOutlined,
    CameraOutlined,
    FireOutlined,
    HistoryOutlined,
    LoadingOutlined,
    PictureOutlined,
    RightOutlined,
    SaveOutlined,
    SmileOutlined,
    ThunderboltOutlined,
    UploadOutlined,
    VideoCameraOutlined,
} from '@ant-design/icons';

import EditGenComponent from "../edit_generation";
import PosterJobHistory from './PosterJobHistory';
import {editPoster, generatePoster, selectPosterVariant} from "../../../api/posters";
import type {PosterVariant} from "../../../api/posters";
import {getApiErrorMessage, getApiStatus} from '../../../api/errors';
import {API_CONSTRAINTS} from '../../../api/generated/contracts';
import {projectEditPath} from "../../../routes/pathConstant";
import { openNotificationWithIcon } from "../../../utils/global/notification";
import {fetch_project} from "../../../api/projects/properties/project";
import {runGenerationWithCredits} from '../../../modules/credits/components/GenerationCostGuard';

// ============== Design tokens ==============
const COLORS = {
    pageBg: '#0B1220',
    cardBg: '#111827',
    fieldBg: '#0F172A',
    cardBorder: 'rgba(148, 163, 184, 0.18)',
    fieldBorder: '#334155',
    fieldBorderHover: '#475569',
    accent: '#FBBF24',
    accentHover: '#FCD34D',
    accentSoft: 'rgba(251, 191, 36, 0.12)',
    textPrimary: '#F8FAFC',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    textChip: '#CBD5E1',
    danger: '#EF4444',
};

const PROMPT_MAX = API_CONSTRAINTS.posterPromptMaxLength;
const REFERENCE_MAX_BYTES = 10 * 1024 * 1024;
const REFERENCE_MIME = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const REFERENCE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];

type StyleId = 'cinematic' | 'anime' | 'dark_fantasy' | 'realism';
type FormatId = 'vertical' | 'square' | 'horizontal';

interface StyleOption {
    id: StyleId;
    title: string;
    subtitle: string;
    icon: ReactNode;
}

const STYLES: StyleOption[] = [
    { id: 'cinematic',    title: 'Кинематографичный', subtitle: 'Кино-кадр, объём, свет', icon: <VideoCameraOutlined /> },
    { id: 'anime',        title: 'Аниме',             subtitle: 'Графика, выразительность', icon: <SmileOutlined /> },
    { id: 'dark_fantasy', title: 'Тёмное фэнтези',    subtitle: 'Мистика и контраст',     icon: <FireOutlined /> },
    { id: 'realism',      title: 'Реализм',           subtitle: 'Фотореалистичный кадр',  icon: <CameraOutlined /> },
];

interface FormatOption {
    id: FormatId;
    title: string;
    ratioLabel: string;
    aspect: string;
    boxStyle: React.CSSProperties;
}

const FORMATS: FormatOption[] = [
    { id: 'vertical',   title: 'Вертикальный',  ratioLabel: '2:3',  aspect: '2 / 3',  boxStyle: { width: 16, height: 24 } },
    { id: 'square',     title: 'Квадратный',    ratioLabel: '1:1',  aspect: '1 / 1',  boxStyle: { width: 22, height: 22 } },
    { id: 'horizontal', title: 'Горизонтальный', ratioLabel: '16:9', aspect: '16 / 9', boxStyle: { width: 30, height: 17 } },
];

// Reserved for future thumbnails strip — empty for now so empty state shows.
interface RecentPoster {
    id: string;
    url: string;
}


// ============== Card ==============
interface CardProps {
    title: string;
    icon: ReactNode;
    children: ReactNode;
    style?: React.CSSProperties;
    headerExtra?: ReactNode;
}

const Card: React.FC<CardProps> = ({ title, icon, children, style, headerExtra }) => (
    <section
        style={{
            background: COLORS.cardBg,
            border: `1px solid ${COLORS.cardBorder}`,
            borderRadius: 20,
            padding: 24,
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.28)',
            ...style,
        }}
    >
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 18,
                justifyContent: 'space-between',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <span style={{ color: COLORS.accent, fontSize: 18, display: 'inline-flex' }}>{icon}</span>
                <h2 style={{ fontSize: 18, fontWeight: 600, color: COLORS.textPrimary, margin: 0 }}>{title}</h2>
            </div>
            {headerExtra}
        </div>
        {children}
    </section>
);

// ============== Buttons ==============
interface BtnProps {
    onClick?: () => void;
    children: ReactNode;
    icon?: ReactNode;
    disabled?: boolean;
    block?: boolean;
}

const PrimaryButton: React.FC<BtnProps> = ({ onClick, children, icon, disabled, block }) => {
    const [hover, setHover] = useState(false);
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
                background: disabled ? '#475569' : (hover ? COLORS.accentHover : COLORS.accent),
                color: '#0B1220',
                borderRadius: 12,
                padding: '12px 22px',
                fontWeight: 600,
                fontSize: 15,
                border: 'none',
                display: block ? 'flex' : 'inline-flex',
                width: block ? '100%' : undefined,
                gap: 10,
                alignItems: 'center',
                justifyContent: 'center',
                cursor: disabled ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s ease, box-shadow 0.15s ease',
                opacity: disabled ? 0.7 : 1,
                height: 48,
                boxShadow: disabled
                    ? 'none'
                    : (hover ? '0 12px 28px rgba(251, 191, 36, 0.28)' : '0 8px 22px rgba(251, 191, 36, 0.18)'),
            }}
        >
            {icon}
            {children}
        </button>
    );
};

const SecondaryButton: React.FC<BtnProps> = ({ onClick, children, icon, disabled, block }) => {
    const [hover, setHover] = useState(false);
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
                background: hover ? 'rgba(148, 163, 184, 0.05)' : 'transparent',
                color: COLORS.textChip,
                border: `1px solid ${hover ? COLORS.fieldBorderHover : COLORS.fieldBorder}`,
                borderRadius: 10,
                padding: '10px 20px',
                fontWeight: 500,
                fontSize: 14,
                display: block ? 'flex' : 'inline-flex',
                width: block ? '100%' : undefined,
                gap: 8,
                alignItems: 'center',
                justifyContent: 'center',
                cursor: disabled ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease',
                opacity: disabled ? 0.6 : 1,
                height: 44,
            }}
        >
            {icon}
            {children}
        </button>
    );
};

// ============== SelectableCard ==============
interface SelectableCardProps {
    selected: boolean;
    onClick: () => void;
    children: ReactNode;
    minHeight?: number;
}

const SelectableCard: React.FC<SelectableCardProps> = ({ selected, onClick, children, minHeight = 78 }) => {
    const [hover, setHover] = useState(false);
    const borderColor = selected
        ? COLORS.accent
        : (hover ? COLORS.fieldBorderHover : COLORS.fieldBorder);
    return (
        <button
            type="button"
            onClick={onClick}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            aria-pressed={selected}
            style={{
                background: selected ? COLORS.accentSoft : (hover ? 'rgba(148, 163, 184, 0.04)' : COLORS.fieldBg),
                border: `1px solid ${borderColor}`,
                borderRadius: 12,
                padding: '10px 14px',
                color: COLORS.textPrimary,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
                minHeight,
                width: '100%',
                boxShadow: selected ? '0 0 0 1px rgba(250, 204, 21, 0.15)' : 'none',
                fontFamily: 'inherit',
            }}
        >
            {children}
        </button>
    );
};

// ============== Reference dropzone ==============
interface ReferenceDropzoneProps {
    file: File | null;
    onFile: (file: File | null) => void;
}

const ReferenceDropzone: React.FC<ReferenceDropzoneProps> = ({ file, onFile }) => {
    const [over, setOver] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const validate = (f: File): boolean => {
        const mime = (f.type || '').toLowerCase();
        const lowerName = (f.name || '').toLowerCase();
        const extOk = REFERENCE_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
        // Browsers usually report JPG as image/jpeg, but a few report image/jpg
        // or leave the type empty. Accept by extension as a fallback so a
        // valid .jpg never gets rejected on a quirk of the OS/browser.
        const mimeOk = !mime || REFERENCE_MIME.includes(mime);
        if (!extOk || !mimeOk) {
            openNotificationWithIcon('Только PNG, JPG или WEBP', 'Неподдерживаемый формат', 'error');
            return false;
        }
        if (f.size > REFERENCE_MAX_BYTES) {
            openNotificationWithIcon('Максимальный размер — 10 MB', 'Файл слишком большой', 'error');
            return false;
        }
        return true;
    };

    const handleFiles = (files: FileList | null) => {
        if (!files || files.length === 0) return;
        const f = files[0];
        if (validate(f)) onFile(f);
    };

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setOver(false);
        handleFiles(e.dataTransfer.files);
    };

    const onDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        if (!over) setOver(true);
    };

    const onDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setOver(false);
    };

    if (file) {
        return (
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '12px 16px',
                    borderRadius: 12,
                    border: `1px solid ${COLORS.accent}`,
                    background: COLORS.accentSoft,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <PictureOutlined style={{ color: COLORS.accent, fontSize: 18 }} />
                    <div style={{ minWidth: 0 }}>
                        <div
                            style={{
                                color: COLORS.textPrimary,
                                fontSize: 14,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                            }}
                        >
                            {file.name}
                        </div>
                        <div style={{ color: COLORS.textMuted, fontSize: 12 }}>
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                        </div>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => onFile(null)}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: COLORS.textSecondary,
                        cursor: 'pointer',
                        fontSize: 18,
                        padding: '4px 10px',
                        borderRadius: 8,
                    }}
                    aria-label="Убрать референс"
                >
                    ×
                </button>
            </div>
        );
    }

    return (
        <label
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '24px 16px',
                borderRadius: 14,
                border: `1.5px dashed ${over ? COLORS.accent : COLORS.fieldBorder}`,
                background: over ? COLORS.accentSoft : COLORS.fieldBg,
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.15s ease',
            }}
        >
            <UploadOutlined style={{ fontSize: 26, color: over ? COLORS.accent : COLORS.textSecondary }} />
            <div style={{ color: COLORS.textPrimary, fontSize: 14, fontWeight: 500 }}>
                Загрузите изображение для вдохновения
            </div>
            <div style={{ color: COLORS.textMuted, fontSize: 12 }}>
                PNG, JPG или WEBP до 10 MB
            </div>
            <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,.png,.jpg,.jpeg,.webp"
                style={{ display: 'none' }}
                onChange={(e) => {
                    handleFiles(e.target.files);
                    if (inputRef.current) inputRef.current.value = '';
                }}
            />
        </label>
    );
};

// ============== Empty preview state ==============
const EmptyPosterState: React.FC = () => (
    <div
        className="gen-poster-preview-box"
        style={{
            position: 'relative',
            borderRadius: 16,
            background:
                'radial-gradient(120% 80% at 50% 30%, rgba(251, 191, 36, 0.10) 0%, rgba(15, 23, 42, 0) 60%), linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
            border: `1px dashed rgba(251, 191, 36, 0.35)`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: 24,
            textAlign: 'center',
            overflow: 'hidden',
        }}
    >
        <div
            style={{
                width: 64,
                height: 64,
                borderRadius: 16,
                background: 'rgba(251, 191, 36, 0.10)',
                border: '1px solid rgba(251, 191, 36, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: COLORS.accent,
                fontSize: 28,
            }}
        >
            <PictureOutlined />
        </div>
        <div style={{ color: COLORS.textPrimary, fontWeight: 600, fontSize: 16 }}>
            Ваш постер появится здесь
        </div>
        <div
            style={{
                color: COLORS.textSecondary,
                fontSize: 13,
                lineHeight: 1.5,
                maxWidth: 360,
            }}
        >
            Опишите идею постера, выберите стиль и нажмите «Сгенерировать постер» — AI создаст несколько вариантов в высоком качестве.
        </div>
    </div>
);

// ============== Recent posters strip ==============
interface RecentPostersStripProps {
    posters: RecentPoster[];
}

const RecentPostersStrip: React.FC<RecentPostersStripProps> = ({ posters }) => {
    return (
        <div
            className="gen-poster-recent-strip"
            style={{
                display: 'flex',
                gap: 12,
                overflowX: 'auto',
                paddingBottom: 2,
            }}
        >
            {posters.length === 0
                ? [0, 1, 2, 3].map((i) => (
                      <div
                          key={i}
                          className="gen-poster-recent-tile"
                          style={{
                              borderRadius: 12,
                              background:
                                  'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.6) 100%)',
                              border: `1px dashed ${COLORS.fieldBorder}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: COLORS.textMuted,
                              fontSize: 11,
                              padding: 6,
                              textAlign: 'center',
                              lineHeight: 1.35,
                          }}
                      >
                          {i === 0 ? 'Пока нет вариантов' : ''}
                      </div>
                  ))
                : posters.map((p) => (
                      <div
                          key={p.id}
                          className="gen-poster-recent-tile"
                          style={{
                              borderRadius: 12,
                              overflow: 'hidden',
                              border: `1px solid ${COLORS.cardBorder}`,
                              background: COLORS.fieldBg,
                              cursor: 'pointer',
                              transition: 'transform 0.15s ease, border-color 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'scale(1.03)';
                              e.currentTarget.style.borderColor = COLORS.accent;
                          }}
                          onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'scale(1)';
                              e.currentTarget.style.borderColor = COLORS.cardBorder;
                          }}
                      >
                          <img
                              src={p.url}
                              alt="Вариант постера"
                              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                          />
                      </div>
                  ))}
            {posters.length > 0 && (
                <div
                    className="gen-poster-recent-tile"
                    style={{
                        borderRadius: 12,
                        border: `1px dashed ${COLORS.fieldBorder}`,
                        color: COLORS.textSecondary,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                        cursor: 'pointer',
                        fontSize: 12,
                    }}
                >
                    <RightOutlined />
                    Смотреть все
                </div>
            )}
        </div>
    );
};

// ============== Page ==============
const GenPosterPage: React.FC = () => {
    const navigate = useNavigate();
    const {projectId} = useParams<{projectId: string}>();

    const [prompt, setPrompt] = useState<string>('');
    const [selectedStyle, setSelectedStyle] = useState<StyleId>('cinematic');
    const [selectedFormat, setSelectedFormat] = useState<FormatId>('vertical');
    const [referenceFile, setReferenceFile] = useState<File | null>(null);
    const [isGenerating, setIsGenerating] = useState<boolean>(false);
    const [imageGeneratedUrl, setImageGeneratedUrl] = useState<string>('');
    const [sourceVariantId, setSourceVariantId] = useState<number | null>(null);
    const [recentPosters] = useState<RecentPoster[]>([]);
    const [contextLoading, setContextLoading] = useState(true);
    const [contextError, setContextError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        if (!projectId) {
            setContextError('Проект не найден');
            setContextLoading(false);
            return () => { cancelled = true; };
        }
        setContextLoading(true);
        setContextError(null);
        fetch_project(projectId)
            .catch((error: unknown) => {
                if (cancelled) return;
                const status = getApiStatus(error);
                setContextError(status === 403
                    ? 'Нет доступа к проекту'
                    : status === 404
                        ? 'Проект не найден'
                        : 'Не удалось загрузить проект');
            })
            .finally(() => {
                if (!cancelled) setContextLoading(false);
            });
        return () => { cancelled = true; };
    }, [projectId]);

    const requireProjectId = () => {
        if (projectId) return projectId;
        openNotificationWithIcon(
            'Сначала сохраните проект, затем откройте генератор постера снова.',
            'Нужен существующий проект',
            'error',
        );
        return null;
    };

    const catchError = (
        error: unknown,
        resetImage = true,
        fallbackMessage = 'Ошибка при генерации изображения. Что-то пошло не так',
    ) => {
        const message = getApiErrorMessage(error, fallbackMessage);

        setIsGenerating(false);
        if (resetImage) {
            setImageGeneratedUrl('');
            setSourceVariantId(null);
        }
        openNotificationWithIcon('Упс!', message, 'error');
    };

    const handleBack = () => {
        navigate(projectId ? projectEditPath(projectId) : '/project-list');
    };

    const savePoster = async () => {
        const existingProjectId = requireProjectId();
        if (!existingProjectId || sourceVariantId === null) return;
        try {
            await selectPosterVariant(existingProjectId, sourceVariantId);
            navigate(projectEditPath(existingProjectId), {
                state: {imgUrl: imageGeneratedUrl, regenerated: true},
            });
        } catch (error: unknown) {
            catchError(
                error,
                false,
                'Не удалось сохранить выбранный постер. Повторите попытку.',
            );
        }
    };

    const displayGenImage = useCallback((variant: PosterVariant) => {
        setImageGeneratedUrl(variant.imageUrl);
        setSourceVariantId(variant.id);
        setIsGenerating(false);
    }, []);

    const genHandle = async () => {
        if (!prompt.trim() || isGenerating) return;
        const existingProjectId = requireProjectId();
        if (!existingProjectId) return;
        try {
            setIsGenerating(true);
            const variant = await runGenerationWithCredits(
                {
                    domain: 'poster',
                    operation: 'generate',
                    variantCount: 1,
                    promptLength: prompt.length,
                },
                () => generatePoster(existingProjectId, prompt, {
                    style: selectedStyle,
                    format: selectedFormat,
                    referenceFile,
                }),
            );
            if (!variant) {
                setIsGenerating(false);
                return;
            }
            displayGenImage(variant);
        } catch (error: unknown) {
            catchError(error);
        }
    };

    const editHandle = async (correctionText: string) => {
        const existingProjectId = requireProjectId();
        if (!existingProjectId || sourceVariantId === null) return;
        try {
            setIsGenerating(true);
            const variant = await runGenerationWithCredits(
                {
                    domain: 'poster',
                    operation: 'edit',
                    variantCount: 1,
                    promptLength: correctionText.length,
                },
                () => editPoster(existingProjectId, {
                    sourceVariantId,
                    instruction: correctionText,
                }),
            );
            if (!variant) {
                setIsGenerating(false);
                return;
            }
            displayGenImage(variant);
        } catch (error: unknown) {
            catchError(error);
        }
    };

    const generateDisabled = !projectId || !prompt.trim() || isGenerating;

    if (contextLoading || contextError) {
        return (
            <>
                <DashboardHeader title="" />
                <div style={{background: COLORS.pageBg, minHeight: '100vh', color: COLORS.textPrimary, padding: 48, textAlign: 'center'}}>
                    <h1>{contextLoading ? 'Загружаем проект…' : contextError}</h1>
                    {!contextLoading && (
                        <PrimaryButton onClick={handleBack}>Вернуться к проектам</PrimaryButton>
                    )}
                </div>
            </>
        );
    }

    return (
        <>
            <style>{`
                .gen-poster-textarea {
                    background: ${COLORS.fieldBg};
                    border: 1px solid ${COLORS.fieldBorder};
                    color: ${COLORS.textPrimary};
                    border-radius: 12px;
                    padding: 14px 16px;
                    font-size: 14px;
                    resize: vertical;
                    min-height: 150px;
                    width: 100%;
                    font-family: inherit;
                    outline: none;
                    transition: border-color 0.15s, box-shadow 0.15s;
                }
                .gen-poster-textarea::placeholder { color: ${COLORS.textMuted}; }
                .gen-poster-textarea:focus {
                    border-color: ${COLORS.accent};
                    box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.12);
                }
                .gen-poster-breadcrumb-link {
                    color: ${COLORS.textSecondary};
                    text-decoration: none;
                    transition: color 0.15s;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                }
                .gen-poster-breadcrumb-link:hover { color: ${COLORS.textPrimary}; }
                .gen-poster-header {
                    display: flex;
                    flex-direction: column;
                    gap: 14px;
                    margin-bottom: 20px;
                }
                .gen-poster-header-title {
                    display: flex;
                    align-items: flex-start;
                    gap: 14px;
                    min-width: 0;
                }
                .gen-poster-header-back { width: 100%; }
                @media (min-width: 640px) {
                    .gen-poster-header {
                        flex-direction: row;
                        align-items: flex-start;
                        justify-content: space-between;
                        gap: 16px;
                    }
                    .gen-poster-header-back {
                        width: auto;
                        flex-shrink: 0;
                    }
                }
                .gen-poster-grid {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr);
                    gap: 20px;
                    align-items: start;
                }
                .gen-poster-style-grid {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 12px;
                }
                .gen-poster-format-grid {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 12px;
                }
                .gen-poster-preview-box {
                    width: 100%;
                    height: 300px;
                }
                .gen-poster-recent-tile {
                    flex: 0 0 84px;
                    width: 84px;
                    height: 116px;
                }
                @media (min-width: 768px) {
                    .gen-poster-recent-tile {
                        flex: 0 0 96px;
                        width: 96px;
                        height: 132px;
                    }
                }
                .gen-poster-recent-strip::-webkit-scrollbar { height: 6px; }
                .gen-poster-recent-strip::-webkit-scrollbar-thumb {
                    background: ${COLORS.fieldBorder};
                    border-radius: 3px;
                }
                @media (min-width: 768px) {
                    .gen-poster-preview-box { height: 380px; }
                }
                @media (min-width: 1024px) {
                    .gen-poster-grid {
                        grid-template-columns: minmax(0, 1.45fr) minmax(420px, 0.85fr);
                        gap: 24px;
                    }
                    .gen-poster-preview-box { height: 460px; }
                }
                @media (min-width: 1280px) {
                    .gen-poster-preview-box { height: 500px; }
                }
                @media (max-width: 768px) {
                    .gen-poster-page-container { padding: 16px !important; }
                    .gen-poster-style-grid { grid-template-columns: minmax(0, 1fr); }
                    .gen-poster-format-grid { grid-template-columns: minmax(0, 1fr); }
                }
            `}</style>

            <DashboardHeader title="" />

            <div style={{ background: COLORS.pageBg, minHeight: '100vh', color: COLORS.textPrimary }}>
                <div
                    className="gen-poster-page-container"
                    style={{
                        maxWidth: 1440,
                        margin: '0 auto',
                        padding: '20px 32px 32px',
                    }}
                >
                    {/* Page header — title left, back button right */}
                    <header className="gen-poster-header">
                        <div className="gen-poster-header-title">
                            <div style={{ minWidth: 0 }}>
                                <h1
                                    style={{
                                        fontSize: 26,
                                        fontWeight: 700,
                                        margin: 0,
                                        color: COLORS.textPrimary,
                                        lineHeight: 1.2,
                                    }}
                                >
                                    Создание постера
                                </h1>
                                <p
                                    style={{
                                        fontSize: 13,
                                        color: COLORS.textSecondary,
                                        margin: '6px 0 0',
                                        lineHeight: 1.55,
                                    }}
                                >
                                    Опишите идею, выберите стиль и создайте уникальный постер с помощью AI
                                </p>
                            </div>
                        </div>

                        <div className="gen-poster-header-back">
                            <SecondaryButton onClick={handleBack} icon={<ArrowLeftOutlined />} block>
                                Назад к проекту
                            </SecondaryButton>
                        </div>
                    </header>

                    <div className="gen-poster-grid">
                        {/* LEFT — Preview + Recent */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
                            <Card title="Превью постера" icon={<PictureOutlined />} style={{ padding: 20 }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    {isGenerating ? (
                                        <div
                                            className="gen-poster-preview-box"
                                            style={{
                                                borderRadius: 16,
                                                background: COLORS.fieldBg,
                                                border: `1px solid ${COLORS.cardBorder}`,
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: 12,
                                                color: COLORS.textSecondary,
                                            }}
                                        >
                                            <LoadingOutlined style={{ fontSize: 28, color: COLORS.accent }} />
                                            <span style={{ fontSize: 14 }}>Генерируем постер…</span>
                                        </div>
                                    ) : imageGeneratedUrl ? (
                                        <div
                                            className="gen-poster-preview-box"
                                            style={{
                                                borderRadius: 16,
                                                overflow: 'hidden',
                                                border: `1px solid ${COLORS.cardBorder}`,
                                                background: COLORS.fieldBg,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                padding: 12,
                                            }}
                                        >
                                            <img
                                                src={imageGeneratedUrl}
                                                alt="Сгенерированный постер"
                                                style={{
                                                    maxWidth: '100%',
                                                    maxHeight: '100%',
                                                    objectFit: 'contain',
                                                    borderRadius: 10,
                                                    display: 'block',
                                                }}
                                            />
                                        </div>
                                    ) : (
                                        <EmptyPosterState />
                                    )}

                                    {imageGeneratedUrl && !isGenerating && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                            <PrimaryButton onClick={savePoster} icon={<SaveOutlined />} block>
                                                Сохранить
                                            </PrimaryButton>
                                            <div
                                                style={{
                                                    background: COLORS.fieldBg,
                                                    border: `1px solid ${COLORS.fieldBorder}`,
                                                    borderRadius: 12,
                                                    padding: 14,
                                                }}
                                            >
                                                <EditGenComponent editHandle={editHandle} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </Card>

                            <Card
                                title="Недавние варианты"
                                icon={<HistoryOutlined />}
                                style={{ padding: '16px 20px' }}
                            >
                                <RecentPostersStrip posters={recentPosters} />
                            </Card>

                            <Card
                                title="История генераций"
                                icon={<HistoryOutlined />}
                                style={{padding: '16px 20px'}}
                            >
                                <PosterJobHistory projectId={projectId || ''} onVariantReady={displayGenImage} />
                            </Card>
                        </div>


                        {/* RIGHT — Settings */}
                        <Card title="Настройки генерации" icon={<ThunderboltOutlined />}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                {/* Block 1 — Prompt */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <h3
                                        style={{
                                            fontSize: 15,
                                            fontWeight: 600,
                                            color: COLORS.textPrimary,
                                            margin: 0,
                                        }}
                                    >
                                        1. Опишите, как должен выглядеть постер
                                    </h3>
                                    <textarea
                                        className="gen-poster-textarea"
                                        value={prompt}
                                        onChange={(e) => setPrompt(e.target.value.slice(0, PROMPT_MAX))}
                                        maxLength={PROMPT_MAX}
                                        placeholder="Например: Мрачный постер в стиле научной фантастики. Одинокий астронавт на пустынной планете, на фоне — разрушенный космический корабль и красное небо."
                                    />
                                </div>

                                {/* Block 2 — Style */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <h3
                                        style={{
                                            fontSize: 15,
                                            fontWeight: 600,
                                            color: COLORS.textPrimary,
                                            margin: 0,
                                        }}
                                    >
                                        2. Стиль постера
                                    </h3>
                                    <div className="gen-poster-style-grid">
                                        {STYLES.map((s) => (
                                            <SelectableCard
                                                key={s.id}
                                                selected={selectedStyle === s.id}
                                                onClick={() => setSelectedStyle(s.id)}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <div
                                                        style={{
                                                            width: 36,
                                                            height: 36,
                                                            borderRadius: 8,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            background:
                                                                selectedStyle === s.id
                                                                    ? 'rgba(251, 191, 36, 0.15)'
                                                                    : 'rgba(30, 41, 59, 0.8)',
                                                            color:
                                                                selectedStyle === s.id
                                                                    ? COLORS.accent
                                                                    : COLORS.textSecondary,
                                                            fontSize: 15,
                                                            flex: '0 0 auto',
                                                        }}
                                                    >
                                                        {s.icon}
                                                    </div>
                                                    <div style={{ minWidth: 0 }}>
                                                        <div
                                                            style={{
                                                                fontSize: 13,
                                                                fontWeight: 600,
                                                                color:
                                                                    selectedStyle === s.id
                                                                        ? '#FDE68A'
                                                                        : COLORS.textPrimary,
                                                                lineHeight: 1.25,
                                                            }}
                                                        >
                                                            {s.title}
                                                        </div>
                                                        <div
                                                            style={{
                                                                fontSize: 11,
                                                                color: COLORS.textMuted,
                                                                marginTop: 1,
                                                                lineHeight: 1.35,
                                                            }}
                                                        >
                                                            {s.subtitle}
                                                        </div>
                                                    </div>
                                                </div>
                                            </SelectableCard>
                                        ))}
                                    </div>
                                </div>

                                {/* Block 3 — Format */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <h3
                                        style={{
                                            fontSize: 15,
                                            fontWeight: 600,
                                            color: COLORS.textPrimary,
                                            margin: 0,
                                        }}
                                    >
                                        3. Формат постера
                                    </h3>
                                    <div className="gen-poster-format-grid">
                                        {FORMATS.map((f) => (
                                            <SelectableCard
                                                key={f.id}
                                                selected={selectedFormat === f.id}
                                                onClick={() => setSelectedFormat(f.id)}
                                                minHeight={76}
                                            >
                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: 4,
                                                        height: '100%',
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            height: 24,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            marginBottom: 2,
                                                        }}
                                                    >
                                                        <div
                                                            style={{
                                                                ...f.boxStyle,
                                                                borderRadius: 3,
                                                                border: `1.5px solid ${
                                                                    selectedFormat === f.id
                                                                        ? COLORS.accent
                                                                        : COLORS.fieldBorderHover
                                                                }`,
                                                                background:
                                                                    selectedFormat === f.id
                                                                        ? COLORS.accentSoft
                                                                        : 'transparent',
                                                            }}
                                                        />
                                                    </div>
                                                    <div
                                                        style={{
                                                            fontSize: 13,
                                                            fontWeight: 600,
                                                            lineHeight: 1,
                                                            color:
                                                                selectedFormat === f.id
                                                                    ? '#FDE68A'
                                                                    : COLORS.textPrimary,
                                                            textAlign: 'center',
                                                        }}
                                                    >
                                                        {f.title}
                                                    </div>
                                                    <div
                                                        style={{
                                                            fontSize: 11,
                                                            color: COLORS.textMuted,
                                                            lineHeight: 1.2,
                                                        }}
                                                    >
                                                        {f.ratioLabel}
                                                    </div>
                                                </div>
                                            </SelectableCard>
                                        ))}
                                    </div>
                                </div>

                                {/* Block 4 — Reference */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <h3
                                        style={{
                                            fontSize: 15,
                                            fontWeight: 600,
                                            color: COLORS.textPrimary,
                                            margin: 0,
                                        }}
                                    >
                                        4. Референс <span style={{ color: COLORS.textMuted, fontWeight: 400 }}>(необязательно)</span>
                                    </h3>
                                    <ReferenceDropzone file={referenceFile} onFile={setReferenceFile} />
                                </div>

                                {/* Generate */}
                                <div
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 8,
                                        borderTop: `1px solid ${COLORS.cardBorder}`,
                                        paddingTop: 20,
                                    }}
                                >
                                    {!projectId && (
                                        <div role="alert" style={{ color: COLORS.danger, fontSize: 13, lineHeight: 1.5 }}>
                                            Сначала сохраните проект, затем откройте генератор постера снова.
                                        </div>
                                    )}
                                    <PrimaryButton
                                        onClick={genHandle}
                                        disabled={generateDisabled}
                                        block
                                        icon={isGenerating ? <LoadingOutlined /> : <ThunderboltOutlined />}
                                    >
                                        {isGenerating ? 'Генерируем…' : 'Сгенерировать постер'}
                                    </PrimaryButton>
                               
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </>
    );
};

export default GenPosterPage;
