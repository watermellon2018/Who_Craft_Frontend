import {render, screen, within} from '@testing-library/react';
import React from 'react';

import type {StoryboardScene} from '../model';
import SceneOverview from './SceneOverview';

const scene: StoryboardScene = {
  entities: [],
  heading: 'НАТ. ПРИЧАЛ — ДЕНЬ',
  id: '17',
  locationIds: [],
  order: 1,
  scriptBlocks: [
    {id: 'heading', text: 'НАТ. ПРИЧАЛ — ДЕНЬ', type: 'scene_heading'},
    {id: 'action', text: 'Энгри Дог подходит к лодке.', type: 'action'},
    {id: 'character', text: 'ЭНГРИ ДОГ', type: 'character'},
    {id: 'dialogue', text: 'Анчоус, это ты?', type: 'dialogue'},
    {id: 'remark', text: '(тихо)', type: 'remark'},
  ],
  shots: [],
  status: 'empty',
  text: 'НАТ. ПРИЧАЛ — ДЕНЬ\n\nЭнгри Дог подходит к лодке.\n\nЭНГРИ ДОГ\n\nАнчоус, это ты?',
  title: 'Встреча у лодки',
};

test('keeps screenplay block formatting in the scene excerpt', () => {
  const {container} = render(
    <SceneOverview
      aiGenerating={false}
      aiLoading={false}
      aiLoadingModels={false}
      entities={[]}
      scene={scene}
      onAddMissingAsset={jest.fn()}
      onStartManual={jest.fn()}
      onKeepScene={jest.fn()}
      onSplitScene={jest.fn()}
      onSuggest={jest.fn()}
    />,
  );

  const excerpt = container.querySelector('.storyboard-script');
  expect(excerpt).not.toBeNull();

  const character = within(excerpt as HTMLElement).getByText('ЭНГРИ ДОГ');
  const dialogue = within(excerpt as HTMLElement).getByText('Анчоус, это ты?');
  const remark = within(excerpt as HTMLElement).getByText('(тихо)');

  expect(character).toHaveClass('storyboard-script__block--character');
  expect(dialogue).toHaveClass('storyboard-script__block--dialogue');
  expect(remark).toHaveClass('storyboard-script__block--remark');
  expect(character.compareDocumentPosition(dialogue) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.getAllByText('НАТ. ПРИЧАЛ — ДЕНЬ')).toHaveLength(1);
});
