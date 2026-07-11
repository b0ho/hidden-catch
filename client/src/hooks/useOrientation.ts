import { useEffect, useState } from 'react';

export type LayoutDirection = 'stack' | 'row';

const DESKTOP_QUERY = '(min-width: 768px)';
const PORTRAIT_QUERY = '(orientation: portrait)';

function computeDirection(): LayoutDirection {
  const isDesktop = window.matchMedia(DESKTOP_QUERY).matches;
  if (isDesktop) return 'row';
  const isPortrait = window.matchMedia(PORTRAIT_QUERY).matches;
  return isPortrait ? 'stack' : 'row';
}

export function useOrientation(): LayoutDirection {
  const [direction, setDirection] = useState<LayoutDirection>(() => computeDirection());

  useEffect(() => {
    const update = () => setDirection(computeDirection());
    const desktopQuery = window.matchMedia(DESKTOP_QUERY);
    const portraitQuery = window.matchMedia(PORTRAIT_QUERY);
    desktopQuery.addEventListener('change', update);
    portraitQuery.addEventListener('change', update);
    window.addEventListener('resize', update);
    return () => {
      desktopQuery.removeEventListener('change', update);
      portraitQuery.removeEventListener('change', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return direction;
}
