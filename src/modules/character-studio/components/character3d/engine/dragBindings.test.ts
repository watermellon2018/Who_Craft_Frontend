import {clampParameter, dragBindingFor, dragStartValue} from './dragBindings';

test('drag values use actual registry defaults and asymmetric ranges', () => {
  expect(dragStartValue({}, 'hair', 'hairLength')).toBe(.5);
  expect(clampParameter('hair', 'hairLength', -1)).toBe(0);
  expect(clampParameter('hair', 'hairLength', 4)).toBe(1);
  expect(clampParameter('nose', 'noseWidth', -2)).toBe(-1);
  expect(clampParameter('hair', 'hairLength', NaN)).toBe(.5);
});

test('unsupported axes do not promise an ineffective drag', () => {
  const rig = {supportsParameter: (zone: string, parameter: string) => zone === 'thigh' && parameter === 'thighLength'};
  expect(dragBindingFor('thigh', rig)).toEqual({x: undefined, y: 'thighLength'});
  expect(dragBindingFor('brows', rig)).toBeNull();
  expect(dragBindingFor('hair')).toEqual({x: 'hairVolume', y: 'hairLength'});
});
