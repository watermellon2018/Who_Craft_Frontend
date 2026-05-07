import React, { useState } from 'react';
import { ConfigProvider, Switch, Select } from 'antd';
import { ProfileSettings } from '../types';
import { updateSettings } from '../api/profileApi';

interface Props {
  settings: ProfileSettings;
  onChange: (updated: ProfileSettings) => void;
}

const LANGUAGES = [
  { value: 'ru', label: 'Русский' },
  { value: 'en', label: 'English' },
];

const cardTheme = {
  token: {
    colorPrimary: '#fab005',
  },
  components: {
    Switch: {
      colorPrimary: '#fab005',
      colorPrimaryHover: '#fcc419',
      colorTextQuaternary: 'rgba(255, 255, 255, 0.18)',
      handleBg: '#ffffff',
    },
    Select: {
      colorBgContainer: '#1b1f27',
      colorBgElevated: '#1b2029',
      colorText: 'rgba(255, 255, 255, 0.92)',
      colorBorder: 'rgba(255, 255, 255, 0.08)',
      colorPrimaryHover: '#fab005',
      controlOutline: 'rgba(250, 176, 5, 0.15)',
      optionSelectedBg: 'rgba(250, 176, 5, 0.12)',
      optionSelectedColor: '#fab005',
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
  const [saving, setSaving] = useState(false);

  const handleChange = async (patch: Partial<ProfileSettings>) => {
    setSaving(true);
    try {
      const updated = await updateSettings(patch);
      onChange({ ...settings, ...updated });
    } catch {
      // silently keep local state as-is on error
    } finally {
      setSaving(false);
    }
  };

  return (
    <ConfigProvider theme={cardTheme}>
      <div className="bg-[#16191f] border border-white/5 rounded-2xl p-5 shadow-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold text-base">⚙️ Настройки</h3>
          {saving && <span className="text-white/40 text-xs">Сохранение...</span>}
        </div>

        <div className="space-y-2">
          <div className={rowClass}>
            <span className={labelClass}>
              <span className="text-base">🌐</span>
              Язык интерфейса
            </span>
            <Select
              value={settings.language}
              onChange={(val) => handleChange({ language: val })}
              options={LANGUAGES}
              style={{ width: 130 }}
            />
          </div>

          <div className={rowClass}>
            <span className={labelClass}>
              <span className="text-base">🔒</span>
              Закрытый аккаунт
            </span>
            <Switch
              checked={settings.private_account}
              onChange={(val) => handleChange({ private_account: val })}
            />
          </div>

          <div className={rowClass}>
            <span className={labelClass}>
              <span className="text-base">🔔</span>
              Уведомления
            </span>
            <Switch
              checked={settings.notifications_enabled}
              onChange={(val) => handleChange({ notifications_enabled: val })}
            />
          </div>
        </div>

        <button className="mt-5 w-full border border-[#fab005]/40 text-[#fab005] text-sm font-semibold py-2.5 rounded-xl hover:bg-[#fab005]/10 hover:border-[#fab005]/70 transition-colors">
          Перейти ко всем настройкам
        </button>
      </div>
    </ConfigProvider>
  );
};

export default SettingsCard;
