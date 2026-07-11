import { useRef } from 'react';
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
  /** Slight tilt so the two panels read as two photos laid on a table, not two <div>s in a flex row. */
  tilt?: 'left' | 'right';
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
  tilt = 'left',
  onPanelClick,
}: ImagePanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const found = foundIndices ?? new Set<number>();
  const tiltClass = tilt === 'left' ? '-rotate-1' : 'rotate-1';

  function handleClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!interactive || !onPanelClick || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const xFrac = (event.clientX - rect.left) / rect.width;
    const yFrac = (event.clientY - rect.top) / rect.height;
    onPanelClick(xFrac, yFrac);
  }

  return (
    <div className={`flex flex-1 min-w-0 flex-col items-center gap-2 ${tiltClass}`}>
      <span className="font-display ink-panel rounded-full bg-cream px-3 py-0.5 text-center text-[11px] text-ink sm:text-xs">
        {label}
      </span>
      <div
        ref={containerRef}
        onClick={handleClick}
        className={`ink-panel relative w-full select-none overflow-hidden rounded-xl bg-cream p-1.5 ${interactive ? 'cursor-crosshair' : ''}`}
      >
        <div className="relative w-full overflow-hidden rounded-md" style={{ aspectRatio }}>
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
  );
}
