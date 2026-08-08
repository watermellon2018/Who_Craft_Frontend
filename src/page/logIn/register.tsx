import React, { useState } from 'react';
import { Form, Input, Button, Checkbox } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
// Auth token storage is centralized in api/http.ts — see register() below.
import {
    CaretRightOutlined,
    UserOutlined,
    LockOutlined,
    MailOutlined,
    EyeOutlined,
    EyeInvisibleOutlined,
    ThunderboltOutlined,
    VideoCameraOutlined,
    PlayCircleOutlined,
} from '@ant-design/icons';

import './login.css';
import './registration.css';
import {register} from '../../api/auth/register';
import {getApiErrorMessage} from '../../api/errors';
import PathConstants from '../../routes/pathConstant';

interface RegistrationValues {
    username: string;
    email?: string;
    password: string;
    confirm: string;
    terms?: boolean;
}

interface FeatureItemProps {
    icon: React.ReactNode;
    title: string;
}

const FeatureItem: React.FC<FeatureItemProps> = ({ icon, title }) => (
    <li className="wc-login__feature">
        <span className="wc-login__feature-icon">{icon}</span>
        <span>{title}</span>
    </li>
);

const PromoPanel: React.FC = () => (
    <aside className="wc-login__promo">
        <div className="wc-login__promo-glow" aria-hidden />
        <div className="wc-login__promo-content">
            <span className="wc-login__promo-tag">AI Studio</span>
            <h2 className="wc-login__promo-title">
                Начните создавать
                <br />
                <span className="wc-login__promo-accent">фильмы будущего</span>
            </h2>
            <p className="wc-login__promo-desc">
                Создавайте сцены, персонажей и истории в единой AI-студии.
            </p>
            <ul className="wc-login__features">
                <FeatureItem icon={<ThunderboltOutlined />} title="AI-генерация сцен" />
                <FeatureItem icon={<UserOutlined />} title="Уникальные персонажи" />
                <FeatureItem icon={<PlayCircleOutlined />} title="Полный творческий контроль" />
            </ul>
        </div>
    </aside>
);

const RegistrationPage: React.FC = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const onFinish = async (values: RegistrationValues) => {
        setErrorMessage(null);
        setLoading(true);

        // Backend currently accepts only username + password. We send email along
        // when filled — DRF ignores unknown fields, so contract stays intact and
        // the FE is ready when backend starts persisting it.
        const trimmedEmail = (values.email ?? '').trim();
        const payload = {
            username: values.username.trim(),
            password: values.password,
            ...(trimmedEmail ? {email: trimmedEmail} : {}),
        };

        try {
            // ``register`` already persists the token via api/http.ts.
            const response = await register(payload);
            navigate(response.token ? PathConstants.HOME : PathConstants.LOGIN);
        } catch (error: unknown) {
            setErrorMessage(getApiErrorMessage(error, t('auth.register.createError')));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="wc-login wc-register">
            <div className="wc-login__bg" aria-hidden />

            <div className="wc-login__shell">
                <Link to={PathConstants.HOME} className="wc-login__logo" aria-label="WCraft home">
                    <span className="wc-login__logo-icon" aria-hidden>
                        <CaretRightOutlined />
                    </span>
                    <span className="wc-login__logo-text">
                        <span className="wc-login__logo-w">W</span>Craft
                    </span>
                </Link>

                <div className="wc-login__card">
                    <section className="wc-login__form-pane">
                        <div className="wc-login__form-inner">
                            <h1 className="wc-login__title">{t('auth.register.title')}</h1>
                            <p className="wc-login__subtitle">
                                {t('auth.register.subtitle')}
                            </p>

                            <Form
                                form={form}
                                name="wc-register"
                                layout="vertical"
                                requiredMark={false}
                                onFinish={onFinish}
                                autoComplete="off"
                                scrollToFirstError
                            >
                                <Form.Item
                                    name="username"
                                    label={t('auth.register.username')}
                                    rules={[
                                        { required: true, message: t('auth.register.usernameRequired') },
                                        { min: 3, message: t('auth.register.usernameMin') },
                                        { max: 30, message: t('auth.register.usernameMax') },
                                        {
                                            pattern: /^[A-Za-z0-9_-]+$/,
                                            message: t('auth.register.usernamePattern'),
                                        },
                                    ]}
                                >
                                    <Input
                                        prefix={<UserOutlined />}
                                        placeholder={t('auth.register.usernamePlaceholder')}
                                        size="large"
                                        autoFocus
                                        autoComplete="username"
                                    />
                                </Form.Item>

                                <Form.Item
                                    name="email"
                                    label={
                                        <>
                                            {t('auth.register.emailLabel')}{' '}
                                            <span className="wc-register__optional">{t('auth.register.emailOptional')}</span>
                                        </>
                                    }
                                    rules={[
                                        {
                                            type: 'email',
                                            message: t('auth.register.emailInvalid'),
                                            // type:'email' triggers only when value is non-empty
                                        },
                                    ]}
                                >
                                    <Input
                                        prefix={<MailOutlined />}
                                        placeholder="name@example.com"
                                        size="large"
                                        autoComplete="email"
                                    />
                                </Form.Item>

                                <Form.Item
                                    name="password"
                                    label={t('auth.register.password')}
                                    rules={[
                                        { required: true, message: t('auth.register.passwordRequired') },
                                        { min: 8, message: t('auth.register.passwordMin') },
                                    ]}
                                >
                                    <Input.Password
                                        prefix={<LockOutlined />}
                                        placeholder={t('auth.register.passwordPlaceholder')}
                                        size="large"
                                        autoComplete="new-password"
                                        iconRender={(visible) =>
                                            visible ? <EyeOutlined /> : <EyeInvisibleOutlined />
                                        }
                                    />
                                </Form.Item>

                                <Form.Item
                                    name="confirm"
                                    label={t('auth.register.passwordConfirm')}
                                    dependencies={['password']}
                                    rules={[
                                        { required: true, message: t('auth.register.passwordConfirmRequired') },
                                        ({ getFieldValue }) => ({
                                            validator(_, value) {
                                                if (!value || getFieldValue('password') === value) {
                                                    return Promise.resolve();
                                                }
                                                return Promise.reject(new Error(t('auth.register.passwordMismatch')));
                                            },
                                        }),
                                    ]}
                                >
                                    <Input.Password
                                        prefix={<LockOutlined />}
                                        placeholder={t('auth.register.passwordConfirm')}
                                        size="large"
                                        autoComplete="new-password"
                                        iconRender={(visible) =>
                                            visible ? <EyeOutlined /> : <EyeInvisibleOutlined />
                                        }
                                    />
                                </Form.Item>

                                {errorMessage && (
                                    <div role="alert" className="wc-login__error">
                                        {errorMessage}
                                    </div>
                                )}

                                <Button
                                    type="primary"
                                    htmlType="submit"
                                    block
                                    size="large"
                                    loading={loading}
                                    className="wc-login__primary"
                                >
                                    {loading ? t('auth.register.submitting') : t('auth.register.submit')}
                                </Button>

                                <div className="wc-register__signin">
                                    {t('auth.register.haveAccount')}{' '}
                                    <Link to={PathConstants.LOGIN} className="wc-login__forgot">
                                        {t('auth.register.loginLink')}
                                    </Link>
                                </div>
                            </Form>
                        </div>
                    </section>

                    <PromoPanel />
                </div>
            </div>
        </div>
    );
};

export default RegistrationPage;
