import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';

import CharactersSection from './CharactersSection';
import type {CharacterMock} from './mocks';

const character: CharacterMock = {
  gradient: 'linear-gradient(#111, #222)',
  id: 'character-1',
  initial: 'А',
  name: 'Анна',
  role: 'Главная роль',
  tag: 'Протагонист',
};

it('places the create card before existing characters', () => {
  const onCreate = jest.fn();
  const onViewAll = jest.fn();

  render(
    <CharactersSection
      characters={[character]}
      onCharacterClick={jest.fn()}
      onCreate={onCreate}
      onViewAll={onViewAll}
    />,
  );

  const createCard = screen.getByRole('button', {name: 'Создать персонажа'});
  const characterCard = screen.getByRole('button', {name: 'Открыть персонажа: Анна'});

  expect(screen.queryByRole('button', {name: 'More'})).not.toBeInTheDocument();
  expect(
    createCard.compareDocumentPosition(characterCard) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();

  fireEvent.click(createCard);
  expect(onCreate).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByRole('button', {name: 'Смотреть все'}));
  expect(onViewAll).toHaveBeenCalledTimes(1);
});
