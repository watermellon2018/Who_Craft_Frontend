import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import PathConstants from '../../routes/pathConstant';
import ProfileSidebar from './components/ProfileSidebar';
import ProfileHeroEditor from './components/edit/ProfileHeroEditor';
import BasicInfoCard from './components/edit/BasicInfoCard';
import InterestsCard from './components/edit/InterestsCard';
import SocialLinksCard from './components/edit/SocialLinksCard';
import ProfilePreviewPanel from './components/edit/ProfilePreviewPanel';
import { ProfileEditFormState, SocialLinks } from './types';
import {
  fetchProfileMe,
  saveProfileMe,
  uploadAvatar,
  deleteAvatar,
  uploadCover,
  deleteCover,
  ProfileMeResponse,
} from './api/profileApi';
import './profile.css';

type MediaAction = 'keep' | 'replace' | 'delete';

interface DraftMedia {
  avatarUrl: string | null;
  coverUrl: string | null;
  avatarFile: File | null;
  coverFile: File | null;
  avatarAction: MediaAction;
  coverAction: MediaAction;
}

const PLATFORM_TO_KEY: Record<string, keyof SocialLinks> = {
  telegram: 'telegram',
  instagram: 'instagram',
  youtube: 'youtube',
  website: 'website',
};

const EMPTY_SOCIALS: SocialLinks = { telegram: '', instagram: '', youtube: '', website: '' };

function mapResponseToState(res: ProfileMeResponse): ProfileEditFormState {
  const socials: SocialLinks = { ...EMPTY_SOCIALS };
  for (const link of res.socials) {
    const key = PLATFORM_TO_KEY[link.platform];
    if (key) socials[key] = link.url;
  }
  return {
    // Use public_username (the editable field) not effective_username.
    // effective_username may fall back to auth.username which can contain
    // characters rejected by the public_username regex (@, uppercase, dots).
    username: res.user.public_username ?? '',
    display_name: res.user.display_name ?? '',
    bio: res.user.bio ?? '',
    avatar_url: res.user.avatar_url,
    cover_url: res.user.cover_url,
    interests: res.interests,
    socials,
    settings: {
      private_account: res.settings.private_account,
      show_in_recommendations: true,
      show_activity: true,
    },
    language: (res.settings.language as 'ru' | 'en') ?? 'ru',
  };
}

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function stateToSocialsPayload(socials: SocialLinks) {
  const entries = Object.entries(PLATFORM_TO_KEY) as [string, keyof SocialLinks][];
  return entries
    .map(([platform, key], idx) => ({ platform, url: normalizeUrl(socials[key] ?? ''), display_order: idx }))
    .filter((link) => link.url !== '');
}

function freshDraftMedia(res: ProfileMeResponse): DraftMedia {
  return {
    avatarUrl: res.user.avatar_url,
    coverUrl: res.user.cover_url,
    avatarFile: null,
    coverFile: null,
    avatarAction: 'keep',
    coverAction: 'keep',
  };
}

function isDirty(
  form: ProfileEditFormState,
  media: DraftMedia,
  saved: ProfileEditFormState,
  savedMedia: DraftMedia,
): boolean {
  if (
    form.username !== saved.username ||
    form.display_name !== saved.display_name ||
    form.bio !== saved.bio
  ) return true;
  if (JSON.stringify(form.interests) !== JSON.stringify(saved.interests)) return true;
  if (JSON.stringify(form.socials) !== JSON.stringify(saved.socials)) return true;
  if (media.avatarAction !== 'keep' || media.coverAction !== 'keep') return true;
  return false;
}

