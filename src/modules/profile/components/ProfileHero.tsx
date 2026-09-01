import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import PathConstants from '../../../routes/pathConstant';
import type { ProfileUser } from '../types';
import { cssUrl, safeImageUrl } from '../../../utils/safeUrl';

interface Props {
  user: ProfileUser;
}

const ProfileHero: React.FC<Props> = ({ user }) => {
  const navigate = useNavigate();
  const {i18n, t} = useTranslation();
  const initials = user.display_name
    ? user.display_name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  const joinedDate = user.joined_at
    ? new Intl.DateTimeFormat(i18n.resolvedLanguage || i18n.language, {
        day: 'numeric',
        month: 'long',
        timeZone: 'UTC',
        year: 'numeric',
      }).format(new Date(user.joined_at))
    : null;

  // Validate server-supplied URLs before interpolating into CSS / img src —
  // raw values could be `javascript:...` and bypass our framework escaping.
  const safeCover = cssUrl(user.cover_url);
  const safeAvatar = safeImageUrl(user.avatar_url);

  return (
    <div className="relative rounded-2xl overflow-hidden border border-white/5 shadow-xl">
      <div
        className="h-40 md:h-52 w-full"
        style={{
          background: safeCover
            ? `${safeCover} center/cover no-repeat`
            : 'linear-gradient(135deg, #1a1f2e 0%, #0d1117 40%, #1a1408 70%, #2d1f00 100%)',
        }}
      >
        {!safeCover && (
          <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-accent/5" />
        )}
      </div>

      <div className="bg-[#16191f] px-6 pb-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 -mt-12 sm:-mt-10">
          <div className="flex items-end gap-4">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-4 border-[#16191f] bg-[#1e2330] flex items-center justify-center text-accent font-bold text-2xl flex-shrink-0 shadow-lg">
              {safeAvatar ? (
                <img src={safeAvatar} alt="avatar" className="w-full h-full rounded-xl object-cover" />
              ) : (
                initials
              )}
            </div>
            <div className="mb-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-white text-xl sm:text-2xl font-bold">{user.display_name || user.username}</h2>
              </div>
              <div className="flex items-center gap-3 mt-0.5 flex-wrap text-white/50 text-sm">
                <span>@{user.effective_username}</span>
                <span>{t('profile.hero.subscribers', {count: user.subscribers_count})}</span>
              </div>
              {user.tagline && (
                <p className="text-white/50 text-sm mt-0.5">{user.tagline}</p>
              )}
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {user.location && (
                  <span className="text-white/40 text-xs flex items-center gap-1">
                    📍 {user.location}
                  </span>
                )}
                {joinedDate && (
                  <span className="text-white/40 text-xs flex items-center gap-1">
                    📅 {t('profile.hero.joinedAt', {date: joinedDate})}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => navigate(PathConstants.PROFILE_EDIT)}
              className="bg-accent text-[#13151a] text-sm font-semibold px-4 py-2 rounded-xl hover:bg-[#fcc419] transition-colors"
            >
              Редактировать профиль
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileHero;
