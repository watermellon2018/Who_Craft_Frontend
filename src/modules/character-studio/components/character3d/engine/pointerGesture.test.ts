import {trackPointerGesture} from './pointerGesture';

function pointer(type: string, pointerId: number) {
  const event = new Event(type);
  Object.assign(event, {pointerId});
  window.dispatchEvent(event);
}

test.each(['pointerup', 'pointercancel', 'blur', 'escape', 'unmount'])('%s releases one gesture and removes its listeners', (reason) => {
  const move = jest.fn();
  const finish = jest.fn();
  const cleanup = trackPointerGesture(window, 7, move, finish);
  pointer('pointermove', 8);
  pointer('pointerup', 8);
  expect(move).not.toHaveBeenCalled();
  expect(finish).not.toHaveBeenCalled();
  pointer('pointermove', 7);
  expect(move).toHaveBeenCalledTimes(1);
  if (reason === 'escape') window.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}));
  else if (reason === 'unmount') cleanup();
  else pointer(reason, 7);
  cleanup();
  pointer('pointermove', 7);
  expect(finish).toHaveBeenCalledTimes(1);
  expect(move).toHaveBeenCalledTimes(1);
});
