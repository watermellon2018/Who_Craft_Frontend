import React from 'react';
import { ContinueWatchingItem } from '../types';

interface Props {
  items: ContinueWatchingItem[];
}

const ContinueWatchingCard: React.FC<Props> = ({ items }) => {
  return (
    <div className="bg-[#16191f] border border-white/5 rounded-2xl p-5 shadow-md">
      <h3 className="text-white font-semibold text-base mb-4">▶️ Продолжить просмотр</h3>

      {items.length === 0 ? (
        <p className="text-white/30 text-sm text-center py-4">Вы ещё не смотрели видео</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex-shrink-0 w-44 bg-white/3 border border-white/5 rounded-xl overflow-hidden hover:border-accent/20 transition-all cursor-pointer group"
            >
              <div className="relative h-24 bg-white/5">
                {item.thumbnail_url ? (
                  <img src={item.thumbnail_url} alt={item.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/10 text-3xl">🎬</div>
                )}
                <span className="absolute bottom-1.5 right-1.5 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded font-mono">
                  {item.duration}
                </span>
              </div>
              <div className="p-2.5">
                <p className="text-white text-xs font-medium leading-snug line-clamp-2 mb-2">{item.title}</p>
                <div className="w-full bg-white/10 rounded-full h-1 mb-1.5">
                  <div
                    className="bg-accent h-1 rounded-full"
                    style={{ width: `${item.progress_percent}%` }}
                  />
                </div>
                <p className="text-white/30 text-xs">с {item.continue_from}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ContinueWatchingCard;
