import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import WCraftBrand from '../../../components/WCraftBrand';
import { ProfileUser } from '../types';
import { fetchProfileMe } from '../api/profileApi';
import PathConstants, {isProjectEditPath, isScriptWorkspacePath} from '../../../routes/pathConstant';
import { logout } from '../../../api/http';
import { safeImageUrl } from '../../../utils/safeUrl';
import i18n from '../../../i18n';
import './dashboardHeader.css';

export interface BreadcrumbItem {
  label: string;
  to?: string;
  state?: unknown;
}

interface Props {
  user?: ProfileUser | null;
  onMenuToggle?: () => void;
  title?: string;
  subtitle?: string;
  sectionTitle?: string;
  hideSubnav?: boolean;
  breadcrumbItems?: BreadcrumbItem[];
}

function resolveSectionTitle(pathname: string): string {
  const t = (key: string) => i18n.t(key) as string;
  if (pathname.startsWith(PathConstants.PROFILE_SUBSCRIPTIONS)) return t('navigation.sections.subscriptions');
  if (pathname.startsWith(PathConstants.PROFILE_EDIT)) return t('navigation.sections.profileEdit');
  if (pathname.startsWith(PathConstants.PROFILE)) return t('navigation.sections.profile');
  if (pathname.startsWith(PathConstants.PROJECTS)) return t('navigation.sections.myProjects');
  if (pathname.startsWith(PathConstants.CREATE_PROJECT)) return t('navigation.sections.createProject');
  if (isProjectEditPath(pathname)) return t('navigation.sections.editProject');
  if (pathname.startsWith('/project/') && pathname.includes('/characters')) return t('navigation.sections.characters');
  if (isScriptWorkspacePath(pathname)) return t('navigation.sections.script');
  if (pathname === PathConstants.HOME) return t('navigation.sections.home');
  return '';
}

const DashboardHeader: React.FC<Props> = ({
  user,
  onMenuToggle,
  title,
  subtitle,
  sectionTitle,
  hideSubnav = false,
  breadcrumbItems,
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

  const handleLogout = async () => {
    await logout();
    setDropdownOpen(false);
    navigate(PathConstants.AUTH);
  };

  const handleGoProfile = () => {
    setDropdownOpen(false);
    navigate(PathConstants.PROFILE);
  };

  const hasCustomCrumbs = Array.isArray(breadcrumbItems) && breadcrumbItems.length > 0;
  const showSubnav = !hideSubnav && (hasCustomCrumbs || Boolean(resolvedSection));

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
          <WCraftBrand />
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
                {safeImageUrl(resolvedUser?.avatar_url) ? (
                  <img src={safeImageUrl(resolvedUser?.avatar_url)!} alt={displayName} />
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
          {hasCustomCrumbs ? (
            breadcrumbItems!.map((item, idx) => {
              const isLast = idx === breadcrumbItems!.length - 1;
              return (
                <React.Fragment key={`${idx}-${item.label}`}>
                  {idx > 0 && (
                    <span className="app-header__crumb-separator" aria-hidden="true">/</span>
                  )}
                  {item.to && !isLast ? (
                    <Link
                      to={item.to}
                      state={item.state}
                      className="app-header__crumb-link"
                    >
                      {item.label}
                    </Link>
                  ) : isLast ? (
                    <span
                      className="app-header__section-title"
                      title={item.label}
                      aria-current="page"
                    >
                      {item.label}
                    </span>
                  ) : (
                    <span className="app-header__crumb-link app-header__crumb-link--static">
                      {item.label}
                    </span>
                  )}
                </React.Fragment>
              );
            })
          ) : (
            <>
              <Link to={PathConstants.PROJECTS} className="app-header__crumb-link">
                Все проекты
              </Link>
              <span className="app-header__crumb-separator" aria-hidden="true">/</span>
              <span className="app-header__section-title">{resolvedSection}</span>
            </>
          )}
        </div>
      )}
    </header>
  );
};

export default DashboardHeader;
