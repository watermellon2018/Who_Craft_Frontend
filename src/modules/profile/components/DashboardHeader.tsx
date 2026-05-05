import React from 'react';
import { ProfileUser } from '../types';

interface Props {
  user: ProfileUser | null;
  onMenuToggle: () => void;
}

const DashboardHeader: React.FC<Props> = ({ user, onMenuToggle }) => {
  const initials = user?.display_name
    ? user.display_name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#13151a] sticky top-0 z-20">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors"
        >
          ☰
        </button>
        <h1 className="text-white font-bold text-xl">Личный кабинет</h1>
      </div>

      <div className="flex-1 max-w-md mx-6 hidden md:block">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">🔍</span>
          <input
            type="text"
            placeholder="Поиск видео, авторов, уроков..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#fab005]/50 transition-colors"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="relative p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
          <span className="text-white/70 text-base">🔔</span>
          <span className="absolute top-1 right-1 w-2 h-2 bg-[#fab005] rounded-full" />
        </button>

        <div className="flex items-center gap-2 cursor-pointer group">
          <div className="w-9 h-9 rounded-xl bg-[#fab005]/20 border border-[#fab005]/30 flex items-center justify-center text-[#fab005] font-bold text-sm">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="avatar" className="w-full h-full rounded-xl object-cover" />
            ) : (
              initials
            )}
          </div>
          <div className="hidden sm:block">
            <p className="text-white text-sm font-medium leading-none">{user?.display_name || '...'}</p>
          </div>
          <span className="text-white/40 text-xs">▾</span>
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;
