import React, { useState } from 'react';
import { Switch, Select } from 'antd';
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
    <div className="bg-[#16191f] border border-white/5 rounded-2xl p-5 shadow-md">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold text-base">⚙️ Настройки</h3>
        {saving && <span className="text-white/30 text-xs">Сохранение...</span>}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-white/70 text-sm">Язык интерфейса</span>
          <Select
            value={settings.language}
            onChange={(val) => handleChange({ language: val })}
            options={LANGUAGES}
            size="small"
            style={{ width: 120 }}
            className="text-sm"
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-white/70 text-sm">Закрытый аккаунт</span>
          <Switch
            checked={settings.private_account}
            onChange={(val) => handleChange({ private_account: val })}
            size="small"
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-white/70 text-sm">Уведомления</span>
          <Switch
            checked={settings.notifications_enabled}
            onChange={(val) => handleChange({ notifications_enabled: val })}
            size="small"
          />
        </div>
      </div>

      <button className="mt-5 w-full border border-[#fab005]/30 text-[#fab005] text-sm font-medium py-2 rounded-xl hover:bg-[#fab005]/10 transition-colors">
        Перейти ко всем настройкам
      </button>
    </div>
  );
};

export default SettingsCard;
