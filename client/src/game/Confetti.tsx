import { useMemo } from 'react';

const COLORS = ['#ff5c97', '#ffd23f', '#33d6a6', '#7fd1ff', '#fffbf0'];
const PIECE_COUNT = 28;

interface Piece {
  id: number;
  left: number;
  delay: number;
  duration: number;
  color: string;
  rotate: number;
  drift: number;
}

/** Lightweight CSS-only confetti burst — no external assets/libraries, just falling tinted bars. */
export function Confetti() {
  const pieces = useMemo<Piece[]>(
    () =>
      Array.from({ length: PIECE_COUNT }, (_, id) => ({
        id,
        left: Math.random() * 100,
        delay: Math.random() * 0.35,
        duration: 1.6 + Math.random() * 1.3,
        color: COLORS[id % COLORS.length],
        rotate: Math.random() * 360,
        drift: (Math.random() - 0.5) * 140,
      })),
    [],
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((piece) => (
        <span
          key={piece.id}
          className="animate-confetti-fall absolute top-[-8%] h-3 w-1.5 rounded-sm"
          style={
            {
              left: `${piece.left}%`,
              backgroundColor: piece.color,
              animationDelay: `${piece.delay}s`,
              animationDuration: `${piece.duration}s`,
              '--confetti-drift': `${piece.drift}px`,
              '--confetti-rotate': `${piece.rotate}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
