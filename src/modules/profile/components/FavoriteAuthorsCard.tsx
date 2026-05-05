import React from 'react';
import { FavoriteAuthor } from '../types';

interface Props {
  authors: FavoriteAuthor[];
}

function formatSubs(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K';
  return String(n);
}

const FavoriteAuthorsCard: React.FC<Props> = ({ authors }) => {
  return (
    <div className="bg-[#16191f] border border-white/5 rounded-2xl p-5 shadow-md">
      <h3 className="text-white font-semibold text-base mb-4">⭐ Избранные авторы</h3>

      <div className="space-y-3">
        {authors.map((author) => (
          <div key={author.id} className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#fab005]/20 flex items-center justify-center text-[#fab005] font-bold text-sm flex-shrink-0">
              {author.avatar_url ? (
                <img src={author.avatar_url} alt={author.name} className="w-full h-full rounded-xl object-cover" />
              ) : (
                author.name[0]
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{author.name}</p>
              <p className="text-white/30 text-xs">{formatSubs(author.subscribers_count)} подписчиков</p>
            </div>
            <button
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors flex-shrink-0 ${
                author.is_subscribed
                  ? 'bg-white/5 text-white/50 border border-white/10 hover:bg-red-500/10 hover:text-red-400'
                  : 'bg-[#fab005] text-[#13151a] hover:bg-[#fcc419]'
              }`}
            >
              {author.is_subscribed ? 'Подписки' : 'Подписаться'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FavoriteAuthorsCard;
