/** Own native listeners for one captured pointer. Cleanup is idempotent. */
export function trackPointerGesture(
  target: Window,
  pointerId: number,
  onMove: (event: PointerEvent) => void,
  onFinish: () => void,
): () => void {
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    target.removeEventListener('pointermove', move);
    target.removeEventListener('pointerup', release);
    target.removeEventListener('pointercancel', release);
    target.removeEventListener('blur', finish);
    target.removeEventListener('keydown', escape);
    onFinish();
  };
  const move = (event: PointerEvent) => { if (event.pointerId === pointerId) onMove(event); };
  const release = (event: PointerEvent) => { if (event.pointerId === pointerId) finish(); };
  const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') finish(); };
  target.addEventListener('pointermove', move);
  target.addEventListener('pointerup', release);
  target.addEventListener('pointercancel', release);
  target.addEventListener('blur', finish);
  target.addEventListener('keydown', escape);
  return finish;
}
