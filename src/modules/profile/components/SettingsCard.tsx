import {
  BellOutlined,
  EyeInvisibleOutlined,
  GlobalOutlined,
  LockOutlined,
  MailOutlined,
  MessageOutlined,
  TranslationOutlined,
} from '@ant-design/icons';
import {message, Select, Switch} from 'antd';
import React, {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Link} from 'react-router-dom';

import ThemePicker from '../../../components/theme/ThemePicker';
import PathConstants from '../../../routes/pathConstant';
import {updateSettings} from '../api/profileApi';
import type {CommentPermission, ProfileLanguage, ProfileSettings} from '../types';
import SecurityCard from './SecurityCard';

interface Props {
  settings: ProfileSettings;
  onChange: (updated: ProfileSettings) => void;
}

interface SettingLabelProps {
  description: string;
  icon: React.ReactNode;
  title: string;
}

const rowClass =
  'profile-settings-row flex items-center justify-between rounded-xl px-3.5 py-3 transition-colors';

function SettingLabel({description, icon, title}: SettingLabelProps) {
  return (
    <span className="profile-settings-label">
      <span className="profile-settings-label__icon" aria-hidden="true">{icon}</span>
      <span className="profile-settings-label__copy">
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
    </span>
  );
}

const SettingsCard: React.FC<Props> = ({settings, onChange}) => {
  const {t, i18n} = useTranslation();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings.language && i18n.language !== settings.language) {
      void i18n.changeLanguage(settings.language);
    }
  }, [settings.language, i18n]);

  const languageOptions = [
    {value: 'ru' as const, label: t('profile.language.ru')},
    {value: 'en' as const, label: t('profile.language.en')},
  ];
  const commentOptions = [
    {value: 'everyone' as const, label: t('profile.settings.privacy.commentOptions.everyone')},
    {value: 'followers' as const, label: t('profile.settings.privacy.commentOptions.followers')},
    {value: 'nobody' as const, label: t('profile.settings.privacy.commentOptions.nobody')},
  ];

  const handleChange = async (patch: Partial<ProfileSettings>) => {
    if (saving) return;
    setSaving(true);
    try {
      const updated = await updateSettings(patch);
      onChange({...settings, ...updated});
      if (patch.language && patch.language !== i18n.language) {
        await i18n.changeLanguage(patch.language);
      }
    } catch {
      message.error(t('profile.settings.saveError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="profile-settings-grid">
      {saving && (
        <span className="profile-settings-card__saving" role="status">
          {t('common.saving')}
        </span>
      )}

      <section
        className="profile-settings-card profile-settings-card--appearance rounded-2xl p-5 shadow-md"
        aria-labelledby="settings-appearance-title"
      >
        <div className="profile-settings-section-heading">
          <GlobalOutlined aria-hidden="true" />
          <h2 id="settings-appearance-title">{t('profile.settings.appearance.title')}</h2>
        </div>
        <div className="profile-settings-section__rows">
          <div className="profile-settings-row profile-settings-row--theme rounded-xl px-3.5 py-3">
            <ThemePicker disabled={saving} />
          </div>

          <div className={rowClass}>
            <SettingLabel
              description={t('profile.settings.appearance.interfaceLanguageDescription')}
              icon={<TranslationOutlined />}
              title={t('profile.settings.language')}
            />
            <Select<ProfileLanguage>
              aria-label={t('profile.settings.language')}
              disabled={saving}
              value={settings.language}
              onChange={(value) => void handleChange({language: value})}
              options={languageOptions}
              popupMatchSelectWidth={false}
            />
          </div>
        </div>

        <section className="profile-settings-section" aria-label={t('profile.settings.wallet.title')}>
          <Link
            to={PathConstants.CREDITS}
            className={`${rowClass} profile-settings-wallet-link`}
            aria-label={t('profile.settings.wallet.open')}
          >
            <span className="profile-settings-label">
              <span className="profile-settings-wallet-icon" aria-hidden="true">C</span>
              <span className="profile-settings-wallet-copy">
                <strong>{t('profile.settings.wallet.title')}</strong>
                <small>{t('profile.settings.wallet.description')}</small>
              </span>
            </span>
            <span className="profile-settings-wallet-arrow" aria-hidden="true">→</span>
          </Link>
        </section>
      </section>

      <section
        className="profile-settings-card profile-settings-card--notifications rounded-2xl p-5 shadow-md"
        aria-labelledby="settings-notifications-title"
      >
        <div className="profile-settings-section-heading">
          <BellOutlined aria-hidden="true" />
          <div>
            <h2 id="settings-notifications-title">{t('profile.settings.notifications.title')}</h2>
            <p>{t('profile.settings.notifications.deliveryPrompt')}</p>
          </div>
        </div>
        <div className="profile-settings-section__rows">
          <div className={rowClass}>
            <SettingLabel
              description={t('profile.settings.notifications.inAppDescription')}
              icon={<BellOutlined />}
              title={t('profile.settings.notifications.inApp')}
            />
            <Switch
              aria-label={t('profile.settings.notifications.inApp')}
              checked={settings.notifications_in_app}
              disabled={saving}
              onChange={(value) => void handleChange({notifications_in_app: value})}
            />
          </div>

          <div className={rowClass}>
            <SettingLabel
              description={t('profile.settings.notifications.emailDescription')}
              icon={<MailOutlined />}
              title={t('profile.settings.notifications.email')}
            />
            <Switch
              aria-label={t('profile.settings.notifications.email')}
              checked={settings.notifications_email}
              disabled={saving}
              onChange={(value) => void handleChange({notifications_email: value})}
            />
          </div>
        </div>
      </section>

      <section
        className="profile-settings-card profile-settings-grid__wide rounded-2xl p-5 shadow-md"
        aria-labelledby="settings-privacy-security-title"
      >
        <div className="profile-settings-section-heading">
          <LockOutlined aria-hidden="true" />
          <h2 id="settings-privacy-security-title">
            {t('profile.settings.privacySecurityTitle')}
          </h2>
        </div>
        <div className="profile-settings-privacy-security-grid">
          <div className="profile-settings-section__rows">
            <div className={rowClass}>
              <SettingLabel
                description={t('profile.settings.privacy.privateAccountDescription')}
                icon={<EyeInvisibleOutlined />}
                title={t('profile.settings.privateAccount')}
              />
              <Switch
                aria-label={t('profile.settings.privateAccount')}
                checked={settings.private_account}
                disabled={saving}
                onChange={(value) => void handleChange({private_account: value})}
              />
            </div>

            <div className={rowClass}>
              <SettingLabel
                description={t('profile.settings.privacy.commentPermissionDescription')}
                icon={<MessageOutlined />}
                title={t('profile.settings.privacy.commentPermission')}
              />
              <Select<CommentPermission>
                aria-label={t('profile.settings.privacy.commentPermission')}
                disabled={saving}
                value={settings.comment_permission}
                onChange={(value) => void handleChange({comment_permission: value})}
                options={commentOptions}
                popupMatchSelectWidth={false}
              />
            </div>
          </div>

          <SecurityCard embedded />
        </div>
      </section>
    </div>
  );
};

export default SettingsCard;
