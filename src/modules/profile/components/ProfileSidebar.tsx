import React from 'react';
import {useTranslation} from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import Cookies from 'js-cookie';
import PathConstants from '../../../routes/pathConstant';
import LogoButton from '../../../page/main/logo';
import { logout } from '../../../api/http';

interface MenuItem {
  icon: string;
  labelKey: string;
  path?: string;
  disabled?: boolean;
}

const mainItems: MenuItem[] = [
  { icon: '🏠', labelKey: 'profile.sidebar.profile', path: PathConstants.PROFILE },
  { icon: '💬', labelKey: 'profile.sidebar.messages', disabled: true },
  { icon: '👥', labelKey: 'profile.sidebar.subscriptions', path: PathConstants.PROFILE_SUBSCRIPTIONS },
  { icon: '📺', labelKey: 'profile.sidebar.history', disabled: true },
  { icon: '📊', labelKey: 'profile.sidebar.statistics', disabled: true },
  { icon: '✨', labelKey: 'profile.sidebar.recommendations', disabled: true },
  { icon: '🏆', labelKey: 'profile.sidebar.awards', disabled: true },
  { icon: '🔖', labelKey: 'profile.sidebar.saved', disabled: true },
];

const bottomItems: MenuItem[] = [
  { icon: '⚙️', labelKey: 'profile.sidebar.settings', path: PathConstants.PROFILE_SETTINGS },
];

interface Props {
  mobileOpen: boolean;
  onClose: () => void;
  activeItem?: string;
}

const ProfileSidebar: React.FC<Props> = ({ mobileOpen, onClose, activeItem }) => {
  const {t} = useTranslation();
  const navigate = useNavigate();
  const {pathname} = useLocation();

  const isActive = (item: MenuItem) => {
    if (item.path === PathConstants.PROFILE) {
      return pathname === PathConstants.PROFILE || pathname === PathConstants.PROFILE_EDIT;
    }
    if (item.path) return pathname === item.path;
    return activeItem === t(item.labelKey);
  };

  const handleNav = (item: MenuItem) => {
    if (item.disabled) return;
    if (item.path) navigate(item.path);
    onClose();
  };

  const handleLogout = async () => {
    Cookies.remove('token');
    await logout();
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
              key={item.labelKey}
              onClick={() => handleNav(item)}
              disabled={item.disabled}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 text-left text-sm font-medium
                transition-all duration-150
                ${item.disabled
                  ? 'text-white/30 cursor-not-allowed'
                  : isActive(item)
                  ? 'bg-accent/15 text-accent border border-accent/30'
                  : 'text-white/70 hover:bg-white/5 hover:text-white'
                }
              `}
              aria-current={isActive(item) ? 'page' : undefined}
            >
              <span className="text-base">{item.icon}</span>
              {t(item.labelKey)}
            </button>
          ))}
        </nav>

        <div className="px-3 pb-2 pt-3 border-t border-white/5">
          {bottomItems.map((item) => (
            <button
              key={item.labelKey}
              onClick={() => handleNav(item)}
              disabled={item.disabled}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 text-left text-sm font-medium
                transition-all duration-150
                ${item.disabled
                  ? 'text-white/30 cursor-not-allowed'
                  : isActive(item)
                    ? 'bg-accent/15 text-accent border border-accent/30'
                    : 'text-white/70 hover:bg-white/5 hover:text-white'
                }
              `}
              aria-current={isActive(item) ? 'page' : undefined}
            >
              <span className="text-base">{item.icon}</span>
              {t(item.labelKey)}
            </button>
          ))}

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm font-medium text-red-400/70 hover:bg-red-500/10 hover:text-red-400 transition-all duration-150"
          >
            <span className="text-base">🚪</span>
            {t('common.logout')}
          </button>
        </div>
      </aside>
    </>
  );
};

export default ProfileSidebar;
