import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import ContextualZonePanel from './ContextualZonePanel';
import {findZone, getAncestors} from './zones';

test('unsupported numeric controls and asymmetry are disabled with an explanation', () => {
  const change = jest.fn();
  const noop = () => undefined;
  render(<ContextualZonePanel zone={findZone('ears')} ancestors={getAncestors('ears')} zoneParams={{}}
    symmetryEnabled asymmetricSupported={false} supportsParameter={() => false}
    editSide={null} onSideChange={noop} isZoomed={false} hasChanges={false}
    onSelectZone={noop} onClose={noop} onParameterChange={change} onZoomToggle={noop}
    onSymmetryToggle={noop} onReset={noop} onCancel={noop} onApply={noop} onSave={noop} />);
  for (const slider of screen.getAllByRole('slider')) expect(slider).toBeDisabled();
  expect(screen.getByRole('switch')).toBeDisabled();
  expect(screen.getByText('Эта модель поддерживает только симметричное изменение формы')).toBeVisible();
  fireEvent.click(screen.getByRole('switch'));
  expect(change).not.toHaveBeenCalled();
});
