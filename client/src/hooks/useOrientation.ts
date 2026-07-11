import { useEffect, useState } from 'react';

export type LayoutDirection = 'stack' | 'row';

/** Pure viewport-size comparison — wider-than-tall lays the two photos side by side,
 * taller-than-wide stacks them. Works the same whether it's a rotated phone or a resized
 * desktop window, instead of special-casing "desktop" to always mean side-by-side. */
function computeDirection(): LayoutDirection {
  return window.innerWidth >= window.innerHeight ? 'row' : 'stack';
}

export function useOrientation(): LayoutDirection {
  const [direction, setDirection] = useState<LayoutDirection>(() => computeDirection());

  useEffect(() => {
    const update = () => setDirection(computeDirection());
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return direction;
}
