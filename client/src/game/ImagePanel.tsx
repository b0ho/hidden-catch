import { useEffect, useRef } from 'react';
import type { DiffRegion } from '@shared/types';
import { Character } from './Character';
import type { CharacterPosition } from './useCharacterMovement';

export interface MissMarker {
  x: number;
  y: number;
  /** Unique per miss so the fade/float animation restarts even for back-to-back misses at the same spot. */
  nonce: number;
}

export interface HintTarget {
  x: number;
  y: number;
  radius: number;
  /** Unique per hint so the ping animation restarts if the same spot is hinted twice. */
  nonce: number;
}

interface ImagePanelProps {
  src: string;
  alt: string;
  label: string;
  aspectRatio: number;
  interactive?: boolean;
  diffs?: DiffRegion[];
  foundIndices?: Set<number>;
  characterPosition?: CharacterPosition;
  characterFacing?: 'left' | 'right';
  characterWalking?: boolean;
  missMarker?: MissMarker | null;
  hintTarget?: HintTarget | null;
  /** 1 = no zoom. 2/3 render the image content at that multiple inside a scrollable viewport. */
  zoom?: number;
  /** 'width' (default) sizes the panel to the row's width, height follows from aspect-ratio —
   * right for a stacked/portrait layout. 'height' sizes it to the available height instead,
   * width follows — right for a side-by-side row where height is the scarce dimension. */
  fit?: 'width' | 'height';
  /** Explicit pixel box for fit="height", computed by the parent so the panel never overflows
   * either the row's height OR its share of the row's width (a "contain" fit CSS alone can't
   * express cleanly for a non-replaced element with padding/border). */
  computedSize?: { width: number; height: number } | null;
  onPanelClick?: (xFrac: number, yFrac: number) => void;
}

export function ImagePanel({
  src,
  alt,
  label,
  aspectRatio,
  interactive = false,
  diffs = [],
  foundIndices,
  characterPosition,
  characterFacing = 'right',
  characterWalking = false,
  missMarker,
  hintTarget,
  zoom = 1,
  fit = 'width',
  computedSize,
  onPanelClick,
}: ImagePanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const found = foundIndices ?? new Set<number>();
  const zoomed = zoom > 1;

  // While zoomed, keep the character centered in view as it walks — both panels take the
  // same characterPosition, so the original and modified photos stay scrolled to the same
  // region even though each has its own independent scroll container.
  useEffect(() => {
    if (!zoomed || !characterPosition || !containerRef.current) return;
    const el = containerRef.current;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const contentWidth = rect.width * zoom;
    const contentHeight = rect.height * zoom;
    const targetLeft = characterPosition.x * contentWidth - rect.width / 2;
    const targetTop = characterPosition.y * contentHeight - rect.height / 2;
    el.scrollLeft = Math.max(0, Math.min(contentWidth - rect.width, targetLeft));
    el.scrollTop = Math.max(0, Math.min(contentHeight - rect.height, targetTop));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomed, zoom, characterPosition?.x, characterPosition?.y]);

  function handleClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!interactive || !onPanelClick || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const { scrollLeft, scrollTop } = containerRef.current;
    const xFrac = (scrollLeft + (event.clientX - rect.left)) / (rect.width * zoom);
    const yFrac = (scrollTop + (event.clientY - rect.top)) / (rect.height * zoom);
    onPanelClick(xFrac, yFrac);
  }

  // fit="height" with a computed pixel box: the frame gets an explicit size (guaranteed to fit
  // both the row's height and this panel's share of its width), and the viewport just fills it —
  // no aspect-ratio needed there since the box's own ratio already matches the image.
  const usePixelBox = fit === 'height' && computedSize;
  const outerClass = usePixelBox ? 'flex flex-col items-center' : `flex min-w-0 flex-col items-center ${fit === 'height' ? 'h-full' : 'flex-1'}`;
  const frameClass = usePixelBox
    ? 'ink-panel relative select-none overflow-hidden rounded-xl bg-cream p-1.5'
    : `ink-panel relative select-none overflow-hidden rounded-xl bg-cream p-1.5 ${fit === 'height' ? 'h-full w-auto' : 'w-full min-w-0'}`;
  const frameStyle = usePixelBox ? { width: computedSize.width, height: computedSize.height } : undefined;
  const viewportClass = usePixelBox
    ? `relative h-full w-full rounded-md ${zoomed ? 'overflow-auto' : 'overflow-hidden'}`
    : `relative rounded-md ${fit === 'height' ? 'h-full w-auto' : 'w-full min-w-0'} ${zoomed ? 'overflow-auto' : 'overflow-hidden'}`;
  const viewportStyle = usePixelBox ? undefined : { aspectRatio };

  return (
    <div className={outerClass}>
      <div aria-label={label} className={`${frameClass} ${interactive ? 'cursor-crosshair' : ''}`} style={frameStyle}>
        <div ref={containerRef} onClick={handleClick} className={viewportClass} style={viewportStyle}>
          <div className="relative" style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}>
            <img
              src={src}
              alt={alt}
              className="pointer-events-none absolute inset-0 h-full w-full object-cover"
              draggable={false}
            />

            {diffs.map((diff, index) =>
              found.has(index) ? (
                <div
                  key={index}
                  className="absolute rounded-full border-4 border-mint"
                  style={{
                    left: `${diff.x * 100}%`,
                    top: `${diff.y * 100}%`,
                    width: `${diff.radius * 2 * 100}%`,
                    aspectRatio: 1,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  <div className="animate-found-pulse absolute inset-0 rounded-full bg-mint" />
                </div>
              ) : null,
            )}

            {missMarker ? (
              <div
                key={missMarker.nonce}
                className="font-display animate-miss-toast ink-text pointer-events-none absolute text-red-500"
                style={{
                  left: `${missMarker.x * 100}%`,
                  top: `${missMarker.y * 100}%`,
                  transform: 'translate(-50%, -50%)',
                  WebkitTextStrokeWidth: '1.5px',
                }}
              >
                -5초
              </div>
            ) : null}

            {hintTarget ? (
              <div
                key={hintTarget.nonce}
                className="pointer-events-none absolute"
                style={{
                  left: `${hintTarget.x * 100}%`,
                  top: `${hintTarget.y * 100}%`,
                  width: `${hintTarget.radius * 2.6 * 100}%`,
                  aspectRatio: 1,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <div className="animate-hint-ping absolute inset-0 rounded-full bg-lemon" />
                <div className="absolute inset-0 rounded-full border-4 border-dashed border-lemon-deep" />
                <div className="absolute inset-0 flex items-center justify-center text-lg">🔍</div>
              </div>
            ) : null}

            {interactive && characterPosition ? (
              <div
                className="absolute"
                style={{
                  left: `${characterPosition.x * 100}%`,
                  top: `${characterPosition.y * 100}%`,
                  transform: 'translate(-50%, -85%)',
                }}
              >
                <Character facing={characterFacing} isWalking={characterWalking} />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
