import React from 'react';

interface Props {
  genres: string[];
}

const FavoriteGenresCard: React.FC<Props> = ({ genres }) => {
  return (
    <div className="bg-[#16191f] border border-white/5 rounded-2xl p-5 shadow-md">
      <h3 className="text-white font-semibold text-base mb-4">🎬 Любимые жанры</h3>
      <div className="flex flex-wrap gap-2">
        {genres.map((genre) => (
          <span
            key={genre}
            className="bg-white/5 text-white/70 text-xs font-medium px-3 py-1.5 rounded-full border border-white/10 hover:border-accent/40 hover:text-white transition-colors cursor-default"
          >
            {genre}
          </span>
        ))}
      </div>
    </div>
  );
};

export default FavoriteGenresCard;
