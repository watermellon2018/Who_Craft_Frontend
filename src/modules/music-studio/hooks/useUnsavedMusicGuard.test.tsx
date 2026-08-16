import {ConfigProvider} from 'antd';
import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import {useBlocker} from 'react-router-dom';

import {createAntTheme} from '../../../theme/antdTheme';
import {CraftModalHost} from '../../../theme/CraftModalHost';
import {useUnsavedMusicGuard} from './useUnsavedMusicGuard';

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useBlocker: jest.fn(),
}));

const mockedUseBlocker = useBlocker as jest.MockedFunction<typeof useBlocker>;

function GuardProbe() {
  useUnsavedMusicGuard(true);
  return null;
}

test('renders the unsaved music confirmation with its spacious modal layout', async () => {
  const reset = jest.fn();
  mockedUseBlocker.mockReturnValue({
    location: {hash: '', key: 'next', pathname: '/projects', search: '', state: null},
    proceed: jest.fn(),
    reset,
    state: 'blocked',
  });

  render(
    <ConfigProvider theme={createAntTheme('blue')}>
      <CraftModalHost />
      <GuardProbe />
    </ConfigProvider>,
  );

  expect(await screen.findByText('Есть несохранённый черновик')).toBeInTheDocument();
  expect(document.querySelector('.music-unsaved-confirm-modal')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', {name: 'Остаться'}));
  expect(reset).toHaveBeenCalledTimes(1);
});
