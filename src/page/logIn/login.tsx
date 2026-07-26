import React, { useState } from 'react';
import { Form, Input, Button, Checkbox } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { setStoredUserTokens } from '../../api/http';
import {
    CaretRightOutlined,
    UserOutlined,
    LockOutlined,
    EyeOutlined,
    EyeInvisibleOutlined,
    ThunderboltOutlined,
    VideoCameraOutlined,
} from '@ant-design/icons';

import './login.css';
import { login } from '../../api/auth/login';
import PathConstants from '../../routes/pathConstant';

interface LoginFormValues {
    username: string;
    password: string;
    remember?: boolean;
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
                Создавайте фильмы
                <br />
                <span className="wc-login__promo-accent">нового поколения</span>
            </h2>
            <p className="wc-login__promo-desc">
                Генерируйте сцены, персонажей и истории с помощью искусственного интеллекта.
            </p>
            <ul className="wc-login__features">
                <FeatureItem icon={<ThunderboltOutlined />} title="AI-генерация сцен" />
                <FeatureItem icon={<UserOutlined />} title="Уникальные персонажи" />
                <FeatureItem icon={<VideoCameraOutlined />} title="Кинематографичное качество" />
            </ul>
        </div>
    </aside>
);

const LoginPage: React.FC = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const onFinish = async (values: LoginFormValues) => {
        setErrorMessage(null);
        setLoading(true);
        try {
            const data = await login({
                username: values.username,
                password: values.password,
            });
            if (
                data &&
                (data.status === 200 || String(data.status) === '200') &&
                data.access &&
                data.refresh
            ) {
                setStoredUserTokens(data.access, data.refresh);
                navigate(PathConstants.HOME);
            } else {
                setErrorMessage(t('auth.login.invalidCredentials'));
            }
        } catch {
            // NEVER log the raw error: axios errors embed the request body,
            // which means the password we just submitted.
            setErrorMessage(t('auth.login.networkError'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="wc-login">
            <div className="wc-login__bg" aria-hidden />

            <div className="wc-login__shell">
                <div className="wc-login__logo">
                    <span className="wc-login__logo-icon" aria-hidden>
                        <CaretRightOutlined />
                    </span>
                    <span className="wc-login__logo-text">
                        <span className="wc-login__logo-w">W</span>Craft
                    </span>
                </div>

                <div className="wc-login__card">
                    <section className="wc-login__form-pane">
                        <div className="wc-login__form-inner">
                            <h1 className="wc-login__title">{t('auth.login.title')}</h1>
                            <p className="wc-login__subtitle">
                                {t('auth.login.subtitle')}
                            </p>

                            <Form
                                name="wc-login"
                                layout="vertical"
                                requiredMark={false}
                                initialValues={{ remember: true }}
                                onFinish={onFinish}
                                autoComplete="off"
                            >
                                <Form.Item
                                    name="username"
                                    label={t('auth.login.username')}
                                    rules={[{ required: true, message: t('auth.login.usernameRequired') }]}
                                >
                                    <Input
                                        prefix={<UserOutlined />}
                                        placeholder="username"
                                        size="large"
                                        autoFocus
                                        autoComplete="username"
                                    />
                                </Form.Item>

                                <Form.Item
                                    name="password"
                                    label={t('auth.login.password')}
                                    rules={[{ required: true, message: t('auth.login.passwordRequired') }]}
                                >
                                    <Input.Password
                                        prefix={<LockOutlined />}
                                        placeholder="••••••••"
                                        size="large"
                                        autoComplete="current-password"
                                        iconRender={(visible) =>
                                            visible ? <EyeOutlined /> : <EyeInvisibleOutlined />
                                        }
                                    />
                                </Form.Item>

                                <div className="wc-login__row">
                                    <Form.Item name="remember" valuePropName="checked" noStyle>
                                        <Checkbox>{t('auth.login.remember')}</Checkbox>
                                    </Form.Item>
                                    <a
                                        href="#"
                                        className="wc-login__forgot"
                                        onClick={(e) => e.preventDefault()}
                                        // TODO: hook up to /forgot-password when route is added
                                    >
                                        {t('auth.login.forgot')}
                                    </a>
                                </div>

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
                                    {loading ? t('auth.login.submitting') : t('auth.login.submit')}
                                </Button>
                                <Button
                                    block
                                    size="large"
                                    onClick={() => navigate(PathConstants.REGISTER)}
                                    className="wc-login__secondary"
                                >
                                    {t('auth.login.register')}
                                </Button>
                            </Form>
                        </div>
                    </section>

                    <PromoPanel />
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
