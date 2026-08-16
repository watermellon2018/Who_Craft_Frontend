import React, { useEffect, useState } from 'react';
import { Switch, Select, message } from 'antd';
import { useTranslation } from 'react-i18next';
import {Link} from 'react-router-dom';
import { ProfileSettings } from '../types';
import { updateSettings } from '../api/profileApi';
import ThemePicker from '../../../components/theme/ThemePicker';
import PathConstants from '../../../routes/pathConstant';

interface Props {
  settings: ProfileSettings;
  onChange: (updated: ProfileSettings) => void;
}

const rowClass =
  'profile-settings-row flex items-center justify-between rounded-xl px-3.5 py-3 transition-colors';
const labelClass = 'profile-settings-label flex items-center gap-2.5 text-sm font-medium';

const SettingsCard: React.FC<Props> = ({ settings, onChange }) => {
  const { t, i18n } = useTranslation();
  const [saving, setSaving] = useState(false);

  // Keep the i18next runtime language in sync with the backend-stored
  // preference whenever it changes (initial fetch or another tab updates it).
  useEffect(() => {
    if (settings.language && i18n.language !== settings.language) {
      i18n.changeLanguage(settings.language);
    }
  }, [settings.language, i18n]);

  const languageOptions = [
    { value: 'ru', label: t('profile.language.ru') },
    { value: 'en', label: t('profile.language.en') },
  ];

  const handleChange = async (patch: Partial<ProfileSettings>) => {
    setSaving(true);
    try {
      const updated = await updateSettings(patch);
      onChange({ ...settings, ...updated });
      if (patch.language && patch.language !== i18n.language) {
        // Switch the UI language immediately on success so the user sees the
        // result of their choice; persistence is already done by updateSettings.
        i18n.changeLanguage(patch.language);
      }
    } catch {
      message.error(t('profile.settings.saveError'));
    } finally {
      setSaving(false);
    }
  };

  return (
      <div className="profile-settings-card rounded-2xl p-5 shadow-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="profile-settings-card__title font-semibold text-base">{t('profile.settings.title')}</h3>
          {saving && <span className="profile-settings-card__saving text-xs">{t('common.saving')}</span>}
        </div>

        <div className="space-y-2">
          <div className="profile-settings-row profile-settings-row--theme rounded-xl px-3.5 py-3">
            <ThemePicker />
          </div>

          <Link
            to={PathConstants.CREDITS}
            className={`${rowClass} profile-settings-wallet-link`}
            aria-label={t('profile.settings.wallet.open')}
          >
            <span className={labelClass}>
              <span className="profile-settings-wallet-icon" aria-hidden="true">C</span>
              <span className="profile-settings-wallet-copy">
                <strong>{t('profile.settings.wallet.title')}</strong>
                <small>{t('profile.settings.wallet.description')}</small>
              </span>
            </span>
            <span className="profile-settings-wallet-arrow" aria-hidden="true">→</span>
          </Link>

          <div className={rowClass}>
            <span className={labelClass}>
              <span className="text-base">🌐</span>
              {t('profile.settings.language')}
            </span>
            <Select
              value={settings.language}
              onChange={(val) => handleChange({ language: val })}
              options={languageOptions}
              style={{ width: 130 }}
            />
          </div>

          <div className={rowClass}>
            <span className={labelClass}>
              <span className="text-base">🔒</span>
              {t('profile.settings.privateAccount')}
            </span>
            <Switch
              checked={settings.private_account}
              onChange={(val) => handleChange({ private_account: val })}
            />
          </div>

          <div className={rowClass}>
            <span className={labelClass}>
              <span className="text-base">🔔</span>
              {t('profile.settings.notifications')}
            </span>
            <Switch
              checked={settings.notifications_enabled}
              onChange={(val) => handleChange({ notifications_enabled: val })}
            />
          </div>
        </div>

        <button className="mt-5 w-full border border-accent/40 text-accent text-sm font-semibold py-2.5 rounded-xl hover:bg-accent/10 hover:border-accent/70 transition-colors">
          {t('profile.settings.openAll')}
        </button>
      </div>
  );
};

export default SettingsCard;
