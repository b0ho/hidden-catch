import { useEffect, useRef, useState } from 'react';

export type LayoutDirection = 'stack' | 'row';

export interface PanelSize {
  width: number;
  height: number;
}

const GAP = 12;
const MAX_CONTENT_WIDTH = 1600;
/** Rough allowance for the gaps/margins between header, panels, and gauge bar. */
const VERTICAL_SLACK = 24;

/** Picks whichever arrangement — two photos side by side, or stacked — lets each photo render
 * BIGGER given the actual visible space, then computes its exact pixel box. Re-measures on any
 * resize (root/header/gauge all watched), so it reacts to real screen size the same way on a
 * resized desktop window as it does on a rotated phone, instead of guessing from a breakpoint. */
export function useStageLayout(aspectRatio: number) {
  const rootRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const gaugeRef = useRef<HTMLDivElement>(null);
  const [direction, setDirection] = useState<LayoutDirection>('stack');
  const [panelSize, setPanelSize] = useState<PanelSize | null>(null);

  useEffect(() => {
    function recompute() {
      const root = rootRef.current;
      if (!root) return;
      const rootRect = root.getBoundingClientRect();
      const headerHeight = headerRef.current?.getBoundingClientRect().height ?? 0;
      const gaugeHeight = gaugeRef.current?.getBoundingClientRect().height ?? 0;

      const availableWidth = Math.min(rootRect.width, MAX_CONTENT_WIDTH);
      const availableHeight = Math.max(80, rootRect.height - headerHeight - gaugeHeight - VERTICAL_SLACK);

      // Two columns: each photo gets half the width (minus the gap), capped by the full height.
      const rowSlotWidth = (availableWidth - GAP) / 2;
      const rowHeightFromWidth = rowSlotWidth / aspectRatio;
      const rowSize: PanelSize =
        rowHeightFromWidth <= availableHeight
          ? { width: rowSlotWidth, height: rowHeightFromWidth }
          : { width: availableHeight * aspectRatio, height: availableHeight };

      // Two rows: each photo gets half the height (minus the gap), capped by the full width.
      const stackSlotHeight = (availableHeight - GAP) / 2;
      const stackWidthFromHeight = stackSlotHeight * aspectRatio;
      const stackSize: PanelSize =
        stackWidthFromHeight <= availableWidth
          ? { width: stackWidthFromHeight, height: stackSlotHeight }
          : { width: availableWidth, height: availableWidth / aspectRatio };

      const rowArea = rowSize.width * rowSize.height;
      const stackArea = stackSize.width * stackSize.height;

      if (rowArea >= stackArea) {
        setDirection('row');
        setPanelSize(rowSize);
      } else {
        setDirection('stack');
        setPanelSize(stackSize);
      }
    }

    recompute();
    const observer = new ResizeObserver(recompute);
    if (rootRef.current) observer.observe(rootRef.current);
    if (headerRef.current) observer.observe(headerRef.current);
    if (gaugeRef.current) observer.observe(gaugeRef.current);
    window.addEventListener('resize', recompute);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', recompute);
    };
  }, [aspectRatio]);

  return { direction, panelSize, rootRef, headerRef, gaugeRef };
}
