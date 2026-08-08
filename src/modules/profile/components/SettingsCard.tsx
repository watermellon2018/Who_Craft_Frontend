import React, { useEffect, useState } from 'react';
import { ConfigProvider, Switch, Select, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { ProfileSettings } from '../types';
import { updateSettings } from '../api/profileApi';
import {CRAFT_ACCENT} from '../../../constants/theme';

interface Props {
  settings: ProfileSettings;
  onChange: (updated: ProfileSettings) => void;
}

const cardTheme = {
  token: {
    colorPrimary: CRAFT_ACCENT,
  },
  components: {
    Switch: {
      colorPrimary: CRAFT_ACCENT,
      colorPrimaryHover: '#fcc419',
      colorTextQuaternary: 'rgba(255, 255, 255, 0.18)',
      handleBg: '#ffffff',
    },
    Select: {
      colorBgContainer: '#1b1f27',
      colorBgElevated: '#1b2029',
      colorText: 'rgba(255, 255, 255, 0.92)',
      colorBorder: 'rgba(255, 255, 255, 0.08)',
      colorPrimaryHover: CRAFT_ACCENT,
      controlOutline: 'rgba(250, 176, 5, 0.15)',
      optionSelectedBg: 'rgba(250, 176, 5, 0.12)',
      optionSelectedColor: CRAFT_ACCENT,
      optionActiveBg: 'rgba(255, 255, 255, 0.05)',
      selectorBg: '#1b1f27',
      borderRadius: 10,
    },
  },
};

const rowClass =
  'flex items-center justify-between bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 rounded-xl px-3.5 py-3 transition-colors';
const labelClass = 'flex items-center gap-2.5 text-white/90 text-sm font-medium';

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
    <ConfigProvider theme={cardTheme}>
      <div className="bg-[#16191f] border border-white/5 rounded-2xl p-5 shadow-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold text-base">{t('profile.settings.title')}</h3>
          {saving && <span className="text-white/40 text-xs">{t('common.saving')}</span>}
        </div>

        <div className="space-y-2">
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
    </ConfigProvider>
  );
};

export default SettingsCard;
