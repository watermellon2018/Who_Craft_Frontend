import React from 'react';

interface Props {
  bio: string;
  interests: string[];
}

const AboutCard: React.FC<Props> = ({ bio, interests }) => {
  return (
    <div className="bg-[#16191f] border border-white/5 rounded-2xl p-5 shadow-md">
      <h3 className="text-white font-semibold text-base mb-3">👤 О себе</h3>

      {bio ? (
        <p className="text-white/60 text-sm leading-relaxed mb-4">{bio}</p>
      ) : (
        <div className="mb-4 p-3 rounded-xl bg-white/3 border border-white/5 text-center">
          <p className="text-white/30 text-sm mb-2">Расскажите о себе, своих проектах и творческих интересах.</p>
          <button className="text-[#fab005] text-xs hover:underline">Заполнить профиль</button>
        </div>
      )}

      {interests.length > 0 && (
        <div>
          <p className="text-white/30 text-xs mb-2 uppercase tracking-wider">Интересы</p>
          <div className="flex flex-wrap gap-2">
            {interests.map((tag) => (
              <span
                key={tag}
                className="bg-[#fab005]/10 text-[#fab005] text-xs font-medium px-3 py-1 rounded-full border border-[#fab005]/20"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AboutCard;
