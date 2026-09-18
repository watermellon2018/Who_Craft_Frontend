import {CloseOutlined, UserAddOutlined, UserOutlined} from '@ant-design/icons';
import React, {useEffect, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';

import type {MissingScriptCharacter} from './types';

interface MissingCharactersNoticeProps {
  canCreate: boolean;
  characters: MissingScriptCharacter[];
  onCreate: (character: MissingScriptCharacter) => void;
  projectId: string;
}

const storageKey = (projectId: string) => `script:missing-characters:dismissed:${projectId}`;

export function missingCharactersFingerprint(characters: MissingScriptCharacter[]): string {
  return JSON.stringify(characters
    .map(({dialogueCount, name, sceneCount}) => ({
      dialogueCount,
      name: name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase(),
      sceneCount,
    }))
    .sort((left, right) => left.name.localeCompare(right.name)));
}

function storedFingerprint(projectId: string): string | null {
  try {
    return window.sessionStorage.getItem(storageKey(projectId));
  } catch {
    return null;
  }
}

export default function MissingCharactersNotice({
  canCreate,
  characters,
  onCreate,
  projectId,
}: MissingCharactersNoticeProps) {
  const {t} = useTranslation();
  const fingerprint = useMemo(() => missingCharactersFingerprint(characters), [characters]);
  const [dismissedFingerprint, setDismissedFingerprint] = useState(
    () => storedFingerprint(projectId),
  );

  useEffect(() => {
    setDismissedFingerprint(storedFingerprint(projectId));
  }, [projectId]);

  const dismiss = () => {
    try {
      window.sessionStorage.setItem(storageKey(projectId), fingerprint);
    } catch {
      // The notice remains dismissible in-memory when storage is unavailable.
    }
    setDismissedFingerprint(fingerprint);
  };

  if (characters.length === 0 || dismissedFingerprint === fingerprint) return null;

  return (
    <section
      aria-labelledby="missing-characters-title"
      aria-live="polite"
      className="script-missing-characters"
    >
      <UserOutlined aria-hidden="true" className="script-missing-characters__icon" />
      <div className="script-missing-characters__copy">
        <h2 id="missing-characters-title">
          {t('script.missingCharacters.title')}
        </h2>
        <p>
          {t('script.missingCharacters.description')}
        </p>
      </div>
      <ul aria-label={t('script.missingCharacters.listLabel')}>
        {characters.map((character) => (
          <li key={character.name}>
            {canCreate ? (
              <button
                aria-label={t('script.missingCharacters.createLabel', {
                  name: character.name,
                })}
                onClick={() => onCreate(character)}
                type="button"
              >
                <UserAddOutlined aria-hidden="true" />
                <span>{character.name}</span>
              </button>
            ) : <span>{character.name}</span>}
          </li>
        ))}
      </ul>
      <button
        aria-label={t('script.missingCharacters.dismissLabel')}
        className="script-missing-characters__close"
        onClick={dismiss}
        title={t('script.actions.close')}
        type="button"
      >
        <CloseOutlined aria-hidden="true" />
      </button>
    </section>
  );
}
