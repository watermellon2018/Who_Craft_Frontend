import React from 'react';
import { ProfileEditFormState } from '../../types';

interface Props {
  state: ProfileEditFormState;
}

interface ChecklistItem {
  label: string;
  done: boolean;
}

const initial = (name: string) =>
  name ? name.trim().charAt(0).toUpperCase() : '?';

function buildChecklist(state: ProfileEditFormState): ChecklistItem[] {
  const hasBasic = !!state.username.trim() && !!state.display_name.trim();
  const hasAvatarOrCover = !!state.avatar_url || !!state.cover_url;
  const hasInterests = state.interests.length >= 3;
  const hasSocial = Object.values(state.socials).some((v) => v.trim().length > 0);
  const hasSettings = true;
  const hasBio = state.bio.trim().length >= 10;

  return [
    { label: 'Основная информация', done: hasBasic },
    { label: 'Аватар и обложка', done: hasAvatarOrCover },
    { label: 'Интересы (мин. 3)', done: hasInterests },
    { label: 'Соцсети и ссылки (мин. 1)', done: hasSocial },
    { label: 'Настройки профиля', done: hasSettings },
    { label: 'О себе (мин. 10 символов)', done: hasBio },
  ];
}

const ProgressRing: React.FC<{ percent: number }> = ({ percent }) => {
  const size = 56;
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  return (
    <svg width={size} height={size} className="flex-shrink-0">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={stroke}
        fill="none"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="#fab005"
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.3s ease' }}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        fontSize="13"
        fontWeight="700"
        fill="#fab005"
      >
        {percent}%
      </text>
    </svg>
  );
};

const ProfilePreviewPanel: React.FC<Props> = ({ state }) => {
  const checklist = buildChecklist(state);
  const done = checklist.filter((i) => i.done).length;
  const percent = Math.round((done / checklist.length) * 100);

  return (
    <div className="space-y-4">
      <section className="bg-[#16191f] border border-white/5 rounded-2xl p-5 shadow-md">
        <h3
          className="text-white font-semibold text-base"
          style={{ color: '#ffffff' }}
        >
          Предпросмотр профиля
        </h3>
        <p
          className="text-sm mt-1 mb-4"
          style={{ color: 'rgba(255,255,255,0.65)' }}
        >
          Так ваш профиль увидят другие пользователи.
        </p>

        <div className="rounded-2xl overflow-hidden border border-white/5 bg-[#0f1117]">
          <div
            className="h-20 w-full"
            style={{
              background: state.cover_url
                ? `url(${state.cover_url}) center/cover no-repeat`
                : 'linear-gradient(135deg, #1a1408 0%, #0d1117 50%, #2d1f00 100%)',
            }}
          />
          <div className="px-4 pb-4">
            <div className="w-16 h-16 rounded-2xl border-4 border-[#16191f] bg-[#1e2330] -mt-8 flex items-center justify-center text-[#fab005] font-bold text-2xl overflow-hidden">
              {state.avatar_url ? (
                <img src={state.avatar_url} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                initial(state.display_name || state.username)
              )}
            </div>
            <p
              className="font-semibold text-base mt-2"
              style={{ color: '#ffffff' }}
            >
              {state.display_name || state.username || 'admin'}
            </p>
            <p
              className="text-xs"
              style={{ color: 'rgba(255,255,255,0.65)' }}
            >
              @{state.username || 'admin'}
            </p>
            {state.bio && (
              <p
                className="text-sm mt-2 whitespace-pre-line leading-relaxed"
                style={{ color: 'rgba(255,255,255,0.78)' }}
              >
                {state.bio}
              </p>
            )}
            {state.interests.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {state.interests.slice(0, 8).map((tag) => (
                  <span
                    key={tag}
                    className="bg-white/5 text-white/75 text-xs px-2.5 py-1 rounded-full border border-white/5"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="bg-[#16191f] border border-white/5 rounded-2xl p-5 shadow-md">
        <div className="flex items-center gap-3 mb-4">
          <ProgressRing percent={percent} />
          <div className="min-w-0">
            <p
              className="font-semibold text-sm"
              style={{ color: '#ffffff' }}
            >
              Профиль заполнен на {percent}%
            </p>
            <p
              className="text-xs mt-0.5"
              style={{ color: 'rgba(255,255,255,0.65)' }}
            >
              Заполните все разделы, чтобы ваш профиль выглядел ещё лучше.
            </p>
          </div>
        </div>

        <ul className="space-y-1.5">
          {checklist.map((item) => (
            <li
              key={item.label}
              className="flex items-center justify-between text-sm gap-3"
            >
              <span
                className="flex items-center gap-2"
                style={{ color: 'rgba(255,255,255,0.85)' }}
              >
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>•</span>
                {item.label}
              </span>
              {item.done ? (
                <span className="w-5 h-5 inline-flex items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 text-xs">
                  ✓
                </span>
              ) : (
                <span className="w-5 h-5 inline-flex items-center justify-center rounded-full bg-[#fab005]/15 text-[#fab005] text-xs">
                  ✎
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

export default ProfilePreviewPanel;
