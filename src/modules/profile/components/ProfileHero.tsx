import React from 'react';
import { ProfileUser } from '../types';

interface Props {
  user: ProfileUser;
}

const ProfileHero: React.FC<Props> = ({ user }) => {
  const initials = user.display_name
    ? user.display_name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  const joinedDate = user.joined_at
    ? new Date(user.joined_at).toLocaleDateString('ru-RU', { year: 'numeric', month: 'long' })
    : null;

  return (
    <div className="relative rounded-2xl overflow-hidden border border-white/5 shadow-xl">
      <div
        className="h-40 md:h-52 w-full"
        style={{
          background: user.cover_url
            ? `url(${user.cover_url}) center/cover no-repeat`
            : 'linear-gradient(135deg, #1a1f2e 0%, #0d1117 40%, #1a1408 70%, #2d1f00 100%)',
        }}
      >
        {!user.cover_url && (
          <div className="absolute inset-0 bg-gradient-to-br from-[#fab005]/10 via-transparent to-[#fab005]/5" />
        )}
      </div>

      <div className="bg-[#16191f] px-6 pb-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 -mt-12 sm:-mt-10">
          <div className="flex items-end gap-4">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-4 border-[#16191f] bg-[#1e2330] flex items-center justify-center text-[#fab005] font-bold text-2xl flex-shrink-0 shadow-lg">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="avatar" className="w-full h-full rounded-xl object-cover" />
              ) : (
                initials
              )}
            </div>
            <div className="mb-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-white text-xl sm:text-2xl font-bold">{user.display_name || user.username}</h2>
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
                    📅 На Craft с {joinedDate}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button className="bg-[#fab005] text-[#13151a] text-sm font-semibold px-4 py-2 rounded-xl hover:bg-[#fcc419] transition-colors">
              Редактировать профиль
            </button>
            <button className="bg-white/5 text-white/70 text-sm font-medium px-4 py-2 rounded-xl border border-white/10 hover:bg-white/10 hover:text-white transition-colors">
              Поделиться
            </button>
            <button className="bg-white/5 text-white/70 text-sm p-2 rounded-xl border border-white/10 hover:bg-white/10 hover:text-white transition-colors">
              ···
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileHero;
