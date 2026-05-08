import React from 'react';
import { ProfileUser } from '../types';

interface Props {
  user: ProfileUser | null;
  onMenuToggle: () => void;
  title?: string;
}

const DEFAULT_DISPLAY_NAME = 'adMin';

const DashboardHeader: React.FC<Props> = ({ user, onMenuToggle, title = 'Личный кабинет' }) => {
  const displayName = user?.display_name || user?.username || DEFAULT_DISPLAY_NAME;
  const initial = displayName.trim().charAt(0).toUpperCase() || 'A';

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#13151a] sticky top-0 z-20">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors"
        >
          ☰
        </button>
        <h1 className="text-white font-bold text-xl">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 cursor-pointer group rounded-full px-1.5 py-1 hover:bg-white/5 transition-colors">
          <div
            className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center text-white font-semibold text-sm"
            style={{ background: 'linear-gradient(135deg, #fab005, #d97706)' }}
          >
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt={displayName} className="w-full h-full object-cover" />
            ) : (
              initial
            )}
          </div>
          <div className="hidden sm:block">
            <p className="text-white text-sm font-medium leading-none">{displayName}</p>
          </div>
          <span className="text-white/40 text-xs">▾</span>
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;
