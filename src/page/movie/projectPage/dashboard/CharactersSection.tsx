import React from 'react';
import { PlusOutlined, MoreOutlined } from '@ant-design/icons';
import { CharacterMock } from './mocks';

interface CharacterCardProps {
  character: CharacterMock;
}

const CharacterCard: React.FC<CharacterCardProps> = ({ character }) => {
  return (
    <div className="proj-card overflow-hidden flex flex-col">
      <div
        className="relative w-full aspect-[3/4] flex items-center justify-center overflow-hidden"
        style={{ background: character.gradient }}
      >
        {character.imageUrl ? (
          <img
            src={character.imageUrl}
            alt={character.name}
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="text-white/85 text-5xl font-bold tracking-tight select-none">
            {character.initial}
          </span>
        )}

        {character.isMain && (
          <span
            className="absolute top-3 left-3 text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-md"
            style={{
              background: 'rgba(250, 176, 5, 0.18)',
              color: '#fab005',
              border: '1px solid rgba(250, 176, 5, 0.35)',
            }}
          >
            Главная
          </span>
        )}

        <button
          type="button"
          className="absolute top-2.5 right-2.5 w-7 h-7 rounded-md flex items-center justify-center text-white/80 hover:text-white"
          style={{ background: 'rgba(0,0,0,0.35)' }}
          onClick={(e) => {
            e.stopPropagation();
          }}
          aria-label="More"
        >
          <MoreOutlined />
        </button>
      </div>
      <div className="px-4 py-3.5">
        <div className="text-white text-sm font-semibold leading-tight truncate">
          {character.name}
        </div>
        <div className="text-white/70 text-xs mt-1 truncate">{character.role}</div>
        <div className="text-white/50 text-[11px] mt-2">{character.tag}</div>
      </div>
    </div>
  );
};

interface Props {
  characters: CharacterMock[];
  onCreate: () => void;
}

const CharactersSection: React.FC<Props> = ({ characters, onCreate }) => {
  return (
    <section className="proj-card p-5 sm:p-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {characters.map((c) => (
          <CharacterCard key={c.id} character={c} />
        ))}
        <button type="button" className="proj-create-card" onClick={onCreate}>
          <span
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{
              background: 'rgba(250, 176, 5, 0.12)',
              color: '#fab005',
            }}
          >
            <PlusOutlined style={{ fontSize: 18 }} />
          </span>
          <span className="text-sm font-medium">Создать персонажа</span>
        </button>
      </div>
    </section>
  );
};

export default CharactersSection;
