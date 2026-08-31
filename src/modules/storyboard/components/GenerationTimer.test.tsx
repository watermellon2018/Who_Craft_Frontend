import {act, render, screen} from '@testing-library/react';
import React from 'react';

import GenerationTimer from './GenerationTimer';

test('counts elapsed time, never shows negative remaining time and clears its timer', () => {
  jest.useFakeTimers();
  jest.setSystemTime(1000);
  const {unmount} = render(<GenerationTimer startedAt={1000} estimatedSeconds={10} />);
  expect(screen.getByText('Прошло 00:00')).toBeInTheDocument();
  expect(screen.getByText('Осталось примерно 00:10')).toBeInTheDocument();
  act(() => jest.advanceTimersByTime(12000));
  expect(screen.getByText('Прошло 00:12')).toBeInTheDocument();
  expect(screen.getByText(/Генерация занимает больше времени/)).toBeInTheDocument();
  unmount();
  expect(jest.getTimerCount()).toBe(0);
  jest.useRealTimers();
});
