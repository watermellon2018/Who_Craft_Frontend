import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Cookies from 'js-cookie';
import PathConstants from '../../../routes/pathConstant';
import LogoButton from '../../../page/main/logo';

interface MenuItem {
  icon: string;
  label: string;
  path?: string;
  disabled?: boolean;
}

const mainItems: MenuItem[] = [
  { icon: '🏠', label: 'Мой кабинет', path: PathConstants.PROFILE },
  { icon: '💬', label: 'Сообщения', disabled: true },
  { icon: '👥', label: 'Подписки', path: PathConstants.PROFILE_SUBSCRIPTIONS },
  { icon: '📺', label: 'История просмотров', disabled: true },
  { icon: '📊', label: 'Статистика', disabled: true },
  { icon: '✨', label: 'Рекомендации', disabled: true },
  { icon: '🏆', label: 'Награды', disabled: true },
  { icon: '🔖', label: 'Сохранённое', disabled: true },
];

const bottomItems: MenuItem[] = [
  { icon: '⚙️', label: 'Настройки', path: PathConstants.PROFILE },
];

interface Props {
  mobileOpen: boolean;
  onClose: () => void;
  activeItem?: string;
}

const ProfileSidebar: React.FC<Props> = ({ mobileOpen, onClose, activeItem }) => {
  const navigate = useNavigate();
  const [active, setActive] = useState(activeItem ?? 'Главная');

  const handleNav = (item: MenuItem) => {
    if (item.disabled) return;
    setActive(item.label);
    if (item.path) navigate(item.path);
    onClose();
  };

  const handleLogout = () => {
    Cookies.remove('token');
    localStorage.removeItem('userId');
    navigate(PathConstants.AUTH);
  };

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-60 z-30 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`
          fixed top-0 left-0 h-full w-64 z-40 flex flex-col
          bg-[#13151a] border-r border-white/5
          transition-transform duration-300
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:static lg:z-auto
        `}
      >
        <div className="px-6 py-5 border-b border-white/5 flex items-center">
          <LogoButton />
        </div>

        <nav className="flex-1 overflow-y-auto profile-scroll py-4 px-3">
          {mainItems.map((item) => (
            <button
              key={item.label}
              onClick={() => handleNav(item)}
              disabled={item.disabled}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 text-left text-sm font-medium
                transition-all duration-150
                ${item.disabled
                  ? 'text-white/30 cursor-not-allowed'
                  : active === item.label
                  ? 'bg-[#fab005]/15 text-[#fab005] border border-[#fab005]/30'
                  : 'text-white/70 hover:bg-white/5 hover:text-white'
                }
              `}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="px-3 pb-2 pt-3 border-t border-white/5">
          {bottomItems.map((item) => (
            <button
              key={item.label}
              onClick={() => handleNav(item)}
              disabled={item.disabled}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 text-left text-sm font-medium
                transition-all duration-150
                ${item.disabled ? 'text-white/30 cursor-not-allowed' : 'text-white/70 hover:bg-white/5 hover:text-white'}
              `}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </button>
          ))}

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm font-medium text-red-400/70 hover:bg-red-500/10 hover:text-red-400 transition-all duration-150"
          >
            <span className="text-base">🚪</span>
            Выйти
          </button>
        </div>
      </aside>
    </>
  );
};

export default ProfileSidebar;
