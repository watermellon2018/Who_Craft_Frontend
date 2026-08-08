import React, {useCallback, useEffect, useState} from 'react';
import type {ReactNode} from 'react';
import DashboardHeader from "../../../modules/profile/components/DashboardHeader";
import {Link, useLocation, useNavigate, useParams} from 'react-router-dom';

import { Input, Select, Upload, message } from 'antd';
import {
    ArrowLeftOutlined,
    HomeOutlined,
    RightOutlined,
    PictureOutlined,
    InfoCircleOutlined,
    AimOutlined,
    FileTextOutlined,
    SaveOutlined,
    UploadOutlined,
    ThunderboltOutlined,
    LoadingOutlined,
} from '@ant-design/icons';
import type { UploadProps } from 'antd';

const { Option } = Select;

import AudienceSelect from "./selectAudience";
import {
    create_project,
    fetch_project,
    patch_project,
} from "../../../api/projects/properties/project";
import type {ProjectEditPayload} from "../../../api/projects/properties/project";
import {getApiErrorMessage, getApiStatus} from '../../../api/errors';
import withAuth from "../../../utils/auth/check_auth";
import PathConstants, {projectEditPath, projectPosterPath} from "../../../routes/pathConstant";
import { openNotificationWithIcon } from "../../../utils/global/notification";
import {
    PROJECT_FORMAT_OPTIONS,
    PROJECT_GENRE_OPTIONS,
    GENRE_VALUES,
} from "../../../constants/projectOptions";
import {
    PROJECT_ANNOTATION_MAX_LENGTH,
    PROJECT_SYNOPSIS_MAX_LENGTH,
    PROJECT_POSTER_MAX_MEGABYTES,
    validateProjectPosterFile,
} from './projectFormContract';

const BOTTOM_LEN_ANNOT = 0;
const UP_LEN_ANNOT = PROJECT_ANNOTATION_MAX_LENGTH;
const BOTTOM_LEN_DESC = 0;
const UP_LEN_DESC = PROJECT_SYNOPSIS_MAX_LENGTH;

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
    accentSoftHover: 'rgba(251, 191, 36, 0.18)',
    textPrimary: '#F8FAFC',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    textChip: '#CBD5E1',
    danger: '#EF4444',
    dangerSoft: 'rgba(239, 68, 68, 0.12)',
};

// ============== Field wrapper ==============
interface FieldProps {
    label: string;
    helper?: string;
    children: ReactNode;
    counter?: { current: number; max: number };
}

const Field: React.FC<FieldProps> = ({ label, helper, children, counter }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 14, fontWeight: 500, color: COLORS.textPrimary }}>{label}</label>
        {children}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, minHeight: 16 }}>
            {helper ? (
                <span style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.4, flex: 1 }}>{helper}</span>
            ) : (
                <span style={{ flex: 1 }} />
            )}
            {counter && (
                <span style={{ fontSize: 12, color: counter.current > counter.max ? COLORS.danger : COLORS.textMuted, flexShrink: 0 }}>
                    {counter.current}/{counter.max}
                </span>
            )}
        </div>
    </div>
);

// ============== Card ==============
interface CardProps {
    title: string;
    icon: ReactNode;
    children: ReactNode;
    style?: React.CSSProperties;
}

const Card: React.FC<CardProps> = ({ title, icon, children, style }) => (
    <section
        style={{
            background: COLORS.cardBg,
            border: `1px solid ${COLORS.cardBorder}`,
            borderRadius: 16,
            padding: 24,
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.18)',
            ...style,
        }}
    >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <span style={{ color: COLORS.accent, fontSize: 18, display: 'inline-flex' }}>{icon}</span>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: COLORS.textPrimary, margin: 0 }}>{title}</h2>
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
    type?: 'button' | 'submit';
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
                borderRadius: 10,
                padding: '10px 20px',
                fontWeight: 600,
                fontSize: 14,
                border: 'none',
                display: block ? 'flex' : 'inline-flex',
                width: block ? '100%' : undefined,
                gap: 8,
                alignItems: 'center',
                justifyContent: 'center',
                cursor: disabled ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s ease',
                opacity: disabled ? 0.7 : 1,
                height: 44,
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

