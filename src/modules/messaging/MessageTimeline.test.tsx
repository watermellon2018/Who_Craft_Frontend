import React from 'react';
import {act, fireEvent, render, screen} from '@testing-library/react';

import {MessageTimeline} from './MessageTimeline';
import {initialSnapshot} from './state';
import {conversation, history, message} from './testFixtures';

jest.mock('../../api/http', () => ({getAuthGeneration: () => 1}));

function rectangle(top: number, bottom: number): DOMRect {
  return {x: 0, y: top, top, bottom, left: 0, right: 400, width: 400, height: bottom - top, toJSON: () => ({})};
}

it('acknowledges only incoming messages visible in a focused chat, pausing for editing', async () => {
  jest.useFakeTimers();
  const focused = jest.spyOn(document, 'hasFocus').mockReturnValue(false);
  const bounds = jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (this.classList.contains('messaging-timeline')) return rectangle(100, 500);
    if (this.dataset.messageId === '1') return rectangle(150, 200);
    return rectangle(600, 700);
  });
  const onRead = jest.fn().mockResolvedValue(undefined);
  const snapshot = initialSnapshot(history({items: [message(1), message(2), message(3, {is_own: true})], conversation: conversation({revision: 3, last_sequence: 3})}));
  const props = {snapshot, olderLoading: false, paused: false, sentCount: 0, onOlder: jest.fn(), onRead, onEdit: jest.fn(), onDelete: jest.fn()};
  const {rerender} = render(<MessageTimeline {...props} />);
  await act(async () => {jest.advanceTimersByTime(1);});
  expect(onRead).not.toHaveBeenCalled();
  focused.mockReturnValue(true);
  fireEvent.focus(window);
  expect(onRead).toHaveBeenLastCalledWith(1);
  onRead.mockClear();
  rerender(<MessageTimeline {...props} paused />);
  await act(async () => {jest.advanceTimersByTime(1);});
  fireEvent.scroll(screen.getByRole('list', {name: 'История сообщений'}).parentElement as HTMLElement);
  expect(onRead).not.toHaveBeenCalled();
  bounds.mockRestore();
  focused.mockRestore();
  jest.useRealTimers();
});
