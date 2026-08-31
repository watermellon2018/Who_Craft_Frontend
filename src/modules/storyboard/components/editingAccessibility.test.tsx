import {fireEvent, render, screen} from '@testing-library/react';
import React from 'react';

import {createInitialKeyframes} from '../model';
import type {StoryboardKeyframe, StoryboardShot} from '../model';
import CompositionEditor from './CompositionEditor';
import KeyframeTimeline from './KeyframeTimeline';

test('repositions an intermediate keyframe with the keyboard', () => {
  const [start, end] = createInitialKeyframes('shot-keyboard');
  const intermediate: StoryboardKeyframe = {
    ...start,
    id: 'shot-keyboard-intermediate',
    position: 0.5,
    type: 'intermediate',
  };
  const shot: StoryboardShot = {
    characterIds: [],
    description: '',
    id: 'shot-keyboard',
    keyframes: [start, intermediate, end],
    order: 1,
    referenceIds: [],
    sceneId: 'scene-keyboard',
    title: 'Keyboard shot',
    transitions: [],
  };
  const onReposition = jest.fn();
  const {container} = render(
    <KeyframeTimeline
      onAddIntermediate={jest.fn()}
      onDelete={jest.fn()}
      onReposition={onReposition}
      onSelect={jest.fn()}
      selectedKeyframeId={intermediate.id}
      shot={shot}
    />,
  );
  const selected = container.querySelector<HTMLButtonElement>('[aria-current="true"]');
  expect(selected).not.toBeNull();

  fireEvent.keyDown(selected as HTMLButtonElement, {key: 'ArrowRight'});
  expect(onReposition).toHaveBeenCalledWith(intermediate.id, 0.52);
});

test('moves and resizes a composition subject with keyboard commands', () => {
  const onChange = jest.fn();
  render(
    <CompositionEditor
      onChange={onChange}
      subjects={[{height: 40, subjectId: 'character-anna', width: 28, x: 50, y: 25}]}
    />,
  );
  const subject = screen.getByRole('slider');

  fireEvent.keyDown(subject, {key: 'ArrowRight'});
  expect(onChange).toHaveBeenLastCalledWith([
    expect.objectContaining({width: 28, x: 51}),
  ]);

  fireEvent.keyDown(subject, {altKey: true, key: 'ArrowRight'});
  expect(onChange).toHaveBeenLastCalledWith([
    expect.objectContaining({width: 29, x: 50}),
  ]);
});
