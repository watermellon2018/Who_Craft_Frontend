import React, { useState } from 'react';

const MAX_INTERESTS = 10;

interface Props {
  interests: string[];
  interestsError?: string;
  onChange: (next: string[]) => void;
}

const InterestsCard: React.FC<Props> = ({ interests, interestsError, onChange }) => {
  const [input, setInput] = useState('');

  const atLimit = interests.length >= MAX_INTERESTS;

  const addInterest = () => {
    const value = input.trim();
    if (!value || atLimit) return;
    const exists = interests.some((i) => i.toLowerCase() === value.toLowerCase());
    if (exists) {
      setInput('');
      return;
    }
    onChange([...interests, value]);
    setInput('');
  };

  const removeInterest = (target: string) => {
    onChange(interests.filter((i) => i !== target));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addInterest();
    }
  };

  return (
    <section className="bg-[#16191f] border border-white/5 rounded-2xl p-5 shadow-md">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-white font-semibold text-base" style={{ color: '#ffffff' }}>
          Интересы
        </h3>
        <span
          className="text-xs tabular-nums"
          style={{ color: atLimit ? '#fab005' : 'rgba(255,255,255,0.5)' }}
        >
          {interests.length} / {MAX_INTERESTS}
        </span>
      </div>
      <p
        className="text-sm mt-1 mb-4"
        style={{ color: 'rgba(255,255,255,0.6)' }}
      >
        Выберите темы, которые вам интересны.
      </p>

      <div className="flex flex-wrap gap-2 mb-3">
        {interests.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1.5 bg-[#fab005]/12 text-[#fab005] text-xs font-medium px-3 py-1.5 rounded-full border border-[#fab005]/25"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeInterest(tag)}
              aria-label={`Удалить ${tag}`}
              className="text-[#fab005]/70 hover:text-[#fab005] transition-colors"
            >
              ×
            </button>
          </span>
        ))}
        {interests.length === 0 && (
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Пока нет интересов — добавьте первый.
          </span>
        )}
      </div>

      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={atLimit}
        placeholder={atLimit ? 'Достигнут лимит интересов' : 'Добавить интерес и нажмите Enter'}
        className="w-full bg-[#1b1f27] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm placeholder-white/30 focus:outline-none focus:border-[#fab005]/60 focus:ring-2 focus:ring-[#fab005]/15 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ color: 'rgba(255,255,255,0.92)' }}
      />

      {(atLimit || interestsError) && (
        <p className="text-xs mt-2" style={{ color: '#fab005' }}>
          {interestsError || 'Можно добавить максимум 10 интересов'}
        </p>
      )}
    </section>
  );
};

export default InterestsCard;
