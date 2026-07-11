import { useRef } from 'react';
import type { DiffRegion } from '@shared/types';
import { Character } from './Character';
import type { CharacterPosition } from './useCharacterMovement';

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
  onPanelClick,
}: ImagePanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const found = foundIndices ?? new Set<number>();

  function handleClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!interactive || !onPanelClick || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const xFrac = (event.clientX - rect.left) / rect.width;
    const yFrac = (event.clientY - rect.top) / rect.height;
    onPanelClick(xFrac, yFrac);
  }

  return (
    <div className="flex flex-1 min-w-0 flex-col gap-1">
      <span className="text-center text-xs font-medium text-white/80 sm:text-sm">{label}</span>
      <div
        ref={containerRef}
        onClick={handleClick}
        className={`relative w-full select-none overflow-hidden rounded-xl bg-slate-800 ${interactive ? 'cursor-crosshair' : ''}`}
        style={{ aspectRatio }}
      >
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
              className="absolute rounded-full border-4 border-emerald-400"
              style={{
                left: `${diff.x * 100}%`,
                top: `${diff.y * 100}%`,
                width: `${diff.radius * 2 * 100}%`,
                aspectRatio: 1,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div className="animate-found-pulse absolute inset-0 rounded-full bg-emerald-400" />
            </div>
          ) : null,
        )}

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
  );
}
