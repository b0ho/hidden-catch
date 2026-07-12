import { useEffect, useState } from 'react';

/** True on devices whose primary pointer is coarse (touch) — used to decide whether to show the virtual joystick. */
export function useIsTouchDevice() {
  // Lazy initializer reads matchMedia synchronously on first render, so touch devices don't
  // flash the desktop layout (bottom controls hidden, zoom button in header) for one frame
  // before the effect below corrects it.
  const [isTouch, setIsTouch] = useState(() => window.matchMedia('(pointer: coarse)').matches);

  useEffect(() => {
    const query = window.matchMedia('(pointer: coarse)');
    const update = () => setIsTouch(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return isTouch;
}
