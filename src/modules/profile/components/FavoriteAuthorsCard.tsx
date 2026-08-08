import React from 'react';
import { useTranslation } from 'react-i18next';
import { FavoriteAuthor } from '../types';
import { safeImageUrl } from '../../../utils/safeUrl';

interface Props {
  authors: FavoriteAuthor[];
}

function formatSubs(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K';
  return String(n);
}

const FavoriteAuthorsCard: React.FC<Props> = ({ authors }) => {
  const { t } = useTranslation();
  if (authors.length === 0) {
    return (
      <div className="bg-[#16191f] border border-white/5 rounded-2xl p-5 shadow-md">
        <h3 className="text-white font-semibold text-base mb-4">{t('profile.favoriteAuthors.title')}</h3>
        <p className="text-white/30 text-sm text-center py-4">
          {t('profile.favoriteAuthors.empty')}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[#16191f] border border-white/5 rounded-2xl p-5 shadow-md">
      <h3 className="text-white font-semibold text-base mb-4">{t('profile.favoriteAuthors.title')}</h3>

      <div className="space-y-3">
        {authors.map((author) => (
          <div key={author.id} className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center text-accent font-bold text-sm flex-shrink-0">
              {safeImageUrl(author.avatar_url) ? (
                <img src={safeImageUrl(author.avatar_url)!} alt={author.name} className="w-full h-full rounded-xl object-cover" />
              ) : (
                author.name[0]
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{author.name}</p>
              <p className="text-white/30 text-xs">{t('profile.favoriteAuthors.subscribers', { value: formatSubs(author.subscribers_count) })}</p>
            </div>
            <button
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors flex-shrink-0 ${
                author.is_subscribed
                  ? 'bg-white/5 text-white/50 border border-white/10 hover:bg-red-500/10 hover:text-red-400'
                  : 'bg-accent text-[#13151a] hover:bg-[#fcc419]'
              }`}
            >
              {author.is_subscribed ? t('profile.favoriteAuthors.subscribed') : t('profile.favoriteAuthors.subscribe')}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FavoriteAuthorsCard;
