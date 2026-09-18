import React from 'react';
import {useTranslation} from 'react-i18next';

interface Props {
  username: string;
  displayName: string;
  bio: string;
  usernameError?: string;
  onUsernameChange: (value: string) => void;
  onDisplayNameChange: (value: string) => void;
  onBioChange: (value: string) => void;
}

const BIO_LIMIT = 100;

const inputClass =
  'w-full bg-[#1b1f27] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white/90 placeholder-white/30 focus:outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/15 transition-colors';

const labelStyle: React.CSSProperties = { color: 'rgba(255,255,255,0.92)' };
const helperStyle: React.CSSProperties = { color: 'rgba(255,255,255,0.6)' };

const BasicInfoCard: React.FC<Props> = ({
  username,
  displayName,
  bio,
  usernameError,
  onUsernameChange,
  onDisplayNameChange,
  onBioChange,
}) => {
  const {t} = useTranslation();
  const handleBio = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value.slice(0, BIO_LIMIT);
    onBioChange(value);
  };

  return (
    <section className="bg-[#16191f] border border-white/5 rounded-2xl p-5 shadow-md">
      <h3 className="text-white font-semibold text-base mb-4" style={{ color: '#ffffff' }}>
        {t('profile.edit.basic.title')}
      </h3>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium block mb-1.5" style={labelStyle}>
            {t('profile.edit.basic.username')}
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => onUsernameChange(e.target.value)}
            className={inputClass}
            style={{ color: 'rgba(255,255,255,0.92)' }}
          />
          {usernameError ? (
            <p className="text-xs mt-1.5" style={{ color: '#f87171' }}>
              {usernameError}
            </p>
          ) : (
            <p className="text-xs mt-1.5" style={helperStyle}>
              {t('profile.edit.basic.usernameHint')}
            </p>
          )}
        </div>

        <div>
          <label className="text-sm font-medium block mb-1.5" style={labelStyle}>
            {t('profile.edit.basic.displayName')}
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => onDisplayNameChange(e.target.value)}
            className={inputClass}
            style={{ color: 'rgba(255,255,255,0.92)' }}
          />
          <p className="text-xs mt-1.5" style={helperStyle}>
            {t('profile.edit.basic.displayNameHint')}
          </p>
        </div>

        <div>
          <label className="text-sm font-medium block mb-1.5" style={labelStyle}>
            {t('profile.edit.basic.bio')}
          </label>
          <textarea
            value={bio}
            onChange={handleBio}
            rows={4}
            maxLength={BIO_LIMIT}
            className={`${inputClass} resize-none leading-relaxed`}
            style={{ color: 'rgba(255,255,255,0.92)' }}
          />
          <div className="flex items-center justify-between mt-1.5">
            <p className="text-xs" style={helperStyle}>
              {t('profile.edit.basic.bioHint', {count: BIO_LIMIT})}
            </p>
            <p className="text-xs tabular-nums" style={helperStyle}>
              {bio.length} / {BIO_LIMIT}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default BasicInfoCard;
