import React from 'react';

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
  'w-full bg-[#1b1f27] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white/90 placeholder-white/30 focus:outline-none focus:border-[#fab005]/60 focus:ring-2 focus:ring-[#fab005]/15 transition-colors';

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
  const handleBio = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value.slice(0, BIO_LIMIT);
    onBioChange(value);
  };

  return (
    <section className="bg-[#16191f] border border-white/5 rounded-2xl p-5 shadow-md">
      <h3 className="text-white font-semibold text-base mb-4" style={{ color: '#ffffff' }}>
        Основная информация
      </h3>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium block mb-1.5" style={labelStyle}>
            Имя пользователя
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
              Уникальное имя для вашего профиля. Используется в ссылке.
            </p>
          )}
        </div>

        <div>
          <label className="text-sm font-medium block mb-1.5" style={labelStyle}>
            Отображаемое имя
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => onDisplayNameChange(e.target.value)}
            className={inputClass}
            style={{ color: 'rgba(255,255,255,0.92)' }}
          />
          <p className="text-xs mt-1.5" style={helperStyle}>
            Как ваше имя будет отображаться для других пользователей.
          </p>
        </div>

        <div>
          <label className="text-sm font-medium block mb-1.5" style={labelStyle}>
            О себе
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
              Расскажите о себе. Максимум 100 символов.
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