// ============== Page ==============
export const ProjectCreatePage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const {projectId} = useParams<{projectId: string}>();
    const is_edit = Boolean(projectId);

    // imageUrl can hold either a remote URL (loaded from backend) or a base64
    // data URL (just picked from the file picker). On save we only forward the
    // base64 form to the backend via posterImageData.
    const [imageUrl, setImageUrl] = useState<string>('');
    const [posterDataUrl, setPosterDataUrl] = useState<string>(''); // base64 ready to upload
    const [title, setTitle] = useState<string>('');
    // Single genre value, e.g. "fantasy". Empty string means no selection.
    const [genre, setGenre] = useState<string>('');
    const [format, setFormat] = useState<string>('feature_film');
    const [selectedAudience, setSelectedAudience] = useState<string[]>(['all']);
    const [annotation, setAnnotation] = useState<string>('');
    const [description, setDescription] = useState<string>('');

    const [errorTitle, setErrorTitle] = useState<boolean>(false);
    const [errorDesc, setErrorDesc] = useState<boolean>(false);
    const [errorAnnot, setErrorAnnot] = useState<boolean>(false);

    const [loading, setLoading] = useState<boolean>(is_edit);
    const [saving, setSaving] = useState<boolean>(false);
    const [loadError, setLoadError] = useState<string | null>(null);

    const loadProject = useCallback(async () => {
        if (!projectId) {
            setLoadError('Не найден идентификатор проекта.');
            setLoading(false);
            return;
        }

        setLoading(true);
        setLoadError(null);
        try {
            const data = await fetch_project(projectId);
            setImageUrl(data.posterUrl || '');
            setTitle(data.title || '');
            setFormat(data.format || 'feature_film');
            setAnnotation(data.annotation || '');
            setDescription(data.synopsis || '');
            setSelectedAudience(
                Array.isArray(data.audience) && data.audience.length > 0
                    ? data.audience
                    : ['all']
            );
            const incomingGenre = Array.isArray(data.genre) ? (data.genre[0] || '') : '';
            setGenre(incomingGenre);
        } catch (error: unknown) {
            const status = getApiStatus(error);
            const errorMessage = status === 403
                ? 'Нет доступа к проекту'
                : status === 404
                    ? 'Проект не найден'
                    : getApiErrorMessage(error, 'Не удалось загрузить проект');
            setLoadError(errorMessage);
            openNotificationWithIcon(errorMessage, 'Не удалось загрузить проект', 'error');
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        if (is_edit && projectId) {
            loadProject().then(() => {
                const incoming = location.state?.imgUrl;
                if (incoming) {
                    setImageUrl(incoming);
                    // If the user just came back from /create-project/gen-poster,
                    // ``imgUrl`` is a freshly generated base64 data URL. Stash it
                    // in ``posterDataUrl`` too — that's what the next "Сохранить
                    // изменения" PATCH actually uploads as ``poster_image_data``.
                    // Without this the new poster is only a preview and the
                    // server-side ``project.image`` stays at the old value.
                    if (typeof incoming === 'string' && incoming.startsWith('data:')) {
                        setPosterDataUrl(incoming);
                    }
                }
            });
        } else if (is_edit && !projectId) {
            // Edit mode but no projectId — exit the loader and surface an
            // error instead of leaving the page stuck on "Загружаем проект...".
            setLoading(false);
            setLoadError('Не найден идентификатор проекта.');
        } else {
            const url = location.state?.imgUrl || '';
            setImageUrl(url);
            if (url.startsWith('data:')) {
                setPosterDataUrl(url);
            }
            setLoading(false);
        }
    }, [is_edit, loadProject, location.state, projectId]);

    const checkRecordFields = () => {
        if (!title) {
            setErrorTitle(true);
            openNotificationWithIcon('Поле "Название" обязательно для заполнения');
            return false;
        }

        if (!genre) {
            openNotificationWithIcon('Выберите жанр');
            return false;
        }

        if (!annotation || annotation.length < BOTTOM_LEN_ANNOT) {
            setErrorAnnot(true);
            openNotificationWithIcon('Поле "Аннотации" должно содержать не менее ' + BOTTOM_LEN_ANNOT + ' символов');
            return false;
        }
        if (!annotation || annotation.length > UP_LEN_ANNOT) {
            setErrorAnnot(true);
            openNotificationWithIcon('Поле "Аннотации" должно содержать не более ' + UP_LEN_ANNOT + ' символов');
            return false;
        }
        if (!description || description.length < BOTTOM_LEN_DESC) {
            setErrorDesc(true);
            openNotificationWithIcon('Поле "Синопсис" должно содержать не менее ' + BOTTOM_LEN_DESC + ' символов');
            return false;
        }
        if (!description || description.length > UP_LEN_DESC) {
            setErrorDesc(true);
            openNotificationWithIcon('Поле "Синопсис" должно содержать не более ' + UP_LEN_DESC + ' символов');
            return false;
        }
        if (selectedAudience.length === 0) {
            openNotificationWithIcon('Выберите целевую аудиторию');
            return false;
        }

        const payload: ProjectEditPayload = {
            title: title.trim(),
            format,
            // Backend stores genre as M2M, so we send a list with a single value.
            genre: genre ? [genre] : [],
            audience: selectedAudience,
            annotation,
            synopsis: description,
        };
        if (posterDataUrl) {
            payload.poster_image_data = posterDataUrl;
        }
        return payload;
    };

    const formatBackendError = (error: unknown): string =>
        getApiErrorMessage(error, 'Не удалось сохранить проект');

    const updateHandle = async () => {
        const payload = checkRecordFields();
        if (!payload) return;

        setSaving(true);
        try {
            if (!projectId) {
                setLoadError('Не найден идентификатор проекта.');
                return;
            }
            const data = await patch_project(projectId, payload);
            openNotificationWithIcon('Изменения сохранены', 'Готово', 'success');
            // Sync local state with the persisted version returned by the API.
            setTitle(data.title || title);
            setFormat(data.format || format);
            setAnnotation(data.annotation ?? annotation);
            setDescription(data.synopsis ?? description);
            if (Array.isArray(data.genre)) setGenre(data.genre[0] || '');
            if (Array.isArray(data.audience) && data.audience.length > 0) {
                setSelectedAudience(data.audience);
            }
            if (data.posterUrl) setImageUrl(data.posterUrl);
            setPosterDataUrl('');
        } catch (error: unknown) {
            openNotificationWithIcon(formatBackendError(error), 'Ошибка', 'error');
        } finally {
            setSaving(false);
        }
    };

    const createHandle = async () => {
        const payload = checkRecordFields();
        if (!payload) return;

        setSaving(true);
        try {
            const data = await create_project(payload);
            openNotificationWithIcon('Проект успешно создан', 'Готово', 'success');
            navigate(projectEditPath(data.id), {replace: true});
        } catch (error: unknown) {
            openNotificationWithIcon(formatBackendError(error), 'Ошибка', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleBack = () => {
        if (projectId) {
            // No dedicated project-detail route exists yet — fall back to the
            // project list, where the user came from. ``navigate(-1)`` would
            // sometimes land back on /create-project/gen-poster, which is the
            // wrong direction for a "Назад" affordance on the settings page.
            navigate(PathConstants.PROJECTS);
            return;
        }
        navigate(-1);
    };

    const handleAnnotationsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setAnnotation(e.target.value);
        const len = e.target.value.length;
        if (len >= BOTTOM_LEN_ANNOT && len <= UP_LEN_ANNOT) {
            setErrorAnnot(false);
        }
    };

    const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setDescription(e.target.value);
        const len = e.target.value.length;
        if (len >= BOTTOM_LEN_DESC && len <= UP_LEN_DESC) {
            setErrorDesc(false);
        }
    };

    const handleTitle = (e: React.ChangeEvent<HTMLInputElement>) => {
        setTitle(e.target.value);
        setErrorTitle(false);
    };

    const getBase64 = (image: Blob, callback: (url: string) => void) => {
        const reader = new FileReader();
        reader.addEventListener('load', () => callback(String(reader.result ?? '')));
        reader.readAsDataURL(image);
    };

    const beforeUpload: NonNullable<UploadProps['beforeUpload']> = (file) => {
        const validationError = validateProjectPosterFile(file);
        if (validationError === 'unsupported-type') {
            message.error('Можно загрузить только JPG или PNG.');
            return Upload.LIST_IGNORE;
        }
        if (validationError === 'too-large') {
            message.error(`Размер изображения не должен превышать ${PROJECT_POSTER_MAX_MEGABYTES} МБ.`);
            return Upload.LIST_IGNORE;
        }
        getBase64(file, (url) => {
            setImageUrl(url);
            setPosterDataUrl(url);
        });
        return false;
    };

    const toGenPage = () => {
        if (!projectId) {
            openNotificationWithIcon(
                'Сначала создайте проект. После сохранения генератор постера станет доступен.',
                'Проект ещё не сохранён',
                'info',
            );
            return;
        }
        navigate(projectPosterPath(projectId));
    };

    // ============== Field styles ==============
    const fieldStyle: React.CSSProperties = {
        background: COLORS.fieldBg,
        border: `1px solid ${COLORS.fieldBorder}`,
        borderRadius: 10,
        color: COLORS.textPrimary,
        height: 44,
        padding: '0 14px',
        width: '100%',
        fontSize: 14,
    };

    const errorBorder: React.CSSProperties = { borderColor: COLORS.danger };

    const breadcrumbTitle = is_edit ? (title || 'Проект') : 'Новый проект';
    const pageActionLabel = is_edit ? 'Сохранить изменения' : 'Создать проект';

    return (
        <>
            <style>{`
                .craft-field .ant-input,
                .craft-field .ant-select-selector,
                .craft-field textarea.ant-input {
                    background: ${COLORS.fieldBg} !important;
                    border-color: ${COLORS.fieldBorder} !important;
                    color: ${COLORS.textPrimary} !important;
                    border-radius: 10px !important;
                }
                .craft-field .ant-select-single .ant-select-selector {
                    height: 44px !important;
                    padding: 0 40px 0 14px !important;
                    display: flex;
                    align-items: center;
                }
                .craft-field .ant-select-single .ant-select-selector .ant-select-selection-search-input {
                    height: 42px !important;
                }
                .craft-field .ant-select-single .ant-select-selector .ant-select-selection-item,
                .craft-field .ant-select-single .ant-select-selector .ant-select-selection-placeholder {
                    line-height: 42px !important;
                    display: flex;
                    align-items: center;
                }
                .craft-field .ant-select-selection-placeholder,
                .craft-field .ant-input::placeholder,
                .craft-field textarea.ant-input::placeholder {
                    color: ${COLORS.textMuted} !important;
                }
                .craft-field .ant-select-selection-item {
                    color: ${COLORS.textPrimary} !important;
                }
                .craft-field .ant-select-arrow {
                    color: ${COLORS.textSecondary} !important;
                    top: 50% !important;
                    margin-top: 0 !important;
                    transform: translateY(-50%) !important;
                    right: 14px !important;
                    height: 14px !important;
                    width: 14px !important;
                    line-height: 0 !important;
                    display: inline-flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    pointer-events: none;
                }
                .craft-field .ant-select-arrow .anticon,
                .craft-field .ant-select-arrow .anticon svg {
                    display: block !important;
                    vertical-align: middle !important;
                    line-height: 0 !important;
                }
                .craft-field .ant-select-clear {
                    top: 50% !important;
                    margin-top: 0 !important;
                    transform: translateY(-50%) !important;
                    right: 14px !important;
                }
                .craft-field.craft-error .ant-input,
                .craft-field.craft-error .ant-select-selector,
                .craft-field.craft-error textarea.ant-input {
                    border-color: ${COLORS.danger} !important;
                }
                .craft-field .ant-input:focus,
                .craft-field .ant-input-focused,
                .craft-field .ant-select-focused .ant-select-selector,
                .craft-field textarea.ant-input:focus {
                    border-color: ${COLORS.accent} !important;
                    box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.12) !important;
                }
                .craft-field-multi .ant-select-selector {
                    min-height: 44px !important;
                    height: auto !important;
                    padding: 4px 11px !important;
                }
                .craft-field-multi .ant-select-selection-item {
                    background: ${COLORS.accentSoft} !important;
                    border-color: ${COLORS.accent} !important;
                    color: ${COLORS.accent} !important;
                    border-radius: 6px !important;
                    line-height: 22px !important;
                }
                .craft-field-multi .ant-select-selection-item-remove {
                    color: ${COLORS.accent} !important;
                }
                .craft-textarea {
                    background: ${COLORS.fieldBg} !important;
                    border: 1px solid ${COLORS.fieldBorder} !important;
                    color: ${COLORS.textPrimary} !important;
                    border-radius: 10px !important;
                    padding: 12px 14px !important;
                    font-size: 14px !important;
                    resize: vertical !important;
                    min-height: 140px !important;
                    width: 100% !important;
                    font-family: inherit;
                    outline: none;
                    transition: border-color 0.15s, box-shadow 0.15s;
                }
                .craft-textarea::placeholder {
                    color: ${COLORS.textMuted};
                }
                .craft-textarea:focus {
                    border-color: ${COLORS.accent} !important;
                    box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.12) !important;
                }
                .craft-textarea.craft-error {
                    border-color: ${COLORS.danger} !important;
                }
                .craft-breadcrumb-link {
                    color: ${COLORS.textSecondary};
                    text-decoration: none;
                    transition: color 0.15s;
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                }
                .craft-breadcrumb-link:hover {
                    color: ${COLORS.textPrimary};
                }
                .craft-poster-upload .ant-upload {
                    width: 100% !important;
                    background: transparent !important;
                    border: none !important;
                    padding: 0 !important;
                    height: auto !important;
                }
                .craft-poster-upload .ant-upload-select {
                    width: 100% !important;
                    display: block !important;
                }
            `}</style>

            <DashboardHeader title="" hideSubnav />

            <div style={{ background: COLORS.pageBg, minHeight: '100vh', color: COLORS.textPrimary }}>
                <div
                    className="craft-page-container"
                    style={{
                        maxWidth: 1440,
                        margin: '0 auto',
                        padding: '24px 32px 40px',
                    }}
                >
                    {/* Breadcrumb */}
                    <nav
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            fontSize: 13,
                            marginBottom: 20,
                            flexWrap: 'wrap',
                        }}
                        aria-label="Breadcrumb"
                    >
                        <Link to={PathConstants.PROJECTS} className="craft-breadcrumb-link">
                            <HomeOutlined />
                        </Link>
                        <RightOutlined style={{ fontSize: 9, color: COLORS.textMuted }} />
                        <Link to={PathConstants.PROJECTS} className="craft-breadcrumb-link">
                            Мои проекты
                        </Link>
                        <RightOutlined style={{ fontSize: 9, color: COLORS.textMuted }} />
                        <span style={{ color: COLORS.accent, fontWeight: 500 }}>{breadcrumbTitle}</span>
                    </nav>

                    {/* Page header */}
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            gap: 20,
                            marginBottom: 28,
                            flexWrap: 'wrap',
                        }}
                    >
                        <div style={{ minWidth: 0, flex: '1 1 320px' }}>
                            <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, marginBottom: 8, color: COLORS.textPrimary }}>
                                Настройки проекта
                            </h1>
                            <p style={{ fontSize: 14, color: COLORS.textSecondary, margin: 0, lineHeight: 1.5, maxWidth: 640 }}>
                                Настройте ключевые параметры проекта, чтобы AI-студия работала точнее и эффективнее.
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                            <SecondaryButton
                                onClick={handleBack}
                                disabled={saving}
                                icon={<ArrowLeftOutlined />}
                            >
                                Назад
                            </SecondaryButton>
                            <PrimaryButton
                                onClick={is_edit ? updateHandle : createHandle}
                                disabled={saving}
                                icon={saving ? <LoadingOutlined /> : <SaveOutlined />}
                            >
                                {saving ? 'Сохранение…' : pageActionLabel}
                            </PrimaryButton>
                        </div>
                    </div>

                    {loading ? (
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: 80,
                                color: COLORS.textSecondary,
                                fontSize: 15,
                                gap: 12,
                            }}
                        >
                            <LoadingOutlined style={{ fontSize: 24, color: COLORS.accent }} />
                            Загружаем проект…
                        </div>
                    ) : loadError ? (
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: 60,
                                gap: 16,
                                textAlign: 'center',
                            }}
                        >
                            <div style={{ fontSize: 17, fontWeight: 600, color: COLORS.textPrimary }}>
                                Не удалось загрузить проект
                            </div>
                            <div style={{ fontSize: 14, color: COLORS.textSecondary, maxWidth: 480 }}>
                                {loadError}
                            </div>
                            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                                <SecondaryButton onClick={() => navigate(PathConstants.PROJECTS)}>
                                    Назад к проектам
                                </SecondaryButton>
                                {projectId && (
                                    <PrimaryButton onClick={loadProject}>
                                        Повторить
                                    </PrimaryButton>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div
                            className="craft-main-grid"
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'minmax(0, 1fr)',
                                gap: 24,
                            }}
                        >
                            <style>{`
                                @media (min-width: 1024px) {
                                    .craft-main-grid {
                                        grid-template-columns: minmax(360px, 400px) minmax(0, 1fr) !important;
                                    }
                                }
                                @media (max-width: 768px) {
                                    .craft-page-container {
                                        padding: 16px !important;
                                    }
                                    .craft-desc-grid {
                                        grid-template-columns: minmax(0, 1fr) !important;
                                    }
                                    .craft-info-grid {
                                        grid-template-columns: minmax(0, 1fr) !important;
                                    }
                                }
                                @media (min-width: 769px) and (max-width: 1023px) {
                                    .craft-page-container {
                                        padding: 20px 24px !important;
                                    }
                                }
                            `}</style>

                            {/* LEFT — Poster card */}
                            <Card title="Постер проекта" icon={<PictureOutlined />}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    {imageUrl ? (
                                        <div
                                            style={{
                                                aspectRatio: '2/3',
                                                borderRadius: 12,
                                                overflow: 'hidden',
                                                border: `1px solid ${COLORS.cardBorder}`,
                                                background: COLORS.fieldBg,
                                            }}
                                        >
                                            <img
                                                src={imageUrl}
                                                alt="Постер проекта"
                                                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                            />
                                        </div>
                                    ) : (
                                        <div
                                            style={{
                                                aspectRatio: '2/3',
                                                borderRadius: 12,
                                                background:
                                                    'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
                                                border: '2px dashed rgba(251, 191, 36, 0.3)',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: 12,
                                                padding: 24,
                                                textAlign: 'center',
                                            }}
                                        >
                                            <PictureOutlined style={{ fontSize: 48, color: 'rgba(251, 191, 36, 0.6)' }} />
                                            <p style={{ fontWeight: 600, color: COLORS.textPrimary, margin: 0, fontSize: 15 }}>
                                                Постер пока не создан
                                            </p>
                                            <p
                                                style={{
                                                    fontSize: 13,
                                                    color: COLORS.textSecondary,
                                                    margin: 0,
                                                    lineHeight: 1.5,
                                                    maxWidth: 280,
                                                }}
                                            >
                                                Сгенерируйте уникальный постер для вашего проекта с помощью AI или загрузите своё изображение.
                                            </p>
                                        </div>
                                    )}

                                    <PrimaryButton onClick={toGenPage} icon={<ThunderboltOutlined />} block disabled={!projectId}>
                                        Сгенерировать постер
                                    </PrimaryButton>
                                    {!projectId && (
                                        <p style={{fontSize: 12, color: COLORS.textMuted, margin: 0, textAlign: 'center'}}>
                                            Сначала создайте проект, чтобы открыть генератор постера.
                                        </p>
                                    )}

                                    <Upload
                                        showUploadList={false}
                                        accept=".jpg,.jpeg,.png"
                                        beforeUpload={beforeUpload}
                                        className="craft-poster-upload"
                                    >
                                        <SecondaryButton icon={<UploadOutlined />} block>
                                            Загрузить изображение
                                        </SecondaryButton>
                                    </Upload>

                                    <p
                                        style={{
                                            fontSize: 12,
                                            color: COLORS.textMuted,
                                            margin: 0,
                                            textAlign: 'center',
                                        }}
                                    >
                                        Рекомендуемое соотношение: 2:3 (портрет)
                                    </p>
                                </div>
                            </Card>

                            {/* RIGHT — stack of cards */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0 }}>
                                {/* Основная информация */}
                                <Card title="Основная информация" icon={<InfoCircleOutlined />}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                                        <Field
                                            label="Название"
                                            helper="Название будет отображаться в списке проектов и в рабочем пространстве фильма."
                                        >
                                            <div className={`craft-field ${errorTitle ? 'craft-error' : ''}`}>
                                                <Input
                                                    placeholder="Введите название"
                                                    value={title}
                                                    onChange={handleTitle}
                                                    style={{ ...fieldStyle, ...(errorTitle ? errorBorder : {}) }}
                                                />
                                            </div>
                                        </Field>

                                        <div
                                            className="craft-info-grid"
                                            style={{
                                                display: 'grid',
                                                gridTemplateColumns: '1fr 1fr',
                                                gap: 16,
                                            }}
                                        >
                                            <Field label="Формат">
                                                <div className="craft-field">
                                                    <Select
                                                        placeholder="Выберите формат"
                                                        value={format || undefined}
                                                        onChange={(value) => setFormat(value)}
                                                        style={{ width: '100%' }}
                                                    >
                                                        {PROJECT_FORMAT_OPTIONS.map((opt) => (
                                                            <Option key={opt.value} value={opt.value}>
                                                                {opt.label}
                                                            </Option>
                                                        ))}
                                                    </Select>
                                                </div>
                                            </Field>

                                            <Field label="Жанр">
                                                <div className="craft-field">
                                                    <Select
                                                        placeholder="Выберите жанр"
                                                        value={genre || undefined}
                                                        onChange={(value) => setGenre((value || '').trim())}
                                                        allowClear
                                                        style={{ width: '100%' }}
                                                    >
                                                        {PROJECT_GENRE_OPTIONS.map((opt) => (
                                                            <Option key={opt.value} value={opt.value}>
                                                                {opt.label}
                                                            </Option>
                                                        ))}
                                                        {/* Custom genre saved earlier — render as-is so the user sees the real value. */}
                                                        {genre && !GENRE_VALUES.has(genre) && (
                                                            <Option key={`__custom_${genre}`} value={genre}>
                                                                {genre}
                                                            </Option>
                                                        )}
                                                    </Select>
                                                </div>
                                            </Field>
                                        </div>
                                    </div>
                                </Card>

                                {/* Целевая аудитория */}
                                <Card title="Целевая аудитория" icon={<AimOutlined />}>
                                    <p style={{ fontSize: 13, color: COLORS.textSecondary, margin: '0 0 14px', lineHeight: 1.5 }}>
                                        Выберите одну или несколько групп, для которых создаётся проект.
                                    </p>
                                    <AudienceSelect
                                        selectedAudience={selectedAudience}
                                        setSelectedAudience={setSelectedAudience}
                                    />
                                </Card>

                                {/* Описание проекта */}
                                <Card title="Описание проекта" icon={<FileTextOutlined />}>
                                    <div
                                        className="craft-desc-grid"
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: '1fr 1fr',
                                            gap: 20,
                                        }}
                                    >
                                        <Field
                                            label="Аннотация"
                                            helper="Краткое описание идеи проекта, его концепции и ключевой идеи."
                                            counter={{ current: annotation.length, max: UP_LEN_ANNOT }}
                                        >
                                            <textarea
                                                className={`craft-textarea ${errorAnnot ? 'craft-error' : ''}`}
                                                value={annotation}
                                                onChange={handleAnnotationsChange}
                                                maxLength={UP_LEN_ANNOT}
                                                placeholder="Опишите идею проекта…"
                                            />
                                        </Field>
                                        <Field
                                            label="Синопсис"
                                            helper="Подробное описание сюжета и ключевых событий проекта."
                                            counter={{ current: description.length, max: UP_LEN_DESC }}
                                        >
                                            <textarea
                                                className={`craft-textarea ${errorDesc ? 'craft-error' : ''}`}
                                                value={description}
                                                onChange={handleDescriptionChange}
                                                maxLength={UP_LEN_DESC}
                                                placeholder="Опишите сюжет и ключевые события…"
                                            />
                                        </Field>
                                    </div>
                                </Card>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default withAuth(ProjectCreatePage);
