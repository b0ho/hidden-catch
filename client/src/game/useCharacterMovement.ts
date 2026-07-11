import { useCallback, useState } from 'react';

export interface CharacterPosition {
  x: number;
  y: number;
}

const DEFAULT_POSITION: CharacterPosition = { x: 0.5, y: 0.9 };

export function useCharacterMovement(initial: CharacterPosition = DEFAULT_POSITION) {
  const [position, setPosition] = useState<CharacterPosition>(initial);
  const [facing, setFacing] = useState<'left' | 'right'>('right');
  const [isWalking, setIsWalking] = useState(false);

  const moveTo = useCallback((x: number, y: number) => {
    setPosition((prev) => {
      setFacing(x >= prev.x ? 'right' : 'left');
      return { x, y };
    });
    setIsWalking(true);
    window.setTimeout(() => setIsWalking(false), 350);
  }, []);

  return { position, facing, isWalking, moveTo };
}
