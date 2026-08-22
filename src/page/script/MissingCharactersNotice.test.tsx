import {fireEvent, render, screen} from '@testing-library/react';
import React from 'react';

import MissingCharactersNotice from './MissingCharactersNotice';
import type {MissingScriptCharacter} from './types';

const characters: MissingScriptCharacter[] = [
  {dialogueCount: 6, name: 'Анна', sceneCount: 1},
  {dialogueCount: 1, name: 'Максим', sceneCount: 2},
];

describe('MissingCharactersNotice', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('shows every missing character and starts creation for the selected name', () => {
    const onCreate = jest.fn();
    render(
      <MissingCharactersNotice
        canCreate
        characters={characters}
        onCreate={onCreate}
        projectId="42"
      />,
    );

    expect(screen.getByRole('heading', {
      name: 'Для сценария не хватает персонажей',
    })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Создать персонажа «Максим»'}));

    expect(onCreate).toHaveBeenCalledWith(characters[1]);
  });

  it('keeps the names visible without creation controls for read-only access', () => {
    render(
      <MissingCharactersNotice
        canCreate={false}
        characters={characters}
        onCreate={jest.fn()}
        projectId="42"
      />,
    );

    expect(screen.getByText('Анна')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: /Создать персонажа/})).not.toBeInTheDocument();
    expect(screen.getByRole('button', {
      name: 'Закрыть уведомление о недостающих персонажах',
    })).toBeInTheDocument();
  });

  it('does not render an empty notice', () => {
    const {container} = render(
      <MissingCharactersNotice
        canCreate
        characters={[]}
        onCreate={jest.fn()}
        projectId="42"
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('dismisses the current list for the project and reappears when the list changes', () => {
    const {rerender} = render(
      <MissingCharactersNotice
        canCreate
        characters={characters}
        onCreate={jest.fn()}
        projectId="42"
      />,
    );

    fireEvent.click(screen.getByRole('button', {
      name: 'Закрыть уведомление о недостающих персонажах',
    }));
    expect(screen.queryByRole('heading', {
      name: 'Для сценария не хватает персонажей',
    })).not.toBeInTheDocument();

    rerender(
      <MissingCharactersNotice
        canCreate
        characters={characters.map((character, index) => (
          index === 0 ? {...character, dialogueCount: character.dialogueCount + 1} : character
        ))}
        onCreate={jest.fn()}
        projectId="42"
      />,
    );

    expect(screen.getByRole('heading', {
      name: 'Для сценария не хватает персонажей',
    })).toBeInTheDocument();
  });
});
