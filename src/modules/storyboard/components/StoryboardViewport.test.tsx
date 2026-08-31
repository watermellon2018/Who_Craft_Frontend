import {render, screen} from '@testing-library/react';
import React from 'react';

import {createInitialKeyframes} from '../model';
import type {StoryboardShot} from '../model';
import StoryboardViewport from './StoryboardViewport';

test('renders a real storyboard image while preserving the mock fallback contract', () => {
  const [start, end] = createInitialKeyframes('shot-real');
  const keyframe = {...start, imageUrl: '/media/storyboard/start.jpg'};
  const shot: StoryboardShot = {
    characterIds: [],
    description: 'Anna enters the kitchen.',
    id: 'shot-real',
    keyframes: [keyframe, end],
    order: 1,
    referenceIds: [],
    sceneId: 'scene-real',
    title: 'Wide shot',
    transitions: [],
  };

  const {rerender} = render(
    <StoryboardViewport
      error={null}
      keyframe={keyframe}
      loading={false}
      onEditReferences={jest.fn()}
      onGenerate={jest.fn()}
      onRegenerate={jest.fn()}
      shot={shot}
    />,
  );

  expect(screen.getByRole('img', {name: /Shot 1/})).toHaveAttribute(
    'src',
    '/media/storyboard/start.jpg',
  );

  rerender(
    <StoryboardViewport
      error={null}
      keyframe={{...keyframe, imageUrl: 'javascript:alert(1)'}}
      loading={false}
      onEditReferences={jest.fn()}
      onGenerate={jest.fn()}
      onRegenerate={jest.fn()}
      shot={shot}
    />,
  );
  expect(screen.queryByRole('img', {name: /Shot 1/})).not.toBeInTheDocument();
});
