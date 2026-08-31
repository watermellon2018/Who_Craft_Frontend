import {createEvent, fireEvent, render, screen} from '@testing-library/react';
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

test('keeps pointer resizing valid at the bottom-right corner so the scene remains savable', () => {
  const onChange = jest.fn();
  const {container} = render(<CompositionEditor onChange={onChange}
    subjects={[{height: 12, width: 12, x: 88, y: 88, subjectId: 'character-edge'}]} />);
  const frame = container.querySelector('.storyboard-composition') as HTMLDivElement;
  const resize = container.querySelector('.storyboard-composition__resize') as HTMLSpanElement;
  resize.setPointerCapture = jest.fn();
  jest.spyOn(frame, 'getBoundingClientRect').mockReturnValue({width: 100, height: 100} as DOMRect);
  const pointer = (type: 'pointerDown' | 'pointerMove', target: Element, x: number, y: number) => {
    const event = createEvent[type](target);
    Object.defineProperties(event, {pointerId: {value: 1}, clientX: {value: x}, clientY: {value: y}});
    fireEvent(target, event);
  };
  pointer('pointerDown', resize, 100, 100);
  pointer('pointerMove', frame, 120, 120);
  expect(onChange).toHaveBeenLastCalledWith([
    expect.objectContaining({height: 12, width: 12, x: 88, y: 88}),
  ]);
});
