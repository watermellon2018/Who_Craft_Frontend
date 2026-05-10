import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Cookies from 'js-cookie';
import { ProfileUser } from '../types';
import { fetchProfileMe } from '../api/profileApi';
import PathConstants from '../../../routes/pathConstant';
import './dashboardHeader.css';

interface Props {
  user?: ProfileUser | null;
  onMenuToggle?: () => void;
  title?: string;
  subtitle?: string;
  sectionTitle?: string;
  hideSubnav?: boolean;
}

function resolveSectionTitle(pathname: string): string {
  if (pathname.startsWith(PathConstants.PROFILE_SUBSCRIPTIONS)) return 'Подписки';
  if (pathname.startsWith(PathConstants.PROFILE_EDIT)) return 'Редактирование профиля';
  if (pathname.startsWith(PathConstants.PROFILE)) return 'Профиль';
  if (pathname.startsWith(PathConstants.PROJECTS)) return 'Мои проекты';
  if (pathname.startsWith(PathConstants.CREATE_PROJECT)) return 'Создание проекта';
  if (pathname.startsWith(PathConstants.EDIT_PROJECT)) return 'Редактирование проекта';
  if (pathname.startsWith('/project/') && pathname.includes('/characters')) return 'Персонажи';
  if (pathname.startsWith(PathConstants.ALL_HEROES_PAGE)) return 'Персонажи';
  if (pathname.startsWith(PathConstants.HERO_PAGE)) return 'Персонаж';
  if (pathname.startsWith(PathConstants.SCRIPT_PAGE)) return 'Сценарий';
  if (pathname.startsWith(PathConstants.GENERATING)) return 'Генерация';
  if (pathname === PathConstants.HOME) return 'Главная';
  return '';
}

const DashboardHeader: React.FC<Props> = ({
  user,
  onMenuToggle,
  title,
  subtitle,
  sectionTitle,
  hideSubnav = false,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [fetchedUser, setFetchedUser] = useState<ProfileUser | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user === undefined || user === null) {
      fetchProfileMe()
        .then((data) => setFetchedUser(data.user as unknown as ProfileUser))
        .catch((_err) => void 0);
    }
  }, [user]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const resolvedUser = user ?? fetchedUser;
  const displayName = resolvedUser?.display_name || resolvedUser?.username || 'User';
  const initial = displayName.trim().charAt(0).toUpperCase();

  const resolvedSection = useMemo(() => {
    if (sectionTitle !== undefined) return sectionTitle;
    if (title) return title;
    return resolveSectionTitle(location.pathname);
  }, [sectionTitle, title, location.pathname]);

  const handleLogout = () => {
    Cookies.remove('token');
    Cookies.remove('id');
    localStorage.removeItem('userId');
    setDropdownOpen(false);
    navigate(PathConstants.AUTH);
  };

  const handleGoProfile = () => {
    setDropdownOpen(false);
    navigate(PathConstants.PROFILE);
  };

  const showSubnav = !hideSubnav && Boolean(resolvedSection);

  return (
    <header className="app-header">
      <div className="app-header__top">
        <div className="app-header__left">
          {onMenuToggle && (
            <button
              type="button"
              onClick={onMenuToggle}
              className="app-header__menu-btn"
              aria-label="Меню"
            >
              ☰
            </button>
          )}
          <Link
            to={PathConstants.HOME}
            className="app-header__brand"
            aria-label="Перейти на главную страницу"
          >
            <span className="app-header__logo-mark" aria-hidden="true">W</span>
            <span className="app-header__logo-text">WCraft</span>
          </Link>
          {subtitle && (
            <span className="app-header__subtitle hidden md:inline">{subtitle}</span>
          )}
        </div>

        <div className="app-header__right">
          <div className="app-header__user-wrap" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownOpen((o) => !o)}
              className="app-header__user-pill"
              aria-haspopup="menu"
              aria-expanded={dropdownOpen}
            >
              <span className="app-header__avatar">
                {resolvedUser?.avatar_url ? (
                  <img src={resolvedUser.avatar_url} alt={displayName} />
                ) : (
                  <span className="app-header__avatar-fallback">{initial}</span>
                )}
              </span>
              <span className="app-header__username">{displayName}</span>
              <svg
                className="app-header__chevron"
                viewBox="0 0 12 8"
                width="12"
                height="8"
                aria-hidden="true"
              >
                <path
                  d="M1 1.5L6 6.5L11 1.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
            </button>

            {dropdownOpen && (
              <div className="app-header__dropdown" role="menu">
                <button
                  type="button"
                  onClick={handleGoProfile}
                  className="app-header__dropdown-item"
                  role="menuitem"
                >
                  Мой кабинет
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="app-header__dropdown-item"
                  role="menuitem"
                >
                  Выйти
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showSubnav && (
        <div className="app-header__subnav">
          <Link
            to={PathConstants.PROJECTS}
            className="app-header__home"
            aria-label="На главную"
          >
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
              <path
                d="M3 9.5L10 3.5L17 9.5V16.5C17 16.7761 16.7761 17 16.5 17H13V12H7V17H3.5C3.22386 17 3 16.7761 3 16.5V9.5Z"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          </Link>
          <span className="app-header__subnav-divider" aria-hidden="true" />
          <span className="app-header__section-title">{resolvedSection}</span>
        </div>
      )}
    </header>
  );
};

export default DashboardHeader;