const ProfileEditPage: React.FC = () => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // form state (text fields, interests, socials)
  const [draft, setDraft] = useState<ProfileEditFormState | null>(null);
  // saved = the last committed state from backend
  const [saved, setSaved] = useState<ProfileEditFormState | null>(null);

  // media draft (avatar/cover files and action flags)
  const [media, setMedia] = useState<DraftMedia>({
    avatarUrl: null,
    coverUrl: null,
    avatarFile: null,
    coverFile: null,
    avatarAction: 'keep',
    coverAction: 'keep',
  });
  const [savedMedia, setSavedMedia] = useState<DraftMedia>({
    avatarUrl: null,
    coverUrl: null,
    avatarFile: null,
    coverFile: null,
    avatarAction: 'keep',
    coverAction: 'keep',
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMsg, setSuccessMsg] = useState('');

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  // track object URLs we created so we can revoke them
  const ownedObjectUrls = useRef<string[]>([]);

  const revokeUrl = (url: string | null) => {
    if (url && url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
      ownedObjectUrls.current = ownedObjectUrls.current.filter((u) => u !== url);
    }
  };

  useEffect(() => {
    fetchProfileMe()
      .then((res) => {
        const formState = mapResponseToState(res);
        const mediaState = freshDraftMedia(res);
        setDraft(formState);
        setSaved(formState);
        setMedia(mediaState);
        setSavedMedia(mediaState);
      })
      .catch(() => setErrors({ global: 'Не удалось загрузить профиль. Попробуйте обновить страницу.' }))
      .finally(() => setIsLoading(false));

    return () => {
      // revoke all created object URLs on unmount
      ownedObjectUrls.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const updateDraft = useCallback(<K extends keyof ProfileEditFormState>(
    key: K,
    value: ProfileEditFormState[K],
  ) => {
    setDraft((prev) => prev ? { ...prev, [key]: value } : prev);
  }, []);

  // ── Local media handlers (no backend calls) ──────────────────────────

  const handleAvatarFileSelected = (file: File) => {
    const objectUrl = URL.createObjectURL(file);
    ownedObjectUrls.current.push(objectUrl);
    setMedia((prev) => {
      revokeUrl(prev.avatarAction === 'replace' ? prev.avatarUrl : null);
      return {
        ...prev,
        avatarFile: file,
        avatarUrl: objectUrl,
        avatarAction: 'replace',
      };
    });
    if (avatarInputRef.current) avatarInputRef.current.value = '';
  };

  const handleAvatarDelete = () => {
    setMedia((prev) => {
      revokeUrl(prev.avatarAction === 'replace' ? prev.avatarUrl : null);
      return {
        ...prev,
        avatarFile: null,
        avatarUrl: null,
        avatarAction: 'delete',
      };
    });
    if (avatarInputRef.current) avatarInputRef.current.value = '';
  };

  const handleCoverFileSelected = (file: File) => {
    const objectUrl = URL.createObjectURL(file);
    ownedObjectUrls.current.push(objectUrl);
    setMedia((prev) => {
      revokeUrl(prev.coverAction === 'replace' ? prev.coverUrl : null);
      return {
        ...prev,
        coverFile: file,
        coverUrl: objectUrl,
        coverAction: 'replace',
      };
    });
    if (coverInputRef.current) coverInputRef.current.value = '';
  };

  const handleCoverDelete = () => {
    setMedia((prev) => {
      revokeUrl(prev.coverAction === 'replace' ? prev.coverUrl : null);
      return {
        ...prev,
        coverFile: null,
        coverUrl: null,
        coverAction: 'delete',
      };
    });
    if (coverInputRef.current) coverInputRef.current.value = '';
  };

  // ── Save: commit everything to backend ───────────────────────────────

  const handleSave = async () => {
    if (!draft) return;
    setIsSaving(true);
    setErrors({});
    setSuccessMsg('');
    try {
      // 1. Save text profile data
      const profileRes = await saveProfileMe({
        display_name: draft.display_name,
        public_username: draft.username || null,
        bio: draft.bio,
        interests: draft.interests,
        socials: stateToSocialsPayload(draft.socials),
      });

      // 2. Process avatar
      let finalAvatarUrl = profileRes.user.avatar_url;
      if (media.avatarAction === 'replace' && media.avatarFile) {
        const avatarRes = await uploadAvatar(media.avatarFile);
        finalAvatarUrl = avatarRes.user.avatar_url;
      } else if (media.avatarAction === 'delete') {
        await deleteAvatar();
        finalAvatarUrl = null;
      }

      // 3. Process cover
      let finalCoverUrl = profileRes.user.cover_url;
      if (media.coverAction === 'replace' && media.coverFile) {
        const coverRes = await uploadCover(media.coverFile);
        finalCoverUrl = coverRes.user.cover_url;
      } else if (media.coverAction === 'delete') {
        await deleteCover();
        finalCoverUrl = null;
      }

      // 4. Commit — revoke object URLs, update saved state
      revokeUrl(media.avatarAction === 'replace' ? media.avatarUrl : null);
      revokeUrl(media.coverAction === 'replace' ? media.coverUrl : null);

      const committedFormState = mapResponseToState(profileRes);
      committedFormState.avatar_url = finalAvatarUrl;
      committedFormState.cover_url = finalCoverUrl;

      const committedMedia: DraftMedia = {
        avatarUrl: finalAvatarUrl,
        coverUrl: finalCoverUrl,
        avatarFile: null,
        coverFile: null,
        avatarAction: 'keep',
        coverAction: 'keep',
      };

      setDraft(committedFormState);
      setSaved(committedFormState);
      setMedia(committedMedia);
      setSavedMedia(committedMedia);
      setSuccessMsg('Изменения сохранены');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const data = err.response?.data as Record<string, unknown> | undefined;
        if (err.response?.status === 409) {
          setErrors({ username: 'Это имя пользователя уже занято' });
        } else if (err.response?.status === 400 && typeof data?.errors === 'object' && data.errors !== null) {
          const errs = data.errors as Record<string, unknown>;
          if ('interests' in errs) {
            setErrors({ interests: 'Можно добавить максимум 10 интересов' });
          } else if ('socials' in errs) {
            setErrors({ socials: 'Одна или несколько ссылок некорректны. Проверьте формат URL (например: https://t.me/username).' });
          } else if ('public_username' in errs) {
            setErrors({ username: 'Имя пользователя может содержать только строчные латинские буквы, цифры, «-» и «_» (3–32 символа).' });
          } else {
            setErrors({ global: 'Не удалось сохранить. Проверьте введённые данные.' });
          }
        } else {
          setErrors({ global: 'Не удалось сохранить. Проверьте данные и попробуйте снова.' });
        }
      } else {
        setErrors({ global: 'Произошла ошибка. Попробуйте снова.' });
      }
    } finally {
      setIsSaving(false);
    }
  };

  // ── Cancel: discard draft, restore saved state (stay on page) ──────────

  const handleCancel = () => {
    revokeUrl(media.avatarAction === 'replace' ? media.avatarUrl : null);
    revokeUrl(media.coverAction === 'replace' ? media.coverUrl : null);
    if (saved) {
      setDraft(saved);
      setMedia(savedMedia);
    }
    if (avatarInputRef.current) avatarInputRef.current.value = '';
    if (coverInputRef.current) coverInputRef.current.value = '';
  };

  // ── Go to cabinet: discard draft and navigate ────────────────────────

  const handleGoToCabinet = () => {
    revokeUrl(media.avatarAction === 'replace' ? media.avatarUrl : null);
    revokeUrl(media.coverAction === 'replace' ? media.coverUrl : null);
    navigate(PathConstants.PROFILE);
  };

  const dirty = draft && saved ? isDirty(draft, media, saved, savedMedia) : false;

  // draft is the view source; media provides avatar/cover URLs for preview
  const viewState: ProfileEditFormState | null = draft
    ? { ...draft, avatar_url: media.avatarUrl, cover_url: media.coverUrl }
    : null;

  return (
    <div className="flex h-screen bg-[#0f1117] overflow-hidden">
      <ProfileSidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto profile-scroll">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            <button
              type="button"
              onClick={() => setSidebarOpen((o) => !o)}
              className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg text-white/70 hover:text-white hover:bg-white/5 transition-colors mb-2"
              style={{ background: 'transparent', border: 'none' }}
              aria-label="Открыть меню"
            >
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none">
                <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
            <div className="mb-6">
              <h2 className="text-white font-bold text-2xl">Редактирование профиля</h2>
              <nav className="text-sm mt-1.5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate(PathConstants.PROFILE)}
                  className="text-white/60 hover:text-white transition-colors"
                >
                  Личный кабинет
                </button>
                <span className="text-white/30">›</span>
                <span className="text-accent">Редактирование профиля</span>
              </nav>
            </div>

            {errors.global && (
              <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-sm">
                {errors.global}
              </div>
            )}

            {successMsg && (
              <div className="mb-4 px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/25 text-green-400 text-sm">
                {successMsg}
              </div>
            )}

            {isLoading ? (
              <div className="flex items-center justify-center py-24">
                <span className="text-white/50 text-sm">Загрузка профиля…</span>
              </div>
            ) : viewState ? (
              <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
                <div className="space-y-4 min-w-0">
                  <ProfileHeroEditor
                    username={viewState.username}
                    bio={viewState.bio}
                    avatarUrl={media.avatarUrl}
                    coverUrl={media.coverUrl}
                    avatarInputRef={avatarInputRef}
                    coverInputRef={coverInputRef}
                    onAvatarFileSelected={handleAvatarFileSelected}
                    onAvatarDelete={handleAvatarDelete}
                    onCoverFileSelected={handleCoverFileSelected}
                    onCoverDelete={handleCoverDelete}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                    <BasicInfoCard
                      username={viewState.username}
                      displayName={viewState.display_name}
                      bio={viewState.bio}
                      usernameError={errors.username}
                      onUsernameChange={(v) => updateDraft('username', v)}
                      onDisplayNameChange={(v) => updateDraft('display_name', v)}
                      onBioChange={(v) => updateDraft('bio', v)}
                    />
                    <InterestsCard
                      interests={viewState.interests}
                      interestsError={errors.interests}
                      onChange={(v) => updateDraft('interests', v)}
                    />
                  </div>

                  <SocialLinksCard
                    socials={viewState.socials}
                    error={errors.socials}
                    onChange={(v) => updateDraft('socials', v)}
                  />
                </div>

                <aside className="min-w-0">
                  <ProfilePreviewPanel state={viewState} />
                </aside>
              </div>
            ) : null}
            <div className="h-6" />
          </div>
        </main>

        <div className="border-t border-white/5 bg-[#13151a]/85 backdrop-blur">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || isLoading || !draft}
              className="inline-flex items-center gap-2 bg-accent text-[#13151a] text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-[#fcc419] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? '⏳ Сохранение…' : '💾 Сохранить изменения'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSaving}
              className="inline-flex items-center gap-2 bg-[#262a32] hover:bg-[#2f343d] text-sm font-medium px-4 py-2.5 rounded-xl border border-white/15 hover:border-white/25 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/50 transition-colors disabled:opacity-50"
              style={{ color: 'rgba(255,255,255,0.92)' }}
            >
              <span style={{ color: 'rgba(255,255,255,0.92)' }}>✕</span> Отмена
            </button>
            <button
              type="button"
              onClick={handleGoToCabinet}
              disabled={isSaving}
              className="inline-flex items-center gap-2 bg-[#262a32] hover:bg-[#2f343d] text-sm font-medium px-4 py-2.5 rounded-xl border border-white/15 hover:border-white/25 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/50 transition-colors disabled:opacity-50"
              style={{ color: 'rgba(255,255,255,0.92)' }}
            >
              ← В кабинет
            </button>
            {dirty && (
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
                Есть несохранённые изменения
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileEditPage;
