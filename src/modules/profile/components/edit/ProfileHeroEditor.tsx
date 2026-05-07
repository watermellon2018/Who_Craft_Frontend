import React from 'react';

interface Props {
  username: string;
  bio: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  avatarInputRef: React.RefObject<HTMLInputElement>;
  coverInputRef: React.RefObject<HTMLInputElement>;
  onAvatarFileSelected: (file: File) => void;
  onAvatarDelete: () => void;
  onCoverFileSelected: (file: File) => void;
  onCoverDelete: () => void;
}

const initial = (name: string) =>
  name ? name.trim().charAt(0).toUpperCase() : '?';

const ProfileHeroEditor: React.FC<Props> = ({
  username,
  bio,
  avatarUrl,
  coverUrl,
  avatarInputRef,
  coverInputRef,
  onAvatarFileSelected,
  onAvatarDelete,
  onCoverFileSelected,
  onCoverDelete,
}) => {
  const handleAvatarPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onAvatarFileSelected(file);
  };

  const handleCoverPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onCoverFileSelected(file);
  };

  return (
    <section className="bg-[#16191f] border border-white/5 rounded-2xl p-5 shadow-md">
      <h3
        className="text-white font-semibold text-base"
        style={{ color: '#ffffff' }}
      >
        Ваш профиль
      </h3>
      <p
        className="text-sm mt-1 mb-4"
        style={{ color: 'rgba(255,255,255,0.65)' }}
      >
        Настройте аватар и обложку профиля.
      </p>

      <div className="relative rounded-2xl overflow-hidden border border-white/5">
        <div
          className="h-28 md:h-32 w-full"
          style={{
            background: coverUrl
              ? `url(${coverUrl}) center/cover no-repeat`
              : 'linear-gradient(135deg, #1a1408 0%, #0d1117 35%, #2d1f00 80%, #3d2a00 100%)',
          }}
        />
        <div className="absolute top-3 right-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => coverInputRef.current?.click()}
            className="inline-flex items-center gap-2 bg-black/60 hover:bg-black/80 text-white text-xs font-medium px-3 py-2 rounded-xl border border-white/10 backdrop-blur transition-colors"
          >
            📷 Изменить обложку
          </button>
          {coverUrl && (
            <button
              type="button"
              onClick={onCoverDelete}
              aria-label="Удалить обложку"
              className="w-8 h-8 inline-flex items-center justify-center bg-black/60 hover:bg-red-600/80 text-white text-sm rounded-xl border border-white/10 backdrop-blur transition-colors"
            >
              ✕
            </button>
          )}
        </div>
        <input
          ref={coverInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleCoverPick}
        />
      </div>

      <div className="relative -mt-10 ml-1 mb-4 w-fit">
        <div className="w-20 h-20 rounded-2xl border-4 border-[#16191f] bg-[#1e2330] flex items-center justify-center text-[#fab005] font-bold text-3xl shadow-lg overflow-hidden">
          {avatarUrl ? (
            <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
          ) : (
            initial(username)
          )}
        </div>
        <button
          type="button"
          onClick={() => avatarInputRef.current?.click()}
          aria-label="Загрузить аватар"
          className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#fab005] text-[#13151a] text-xs flex items-center justify-center shadow-md border-2 border-[#16191f] hover:bg-[#fcc419] transition-colors"
        >
          📷
        </button>
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleAvatarPick}
        />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mt-2 px-1">
        <div className="flex-1 min-w-0">
          <p
            className="font-semibold text-lg truncate"
            style={{ color: '#ffffff' }}
          >
            {username || 'admin'}
          </p>
          <p
            className="text-sm truncate"
            style={{ color: 'rgba(255,255,255,0.7)' }}
          >
            {bio.split('\n')[0] || 'Расскажите о себе'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            className="inline-flex items-center gap-2 bg-[#fab005] text-[#13151a] text-sm font-semibold px-4 py-2 rounded-xl hover:bg-[#fcc419] transition-colors"
          >
            ⬆ Загрузить аватар
          </button>
          <button
            type="button"
            onClick={onAvatarDelete}
            disabled={!avatarUrl}
            className="inline-flex items-center gap-2 bg-white/5 text-sm font-medium px-4 py-2 rounded-xl border border-white/10 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ color: 'rgba(255,255,255,0.85)' }}
          >
            🗑 Удалить
          </button>
        </div>
      </div>
    </section>
  );
};

export default ProfileHeroEditor;
