import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Cookies from 'js-cookie';
import withAuth from '../../utils/auth/check_auth';
import PathConstants from '../../routes/pathConstant';
import { ProfileUser } from '../../modules/profile/types';
import { fetchProfileMe } from '../../modules/profile/api/profileApi';
import { logout } from '../../api/http';
import CreditBalanceBadge from '../../modules/credits/components/CreditBalanceBadge';
import NotificationBell from '../../modules/notifications/NotificationBell';
import '../../modules/profile/components/dashboardHeader.css';
import './main.css';

const IconPlus = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none">
    <circle cx="12" cy="12" r="9.25" stroke="currentColor" strokeWidth="1.6" />
    <path d="M12 7.5V16.5M7.5 12H16.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

const IconFolder = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none">
    <path
      d="M3.5 7.5C3.5 6.39543 4.39543 5.5 5.5 5.5H10L12 7.5H18.5C19.6046 7.5 20.5 8.39543 20.5 9.5V16.5C20.5 17.6046 19.6046 18.5 18.5 18.5H5.5C4.39543 18.5 3.5 17.6046 3.5 16.5V7.5Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
);

const IconPlay = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none">
    <circle cx="12" cy="12" r="9.25" stroke="currentColor" strokeWidth="1.6" />
    <path d="M10 8.5L16 12L10 15.5V8.5Z" fill="currentColor" />
  </svg>
);

const IconSparkles = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none">
    <path
      d="M12 4L13.4 9L18 10.5L13.4 12L12 17L10.6 12L6 10.5L10.6 9L12 4Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <path d="M18 15.5L18.7 17.5L20.5 18L18.7 18.5L18 20.5L17.3 18.5L15.5 18L17.3 17.5L18 15.5Z" fill="currentColor" />
  </svg>
);

const IconPackage = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none">
    <path
      d="M12 3.5L20.5 7.5V16.5L12 20.5L3.5 16.5V7.5L12 3.5Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <path d="M3.5 7.5L12 11.5M12 11.5L20.5 7.5M12 11.5V20.5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);

interface HomeUserPillProps {
  user: ProfileUser | null;
}

const HomeUserPill: React.FC<HomeUserPillProps> = ({ user }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const displayName = user?.display_name || user?.username || 'User';
  const initial = displayName.trim().charAt(0).toUpperCase();

  const handleGoProfile = () => {
    setOpen(false);
    navigate(PathConstants.PROFILE);
  };

  const handleLogout = async () => {
    Cookies.remove('token');
    Cookies.remove('id');
    await logout();
    setOpen(false);
    navigate(PathConstants.AUTH);
  };

  return (
    <div className="home-user-pill-wrap">
      <CreditBalanceBadge />
      <NotificationBell />
      <div className="app-header__user-wrap" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="app-header__user-pill"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <span className="app-header__avatar">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt={displayName} />
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

        {open && (
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
  );
};

const HomeHero: React.FC = () => (
  <div className="home-hero">
    <div className="home-hero__logo" aria-hidden="true">
      <span>W</span>
    </div>
    <div className="home-hero__brand">WCraft</div>
    <div className="home-hero__tagline">AI FILM STUDIO</div>
    <h1 className="home-hero__title">
      Создавайте AI-фильмы
      <br />
      с полным контролем
    </h1>
    <p className="home-hero__subtitle">
      Персонажи, сценарии, сцены, камера и генерация видео —
      <br />
      в одном творческом пространстве.
    </p>
  </div>
);

interface ActionCardProps {
  to: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  primary?: boolean;
}

const ActionCard: React.FC<ActionCardProps> = ({ to, icon, title, description, primary }) => (
  <Link
    to={to}
    className={`home-action-card${primary ? ' home-action-card--primary' : ''}`}
  >
    <div className="home-action-card__icon">{icon}</div>
    <div className="home-action-card__body">
      <h3 className="home-action-card__title">{title}</h3>
      <p className="home-action-card__description">{description}</p>
    </div>
  </Link>
);

interface DisabledCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  badge: string;
}

const DisabledCard: React.FC<DisabledCardProps> = ({ icon, title, description, badge }) => (
  <div className="home-action-card home-action-card--disabled" aria-disabled="true">
    <div className="home-action-card__icon">{icon}</div>
    <div className="home-action-card__body">
      <span className="home-action-card__badge">{badge}</span>
      <h3 className="home-action-card__title">{title}</h3>
      <p className="home-action-card__description">{description}</p>
    </div>
  </div>
);

export const MainPage: React.FC = () => {
  const [user, setUser] = useState<ProfileUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchProfileMe()
      .then((data) => {
        if (!cancelled) {
          setUser(data.user as unknown as ProfileUser);
        }
      })
      .catch(() => void 0);
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="home-page">
      <HomeUserPill user={user} />

      <div className="home-page__content">
        <HomeHero />

        <div className="home-actions-grid">
          <ActionCard
            to={PathConstants.CREATE_PROJECT}
            icon={<IconPlus />}
            title="Создать проект"
            description="Начните новый фильм, сцену или генеративный ролик."
            primary
          />
          <ActionCard
            to={PathConstants.PROJECTS}
            icon={<IconFolder />}
            title="Мои проекты"
            description="Откройте существующие проекты и продолжите работу."
          />
          <ActionCard
            to={PathConstants.PROFILE}
            icon={<IconPlay />}
            title="Мой канал"
            description="Управляйте публикациями, профилем и витриной работ."
          />
          <DisabledCard
            icon={<IconSparkles />}
            title="Кинотеатр"
            description="Открывайте фильмы, сцены и ролики других авторов."
            badge="В разработке"
          />
          <DisabledCard
            icon={<IconSparkles />}
            title="Подписки"
            description="Следите за новыми работами любимых авторов."
            badge="В разработке"
          />
          <DisabledCard
            icon={<IconPackage />}
            title="Челленджи"
            description="Создавайте ролики и побеждайте врагов."
            badge="Скоро"
          />
        </div>
      </div>
    </div>
  );
};

export default withAuth(MainPage);
