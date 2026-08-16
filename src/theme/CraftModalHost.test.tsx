import {ConfigProvider, theme as antdTheme} from 'antd';
import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';

import {createAntTheme} from './antdTheme';
import {CraftModalHost, craftModal} from './CraftModalHost';
import type {CraftTheme} from './craftTheme';

function ThemeProbe() {
  const {token} = antdTheme.useToken();
  return <span data-testid="modal-surface-token">{token.colorBgElevated}</span>;
}

function ModalTrigger() {
  return (
    <button
      type="button"
      onClick={() => craftModal.confirm({content: <ThemeProbe />, title: 'Theme probe'})}
    >
      Open modal
    </button>
  );
}

describe('CraftModalHost', () => {
  it.each<[CraftTheme, string]>([
    ['blue', '#102132'],
    ['dark', '#191e28'],
    ['light', '#f4efe5'],
  ])('provides the %s Craft theme to imperative modals', async (craftTheme, expectedSurface) => {
    render(
      <ConfigProvider theme={createAntTheme(craftTheme)}>
        <CraftModalHost />
        <ModalTrigger />
      </ConfigProvider>,
    );

    fireEvent.click(screen.getByRole('button', {name: 'Open modal'}));

    expect(await screen.findByTestId('modal-surface-token')).toHaveTextContent(expectedSurface);
  });
});
